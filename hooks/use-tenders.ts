"use client";

import { useCallback, useState } from "react";

import {
  type Tender,
  tenderParserResponseSchema,
} from "@/types/tender-parser.dto";
import { getErrorMessageFromResponse } from "@/utils/api-client";

interface UseTendersState {
  tenders: Tender[];
  isLoading: boolean;
  errorMessage: string | null;
}

interface FetchTendersResponse {
  tenders: Tender[];
}

export function useTenders(initialTenders: Tender[] = []) {
  const [state, setState] = useState<UseTendersState>({
    tenders: initialTenders,
    isLoading: false,
    errorMessage: null,
  });

  const fetchTenders = useCallback(async (keywords: string[]) => {
    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      errorMessage: null,
    }));

    try {
      const response = await fetch("/api/tenders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keywords }),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(
            response,
            "Не удалось загрузить тендеры",
          ),
        );
      }

      const data: unknown = await response.json();
      const parsedData = parseFetchTendersResponse(data);

      setState({
        tenders: parsedData.tenders,
        isLoading: false,
        errorMessage: null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка загрузки тендеров";

      setState((currentState) => ({
        ...currentState,
        isLoading: false,
        errorMessage: message,
      }));
    }
  }, []);

  return {
    ...state,
    fetchTenders,
  };
}

function parseFetchTendersResponse(data: unknown): FetchTendersResponse {
  const responseSchema = tenderParserResponseSchema.transform((tenders) => ({
    tenders,
  }));

  if (
    typeof data === "object" &&
    data !== null &&
    "tenders" in data
  ) {
    const tenders = (data as { tenders: unknown }).tenders;

    return responseSchema.parse(tenders);
  }

  throw new Error("Некорректный формат ответа API тендеров");
}
