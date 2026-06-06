import { getParserEnv } from "@/lib/env";
import {
  findTenderAttachmentsByExternalIdAndUrls,
  updateTenderAttachmentExtractedText,
} from "@/lib/repositories/tenderRepository";
import {
  createSabyApiCallLog,
  getSabyUsedRequests,
} from "@/lib/services/sabyApiCallLogService";
import {
  downloadTenderParserAttachment,
  fetchTenderParserDailyLimitStatistics,
  isSabyUrl,
} from "@/lib/tender-parser/tenderParserService";
import type { TenderAttachment } from "@/types/tender-parser.dto";

const MAX_EXTRACTED_TEXT_LENGTH = 20_000;

interface SafeDailyLimitSnapshot {
  dayCounter: number;
  dayLimit: number;
  dayRemaining: number;
}

interface TenderAttachmentContent {
  id?: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  extractedText: string | null;
  extractedTextError: string | null;
}

export async function getOrFetchTenderAttachmentContents(
  tenderExternalId: string,
  attachments: TenderAttachment[],
): Promise<TenderAttachmentContent[]> {
  if (attachments.length === 0) {
    return [];
  }

  const cachedAttachments = await findTenderAttachmentsByExternalIdAndUrls(
    tenderExternalId,
    attachments.map((attachment) => attachment.url),
  );
  const cachedByUrl = new Map(
    cachedAttachments.map((attachment) => [attachment.url, attachment]),
  );

  const results: TenderAttachmentContent[] = [];

  for (const attachment of attachments) {
    const cached = cachedByUrl.get(attachment.url);

    if (cached?.extractedText) {
      results.push({
        id: cached.id,
        name: cached.name,
        url: cached.url,
        mimeType: cached.mimeType ?? attachment.mimeType ?? undefined,
        size: cached.size ?? attachment.size ?? undefined,
        extractedText: cached.extractedText,
        extractedTextError: cached.extractedTextError ?? null,
      });
      continue;
    }

    const extracted = await extractAndPersistAttachmentContent(
      tenderExternalId,
      attachment,
      cached?.id,
    );

    results.push({
      id: cached?.id ?? attachment.id,
      name: attachment.name,
      url: attachment.url,
      mimeType: extracted.mimeType ?? attachment.mimeType,
      size: extracted.size ?? attachment.size,
      extractedText: extracted.extractedText,
      extractedTextError: extracted.extractedTextError,
    });
  }

  return results;
}

