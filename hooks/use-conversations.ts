"use client";

import { useCallback, useEffect, useState } from "react";

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

export function useConversations() {
  const [state, setState] = useState<UseConversationsState>({
    conversations: [],
    isLoading: false,
    errorMessage: null,
  });

  const loadConversations = useCallback(async () => {
    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      errorMessage: null,
    }));

    try {
      const response = await fetch("/api/conversations", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(
            response,
            "Не удалось загрузить список чатов",
          ),
        );
      }

      const data: unknown = await response.json();
      const parsedData = conversationListResponseSchema.parse(data);

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
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка списка чатов",
      }));
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  return {
    ...state,
    loadConversations,
  };
}
