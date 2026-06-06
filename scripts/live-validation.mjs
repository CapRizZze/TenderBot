import fs from "node:fs";

import { PrismaClient } from "@prisma/client";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as xlsx from "xlsx";

const prisma = new PrismaClient();

function loadEnvFile(path = ".env") {
  const env = {};
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const env = loadEnvFile();

const deepSeek = createOpenAICompatible({
  name: "deepseek",
  apiKey: env.DEEPSEEK_API_KEY,
  baseURL: env.DEEPSEEK_BASE_URL,
});

const DEFAULT_SBIS_AUTH_METHOD = "СБИС.Аутентифицировать";
const DEFAULT_SABY_PROTOCOL = 4;
const MAX_TOTAL_ATTACHMENT_TEXT_LENGTH = 60_000;
const MAX_EXTRACTED_TEXT_LENGTH = 20_000;
const LIVE_CHECK_TENDER_IDS = ["243103395", "243100291"];
const LIVE_CHECK_PROMPT =
  "Сделай короткую выжимку по документу, выдели 3 риска и 3 ключевых требования для участия.";

function getConfiguredRequestNames() {
  return String(env.SABY_TENDER_REQUEST_NAMES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeNonNegativeInteger(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  const raw = String(value ?? "").trim();

  if (!raw) {
    return undefined;
  }

  const normalized = raw.replace(/\s+/g, "").replace(/[^\d]/g, "");
  const numberValue = Number(normalized);

  return Number.isInteger(numberValue) && numberValue >= 0
    ? numberValue
    : undefined;
}

function normalizeDailyLimitStatistics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Saby statistics response has invalid payload");
  }

  const dayCounter = normalizeNonNegativeInteger(
    value.DayCounter ?? value.dayCounter ?? value.used ?? value.counter,
  );
  const dayLimit = normalizeNonNegativeInteger(
    value.DayLimit ?? value.dayLimit ?? value.limit,
  );
  const dayRemaining = normalizeNonNegativeInteger(
    value.DayRemaining ?? value.dayRemaining ?? value.remaining,
  );

  if (dayCounter === undefined || dayLimit === undefined) {
    throw new Error("Saby statistics response does not contain daily limit fields");
  }

  return {
    dayCounter,
    dayLimit,
    dayRemaining: dayRemaining ?? Math.max(dayLimit - dayCounter, 0),
  };
}

async function callJsonRpc(url, payload, sid) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json",
  };

  if (sid) {
    headers.Cookie = `sid=${sid}`;
    headers["X-SBISSessionID"] = sid;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const raw = await response.text();
  const parsed = JSON.parse(raw);

  if (parsed?.error) {
    const code = parsed.error.code ?? "unknown";
    const message = parsed.error.message ?? "Unknown RPC error";
    throw new Error(`${code}: ${message}`);
  }

  return parsed.result;
}

function extractSid(value) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  for (const key of ["sid", "SID", "sessionId", "SessionId"]) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

async function authenticateSaby() {
  const payloads = [
    {
      jsonrpc: "2.0",
      method: DEFAULT_SBIS_AUTH_METHOD,
      params: {
        Параметр: {
          Логин: env.SABY_LOGIN,
          Пароль: env.SABY_PASSWORD,
        },
      },
      id: "auth-1",
    },
    {
      jsonrpc: "2.0",
      method: DEFAULT_SBIS_AUTH_METHOD,
      params: {
        login: env.SABY_LOGIN,
        password: env.SABY_PASSWORD,
      },
      id: "auth-2",
    },
  ];

  const errors = [];

  for (const payload of payloads) {
    try {
      const result = await callJsonRpc(env.SABY_AUTH_URL, payload);
      const sid = extractSid(result);

      if (sid) {
        return sid;
      }

      errors.push("response does not contain SID");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown auth error");
    }
  }

  throw new Error(`Saby authentication failed: ${errors.join("; ")}`);
}

async function getSabyStatistics(sid) {
  const result = await callJsonRpc(
    env.SABY_TENDER_API_URL,
    {
      jsonrpc: "2.0",
      protocol: DEFAULT_SABY_PROTOCOL,
      method: "SbisTenderAPI.GetStatistics",
      params: {},
      id: `SbisTenderAPI.GetStatistics-${Math.random().toString(36).slice(2)}`,
    },
    sid,
  );

  return normalizeDailyLimitStatistics(result);
}

