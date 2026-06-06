"use client";

export const CONVERSATIONS_UPDATED_EVENT = "tenderbot:conversations-updated";

export function dispatchConversationsUpdated() {
  window.dispatchEvent(new Event(CONVERSATIONS_UPDATED_EVENT));
}
