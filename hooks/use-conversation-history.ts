"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type ConversationHistoryResponseDto,
  conversationHistoryResponseSchema,
} from "@/types/conversation.dto";
import { getErrorMessageFromResponse } from "@/utils/api-client";

interface UseConversationHistoryState {
  conversationId: string | null;
  messages: ConversationHistoryResponseDto["messages"];
  isLoading: boolean;
  errorMessage: string | null;
}

export function useConversationHistory(tenderExternalId?: string) {
  const [state, setState] = useState<UseConversationHistoryState>({
    conversationId: null,
    messages: [],
    isLoading: false,
    errorMessage: null,
  });

  const loadHistory = useCallback(async () => {
    if (!tenderExternalId) {
      setState({
        conversationId: null,
        messages: [],
        isLoading: false,
        errorMessage: null,
      });

      return;
    }

    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      errorMessage: null,
    }));

    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(tenderExternalId)}`,
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(
            response,
            "Не удалось загрузить историю диалога",
          ),
        );
      }

      const data: unknown = await response.json();
      const parsedData = conversationHistoryResponseSchema.parse(data);

      setState({
        conversationId: parsedData.conversationId,
        messages: parsedData.messages,
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
            : "Неизвестная ошибка истории диалога",
      }));
    }
  }, [tenderExternalId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return {
    ...state,
    loadHistory,
  };
}