function getFromPublishDateTime() {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 60);

  const year = fromDate.getFullYear();
  const month = String(fromDate.getMonth() + 1).padStart(2, "0");
  const day = String(fromDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day} 00:00:00`;
}

async function attemptRefresh(sid, requestName) {
  const payloads = [
    {
      jsonrpc: "2.0",
      protocol: DEFAULT_SABY_PROTOCOL,
      method: "SbisTenderAPI.GetTenderList",
      params: {
        params: {
          requestName,
          limit: Number(env.SABY_PAGE_SIZE ?? "1"),
          fromPublishDateTime: getFromPublishDateTime(),
        },
      },
      id: `SbisTenderAPI.GetTenderList-${Math.random().toString(36).slice(2)}`,
    },
    {
      jsonrpc: "2.0",
      protocol: DEFAULT_SABY_PROTOCOL,
      method: "SbisTenderAPI.GetTenderList",
      params: {
        params: {
          requestName,
          limit: Number(env.SABY_PAGE_SIZE ?? "1"),
        },
      },
      id: `SbisTenderAPI.GetTenderList-${Math.random().toString(36).slice(2)}`,
    },
  ];

  const errors = [];

  for (const payload of payloads) {
    try {
      const result = await callJsonRpc(env.SABY_TENDER_API_URL, payload, sid);
      return {
        status: "success",
        rawResultType: Array.isArray(result) ? "array" : typeof result,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown refresh error");
    }
  }

  return {
    status: errors.some((message) => /limit|суточ/i.test(message))
      ? "daily_limit"
      : "error",
    errors,
  };
}

function buildTenderConversationTitle(tender) {
  const title = tender.title.trim();
  const customer = tender.customer.trim();
  const combined =
    title.length > 0 && customer.length > 0
      ? `${title} - ${customer}`
      : title || customer || "Tender dialog";

  return combined.length <= 160
    ? combined
    : `${combined.slice(0, 157).trimEnd()}...`;
}

function filterAllowedAttachments(allowedAttachments, selectedAttachments) {
  const allowedUrls = new Set(allowedAttachments.map((attachment) => attachment.url));

  return selectedAttachments.filter((attachment) => allowedUrls.has(attachment.url));
}

function limitAttachmentContentsForPrompt(attachments) {
  let remaining = MAX_TOTAL_ATTACHMENT_TEXT_LENGTH;

  return attachments.map((attachment) => {
    if (!attachment.extractedText || remaining <= 0) {
      return {
        ...attachment,
        extractedText: null,
        extractedTextError:
          attachment.extractedTextError ??
          "Текст не добавлен в prompt из-за общего ограничения размера",
      };
    }

    if (attachment.extractedText.length <= remaining) {
      remaining -= attachment.extractedText.length;
      return attachment;
    }

    const truncatedText = attachment.extractedText.slice(0, remaining).trimEnd();
    remaining = 0;

    return {
      ...attachment,
      extractedText:
        truncatedText.length > 0
          ? `${truncatedText}\n\n[Текст документа обрезан по общему лимиту prompt]`
          : null,
      extractedTextError:
        truncatedText.length > 0
          ? attachment.extractedTextError
          : "Текст не добавлен в prompt из-за общего ограничения размера",
    };
  });
}

function formatAttachmentList(attachments, emptyLabel) {
  if (attachments.length === 0) {
    return emptyLabel;
  }

  return attachments.map((attachment) => `${attachment.name}: ${attachment.url}`).join("; ");
}

function buildChatSystemMessage(tender, selectedAttachments, selectedAttachmentContents) {
  return [
    "You are AI Tender Bot, an expert assistant for public and commercial tender analysis.",
    "Always respond in Russian.",
    "Return plain text only. Do not use HTML.",
    "Be structured, practical, and explicit about risks, deadlines, budget, customer constraints, and fit for participation.",
    "Do not invent facts. If data is missing, state that clearly and explain what must be clarified before a final conclusion.",
    "",
    "Tender context:",
    `Title: ${tender.title}`,
    `Customer: ${tender.customer}`,
    `Number: ${tender.number ?? "n/a"}`,
    `Description: ${tender.description}`,
    `Deadline: ${tender.deadline.toISOString()}`,
    `Budget: ${typeof tender.budget === "number" ? tender.budget : "not specified"}`,
    `URL: ${tender.url}`,
    `All attachments: ${formatAttachmentList(tender.attachments, "not loaded")}`,
    `Selected attachments for analysis: ${formatAttachmentList(selectedAttachments, "none selected")}`,
    "",
    "Extracted content of selected attachments:",
    selectedAttachmentContents.length > 0
      ? selectedAttachmentContents
          .map((attachment) =>
            [
              `Document: ${attachment.name}`,
              `URL: ${attachment.url}`,
              attachment.extractedText
                ? `Text:\n${attachment.extractedText}`
                : `Extraction error: ${attachment.extractedTextError ?? "text unavailable"}`,
            ].join("\n"),
          )
          .join("\n\n")
      : "No selected documents or document content could not be extracted",
  ].join("\n");
}

function normalizeAttachmentType(mimeType, fileName) {
  const normalizedMimeType = (mimeType ?? "").toLowerCase();
  const normalizedFileName = fileName.toLowerCase();

  if (normalizedMimeType.includes("pdf") || normalizedFileName.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    normalizedMimeType.includes("wordprocessingml.document") ||
    normalizedFileName.endsWith(".docx")
  ) {
    return "docx";
  }
  if (
    normalizedMimeType.includes("spreadsheetml.sheet") ||
    normalizedMimeType.includes("application/vnd.ms-excel") ||
    normalizedFileName.endsWith(".xlsx") ||
    normalizedFileName.endsWith(".xls")
  ) {
    return "xlsx";
  }
  if (
    normalizedMimeType.startsWith("text/") ||
    normalizedMimeType.includes("json") ||
    normalizedMimeType.includes("xml") ||
    normalizedFileName.endsWith(".txt") ||
    normalizedFileName.endsWith(".json") ||
    normalizedFileName.endsWith(".xml") ||
    normalizedFileName.endsWith(".csv")
  ) {
    return "text";
  }
  if (normalizedFileName.endsWith(".doc")) {
    return "doc";
  }
  return "unknown";
}

async function extractTextFromBuffer(buffer, mimeType, fileName) {
  const kind = normalizeAttachmentType(mimeType, fileName);

  if (kind === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text.trim();
    } finally {
      await parser.destroy();
    }
  }
  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
  if (kind === "xlsx") {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    return workbook.SheetNames.map((sheetName) => {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        blankrows: false,
      });
      const body = rows
        .map((row) =>
          row
            .map((cell) => String(cell ?? "").trim())
            .filter((cell) => cell.length > 0)
            .join(" | "),
        )
        .filter((row) => row.length > 0)
        .join("\n");
      return `Лист: ${sheetName}\n${body}`.trim();
    })
      .filter(Boolean)
      .join("\n\n");
  }
  if (kind === "text") {
    return buffer.toString("utf8").trim();
  }

  throw new Error(`Unsupported attachment type: ${fileName}`);
}

function truncateExtractedText(value) {
  const normalized = value.trim();

  if (normalized.length <= MAX_EXTRACTED_TEXT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_EXTRACTED_TEXT_LENGTH)}\n\n[Текст обрезан из-за ограничения размера]`;
}

