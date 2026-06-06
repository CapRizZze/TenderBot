import type { TenderAttachment } from "../../types/tender-parser.dto.ts";

const MAX_TOTAL_ATTACHMENT_TEXT_LENGTH = 60_000;

export interface AttachmentWithContent {
  name: string;
  url: string;
  extractedText: string | null;
  extractedTextError: string | null;
}

export function getMaxTotalAttachmentTextLength() {
  return MAX_TOTAL_ATTACHMENT_TEXT_LENGTH;
}

export function filterAllowedAttachments(
  allowedAttachments: TenderAttachment[],
  selectedAttachments: TenderAttachment[],
) {
  const allowedUrls = new Set(allowedAttachments.map((attachment) => attachment.url));

  return selectedAttachments.filter((attachment) => allowedUrls.has(attachment.url));
}

export function limitAttachmentContentsForPrompt(
  attachments: AttachmentWithContent[],
) {
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
