import type { Tender } from "../types/tender-parser.dto.ts";

const MAX_CONVERSATION_TITLE_LENGTH = 160;

export function buildTenderConversationTitle(tender: Tender): string {
  const title = tender.title.trim();
  const customer = tender.customer.trim();
  const combined =
    title.length > 0 && customer.length > 0
      ? `${title} - ${customer}`
      : title || customer || "Tender dialog";

  return combined.length <= MAX_CONVERSATION_TITLE_LENGTH
    ? combined
    : `${combined.slice(0, MAX_CONVERSATION_TITLE_LENGTH - 3).trimEnd()}...`;
}