async function getAttachmentContent(attachment) {
  if (attachment.extractedText) {
    return {
      name: attachment.name,
      url: attachment.url,
      extractedText: attachment.extractedText,
      extractedTextError: attachment.extractedTextError,
    };
  }

  const response = await fetch(attachment.url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Attachment download failed: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const text = truncateExtractedText(
    await extractTextFromBuffer(
      buffer,
      response.headers.get("content-type") ?? attachment.mimeType ?? undefined,
      attachment.name,
    ),
  );

  if (attachment.id) {
    await prisma.tenderAttachment.update({
      where: { id: attachment.id },
      data: {
        extractedText: text,
        extractedTextAt: new Date(),
        extractedTextError: null,
        mimeType: response.headers.get("content-type") ?? attachment.mimeType ?? null,
        size: Number(response.headers.get("content-length")) || attachment.size || null,
      },
    });
  }

  return {
    name: attachment.name,
    url: attachment.url,
    extractedText: text,
    extractedTextError: null,
  };
}

async function analyzeTenderForUser(userEmail, externalId, prompt) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new Error(`User not found: ${userEmail}`);
  }

  const tender = await prisma.tender.findUnique({
    where: { externalId },
    include: {
      attachments: true,
    },
  });
  if (!tender) {
    throw new Error(`Tender not found: ${externalId}`);
  }

  const selectedAttachments = filterAllowedAttachments(
    tender.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      url: attachment.url,
      mimeType: attachment.mimeType ?? undefined,
      size: attachment.size ?? undefined,
    })),
    tender.attachments.slice(0, 1).map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      url: attachment.url,
      mimeType: attachment.mimeType ?? undefined,
      size: attachment.size ?? undefined,
    })),
  );

  const selectedAttachmentContents = limitAttachmentContentsForPrompt(
    await Promise.all(
      tender.attachments
        .filter((attachment) =>
          selectedAttachments.some((selected) => selected.url === attachment.url),
        )
        .map(getAttachmentContent),
    ),
  );

  const conversation = await prisma.conversation.upsert({
    where: {
      userId_tenderId: {
        userId: user.id,
        tenderId: tender.id,
      },
    },
    create: {
      userId: user.id,
      tenderId: tender.id,
      title: buildTenderConversationTitle(tender),
    },
    update: {
      title: buildTenderConversationTitle(tender),
      updatedAt: new Date(),
    },
  });

  const clientMessageId = `live-check:${externalId}:${Date.now()}`;
  const userMessage = await prisma.message.upsert({
    where: {
      conversationId_clientMessageId: {
        conversationId: conversation.id,
        clientMessageId,
      },
    },
    create: {
      conversationId: conversation.id,
      role: "user",
      content: prompt,
      clientMessageId,
    },
    update: {},
  });

  const assistantMessage = await prisma.message.upsert({
    where: {
      conversationId_clientMessageId: {
        conversationId: conversation.id,
        clientMessageId: `${clientMessageId}:assistant`,
      },
    },
    create: {
      conversationId: conversation.id,
      role: "assistant",
      content: "Ответ формируется. Если генерация оборвётся, запустите запрос повторно.",
      clientMessageId: `${clientMessageId}:assistant`,
    },
    update: {},
  });

  const systemMessage = buildChatSystemMessage(
    {
      ...tender,
      budget: tender.budget ? tender.budget.toNumber() : undefined,
      attachments: tender.attachments.map((attachment) => ({
        name: attachment.name,
        url: attachment.url,
      })),
    },
    selectedAttachments,
    selectedAttachmentContents,
  );

  const result = await generateText({
    model: deepSeek(env.DEEPSEEK_MODEL),
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: prompt },
    ],
  });

  await prisma.message.update({
    where: { id: assistantMessage.id },
    data: { content: result.text.trim() },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  const persistedConversation = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      tender: { select: { externalId: true, title: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { role: true, content: true, createdAt: true },
      },
    },
  });

  return {
    externalId,
    selectedAttachmentNames: selectedAttachments.map((attachment) => attachment.name),
    extractedDocuments: selectedAttachmentContents.map((attachment) => ({
      name: attachment.name,
      extractedTextLength: attachment.extractedText?.length ?? 0,
      extractedTextError: attachment.extractedTextError,
    })),
    conversation: persistedConversation,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    assistantPreview: result.text.slice(0, 400),
  };
}