async function extractAndPersistAttachmentContent(
  tenderExternalId: string,
  attachment: TenderAttachment,
  attachmentId?: string,
) {
  const parserEnv = getParserEnv();
  const startedAt = Date.now();
  const shouldTrackSabyStatistics =
    parserEnv.TENDER_PARSER_MODE === "saby" && isSabyUrl(attachment.url);
  const before =
    shouldTrackSabyStatistics
      ? await fetchDailyLimitStatisticsSafely()
      : null;

  try {
    const download = await downloadTenderParserAttachment(attachment);
    const extractedText = truncateExtractedText(
      await extractTextFromAttachment(
        download.buffer,
        download.mimeType ?? attachment.mimeType,
        attachment.name,
      ),
    );
    const after =
      shouldTrackSabyStatistics
        ? await fetchDailyLimitStatisticsSafely()
        : null;

    if (attachmentId) {
      await updateTenderAttachmentExtractedText(attachmentId, {
        extractedText,
        extractedTextAt: new Date(),
        extractedTextError: null,
        mimeType: download.mimeType ?? attachment.mimeType ?? null,
        size: download.size ?? attachment.size ?? null,
      });
    }

    if (shouldTrackSabyStatistics) {
      await createSabyApiCallLog({
        operation: "download_attachment",
        method: "GET",
        endpoint: attachment.url,
        tenderExternalId,
        status: "success",
        durationMs: Date.now() - startedAt,
        usedRequests: getSabyUsedRequests(before, after),
        dayCounterBefore: before?.dayCounter,
        dayCounterAfter: after?.dayCounter,
        dayRemainingBefore: before?.dayRemaining,
        dayRemainingAfter: after?.dayRemaining,
        payloadSummary: {
          name: attachment.name,
        },
        responseSummary: {
          mimeType: download.mimeType ?? attachment.mimeType ?? null,
          size: download.size ?? attachment.size ?? null,
        },
      });
    }

    return {
      extractedText,
      extractedTextError: null,
      mimeType: download.mimeType,
      size: download.size,
    };
  } catch (error) {
    const after =
      shouldTrackSabyStatistics
        ? await fetchDailyLimitStatisticsSafely()
        : null;
    const extractedTextError =
      error instanceof Error ? error.message : "Failed to extract attachment text";

    if (attachmentId) {
      await updateTenderAttachmentExtractedText(attachmentId, {
        extractedText: null,
        extractedTextAt: null,
        extractedTextError,
      });
    }

    if (shouldTrackSabyStatistics) {
      await createSabyApiCallLog({
        operation: "download_attachment",
        method: "GET",
        endpoint: attachment.url,
        tenderExternalId,
        status: "error",
        durationMs: Date.now() - startedAt,
        usedRequests: getSabyUsedRequests(before, after),
        dayCounterBefore: before?.dayCounter,
        dayCounterAfter: after?.dayCounter,
        dayRemainingBefore: before?.dayRemaining,
        dayRemainingAfter: after?.dayRemaining,
        payloadSummary: {
          name: attachment.name,
        },
        error: extractedTextError,
      });
    }

    return {
      extractedText: null,
      extractedTextError,
      mimeType: attachment.mimeType,
      size: attachment.size,
    };
  }
}

async function fetchDailyLimitStatisticsSafely(): Promise<SafeDailyLimitSnapshot | null> {
  try {
    return await fetchTenderParserDailyLimitStatistics();
  } catch (error) {
    console.warn("Failed to load Saby daily limit statistics for attachment download", error);

    return null;
  }
}

async function extractTextFromAttachment(
  buffer: Buffer,
  mimeType: string | undefined,
  fileName: string,
): Promise<string> {
  const normalizedType = normalizeAttachmentType(mimeType, fileName);

  switch (normalizedType) {
    case "pdf":
      return extractTextFromPdf(buffer);
    case "docx":
      return extractTextFromDocx(buffer);
    case "xlsx":
      return extractTextFromXlsx(buffer);
    case "text":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported attachment type: ${fileName}`);
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfParseModule = (await import("pdf-parse")) as unknown as {
    default: (input: Buffer) => Promise<{ text: string }>;
  };
  const pdfParse = pdfParseModule.default;
  const parsed = await pdfParse(buffer);

  return parsed.text.trim();
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });

  return result.value.trim();
}

async function extractTextFromXlsx(buffer: Buffer): Promise<string> {
  const xlsx = await import("xlsx");
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetTexts = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<string[]>(sheet, {
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
  }).filter((sheetText) => sheetText.length > 0);

  return sheetTexts.join("\n\n");
}

function normalizeAttachmentType(
  mimeType: string | undefined,
  fileName: string,
): "pdf" | "docx" | "xlsx" | "text" | "unknown" {
  const normalizedMimeType = mimeType?.toLocaleLowerCase("en-US") ?? "";
  const normalizedFileName = fileName.toLocaleLowerCase("en-US");

  if (
    normalizedMimeType.includes("pdf") ||
    normalizedFileName.endsWith(".pdf")
  ) {
    return "pdf";
  }

  if (
    normalizedMimeType.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ) ||
    normalizedFileName.endsWith(".docx")
  ) {
    return "docx";
  }

  if (
    normalizedMimeType.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ) ||
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

  return "unknown";
}

function truncateExtractedText(value: string): string {
  const normalized = value.trim();

  if (normalized.length <= MAX_EXTRACTED_TEXT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_EXTRACTED_TEXT_LENGTH)}\n\n[Текст обрезан из-за ограничения размера]`;
}
