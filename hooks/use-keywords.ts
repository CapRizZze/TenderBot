"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type KeywordDto,
  keywordsResponseSchema,
  updateKeywordsRequestSchema,
} from "@/types/keyword.dto";
import { getErrorMessageFromResponse } from "@/utils/api-client";

interface UseKeywordsState {
  keywords: KeywordDto[];
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string | null;
}

export function useKeywords(initialKeywords: KeywordDto[] = []) {
  const [state, setState] = useState<UseKeywordsState>({
    keywords: initialKeywords,
    isLoading: false,
    isSaving: false,
    errorMessage: null,
  });

  const loadKeywords = useCallback(async () => {
    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      errorMessage: null,
    }));

    try {
      const response = await fetch("/api/keywords", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(
            response,
            "Не удалось загрузить ключевые слова",
          ),
        );
      }

      const data: unknown = await response.json();
      const parsedData = keywordsResponseSchema.parse(data);

      setState((currentState) => ({
        ...currentState,
        keywords: parsedData.keywords,
        isLoading: false,
        errorMessage: null,
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        isLoading: false,
        errorMessage: getErrorMessage(error),
      }));
    }
  }, []);

  const saveKeywords = useCallback(async (values: string[]) => {
    setState((currentState) => ({
      ...currentState,
      isSaving: true,
      errorMessage: null,
    }));

    try {
      const payload = updateKeywordsRequestSchema.parse({
        keywords: values,
      });

      const response = await fetch("/api/keywords", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(
            response,
            "Не удалось сохранить ключевые слова",
          ),
        );
      }

      const data: unknown = await response.json();
      const parsedData = keywordsResponseSchema.parse(data);

      setState((currentState) => ({
        ...currentState,
        keywords: parsedData.keywords,
        isSaving: false,
        errorMessage: null,
      }));

      return parsedData.keywords;
    } catch (error) {
      const message = getErrorMessage(error);

      setState((currentState) => ({
        ...currentState,
        isSaving: false,
        errorMessage: message,
      }));

      return null;
    }
  }, []);

  useEffect(() => {
    if (initialKeywords.length === 0) {
      void loadKeywords();
    }
  }, [initialKeywords.length, loadKeywords]);

  return {
    ...state,
    loadKeywords,
    saveKeywords,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Неизвестная ошибка ключевых слов";
}