async function main() {
  const requestNames = getConfiguredRequestNames();

  if (requestNames.length === 0) {
    throw new Error("SABY_TENDER_REQUEST_NAMES is empty");
  }

  const sid = await authenticateSaby();
  const before = await getSabyStatistics(sid);
  const refreshAttempt = await attemptRefresh(sid, requestNames[0]);
  const after = await getSabyStatistics(sid);

  const analyses = [];
  for (const externalId of LIVE_CHECK_TENDER_IDS) {
    try {
      analyses.push(
        await analyzeTenderForUser(
          "caprizzze@yandex.ru",
          externalId,
          LIVE_CHECK_PROMPT,
        ),
      );
    } catch (error) {
      analyses.push({
        externalId,
        error: error instanceof Error ? error.message : "Unknown analysis error",
      });
    }
  }

  const persistedConversations = await prisma.conversation.findMany({
    where: {
      user: { email: "caprizzze@yandex.ru" },
      tender: { externalId: { in: LIVE_CHECK_TENDER_IDS } },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      tender: { select: { externalId: true, title: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { role: true, content: true, createdAt: true },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        refresh: {
          requestName: requestNames[0],
          before,
          attempt: refreshAttempt,
          after,
          usedRequests: Math.max(after.dayCounter - before.dayCounter, 0),
          remainingDelta: Math.max(before.dayRemaining - after.dayRemaining, 0),
        },
        analyses,
        persistedConversations,
      },
      null,
      2,
    ),
  );
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
