import { ZodError } from "zod";

export interface ApiErrorResponse {
  error: {
    message: string;
    details?: unknown;
  };
}

export function toApiErrorResponse(error: unknown): ApiErrorResponse {
  if (error instanceof ZodError) {
    return {
      error: {
        message: "Ошибка валидации входных данных",
        details: error.flatten(),
      },
    };
  }

  if (error instanceof Error) {
    return {
      error: {
        message: error.message,
      },
    };
  }

  return {
    error: {
      message: "Неизвестная ошибка сервера",
    },
  };
}

export function getApiErrorStatus(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }

  return 500;
}
