"use client";

import { useCallback, useEffect, useState } from "react";

import { CONVERSATIONS_UPDATED_EVENT } from "@/lib/client-events";
import {
  type ConversationListItemDto,
  conversationListResponseSchema,
} from "@/types/conversation.dto";
import { getErrorMessageFromResponse } from "@/utils/api-client";

interface UseConversationsState {
  conversations: ConversationListItemDto[];
  isLoading: boolean;
  errorMessage: string | null;
}

let conversationsCache: ConversationListItemDto[] | null = null;

export function useConversations() {
  const [state, setState] = useState<UseConversationsState>({
    conversations: conversationsCache ?? [],
    isLoading: conversationsCache === null,
    errorMessage: null,
  });

  const loadConversations = useCallback(async () => {
    setState((currentState) => ({
      ...currentState,
      isLoading: currentState.conversations.length === 0,
      errorMessage: null,
    }));

    try {
      const response = await fetch("/api/conversations", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(response, "Не удалось загрузить список чатов"),
        );
      }

      const data: unknown = await response.json();
      const parsedData = conversationListResponseSchema.parse(data);
      conversationsCache = parsedData.conversations;

      setState({
        conversations: parsedData.conversations,
        isLoading: false,
        errorMessage: null,
      });
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        isLoading: false,
        errorMessage:
          error instanceof Error ? error.message : "Неизвестная ошибка списка чатов",
      }));
    }
  }, []);

  const deleteConversation = useCallback(async (tenderExternalId: string) => {
    const previousCache = conversationsCache;

    setState((currentState) => {
      const nextConversations = currentState.conversations.filter(
        (conversation) => conversation.tender.externalId !== tenderExternalId,
      );
      conversationsCache = nextConversations;

      return {
        conversations: nextConversations,
        isLoading: false,
        errorMessage: null,
      };
    });

    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(tenderExternalId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(response, "Не удалось удалить диалог по тендеру"),
        );
      }
    } catch (error) {
      conversationsCache = previousCache ?? null;
      setState((currentState) => ({
        ...currentState,
        conversations: previousCache ?? currentState.conversations,
        errorMessage:
          error instanceof Error ? error.message : "Не удалось удалить диалог по тендеру",
      }));
      throw error;
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    function handleConversationsUpdated() {
      void loadConversations();
    }

    window.addEventListener(CONVERSATIONS_UPDATED_EVENT, handleConversationsUpdated);

    return () => {
      window.removeEventListener(CONVERSATIONS_UPDATED_EVENT, handleConversationsUpdated);
    };
  }, [loadConversations]);

  return {
    ...state,
    loadConversations,
    deleteConversation,
  };
}
