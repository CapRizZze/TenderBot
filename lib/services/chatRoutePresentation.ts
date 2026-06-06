import type { CoreMessage } from "ai";

import type {
  ChatMessageDto,
} from "../../types/chat.dto.ts";
import type {
  Tender,
  TenderAttachment,
} from "../../types/tender-parser.dto.ts";
import type { AttachmentWithContent } from "./chatAttachmentPolicy.ts";

export function formatAttachmentList(
  attachments: Array<{ name: string; url: string }>,
  emptyLabel: string,
): string {
  if (attachments.length === 0) {
    return emptyLabel;
  }

  return attachments
    .map((attachment) => `${attachment.name}: ${attachment.url}`)
    .join("; ");
}

export function findLastUserMessage(messages: ChatMessageDto[]) {
  return [...messages].reverse().find((message) => message.role === "user") ?? null;
}

export function buildChatSystemMessage(
  tender: Tender,
  selectedAttachments: TenderAttachment[],
  selectedAttachmentContents: AttachmentWithContent[],
): CoreMessage {
  return {
    role: "system",
    content: [
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
      `Deadline: ${tender.deadline}`,
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
    ].join("\n"),
  };
}
