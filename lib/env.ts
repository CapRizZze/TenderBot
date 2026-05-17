import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL должен быть валидным PostgreSQL URL"),
});

const authEnvSchema = z.object({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET должен быть не короче 32 символов"),
  AUTH_URL: z.string().url("AUTH_URL должен быть валидным URL"),
  EMAIL_SERVER_HOST: z.string().min(1, "EMAIL_SERVER_HOST обязателен"),
  EMAIL_SERVER_PORT: z.coerce
    .number()
    .int()
    .positive("EMAIL_SERVER_PORT должен быть положительным числом"),
  EMAIL_SERVER_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  EMAIL_SERVER_REQUIRE_TLS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  EMAIL_SERVER_USER: z.string().min(1, "EMAIL_SERVER_USER обязателен"),
  EMAIL_SERVER_PASSWORD: z
    .string()
    .min(1, "EMAIL_SERVER_PASSWORD обязателен"),
  EMAIL_FROM: z.string().min(1, "EMAIL_FROM обязателен"),
});

const qwenEnvSchema = z.object({
  QWEN_API_KEY: z.string().min(1, "QWEN_API_KEY обязателен"),
  QWEN_BASE_URL: z.string().url("QWEN_BASE_URL должен быть валидным URL"),
  QWEN_MODEL: z.string().min(1, "QWEN_MODEL обязателен"),
});

const parserEnvSchema = z
  .object({
    TENDER_PARSER_MODE: z.enum(["mock", "rest"]).default("mock"),
    TENDER_PARSER_API_URL: z.string().url().optional(),
  })
  .superRefine((value, context) => {
    if (value.TENDER_PARSER_MODE === "rest" && !value.TENDER_PARSER_API_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "TENDER_PARSER_API_URL обязателен в режиме rest",
        path: ["TENDER_PARSER_API_URL"],
      });
    }
  });

// Env разделен по зонам использования, чтобы mock-парсер не требовал SMTP/Qwen,
// а chat route не требовал SMTP-настройки.
export function getDatabaseEnv() {
  return databaseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
}

export function getAuthEnv() {
  return authEnvSchema.parse({
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
    EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
    EMAIL_SERVER_SECURE: process.env.EMAIL_SERVER_SECURE,
    EMAIL_SERVER_REQUIRE_TLS: process.env.EMAIL_SERVER_REQUIRE_TLS,
    EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
    EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
  });
}

export function getQwenEnv() {
  return qwenEnvSchema.parse({
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    QWEN_BASE_URL: process.env.QWEN_BASE_URL,
    QWEN_MODEL: process.env.QWEN_MODEL,
  });
}

export function getParserEnv() {
  return parserEnvSchema.parse({
    TENDER_PARSER_MODE: process.env.TENDER_PARSER_MODE,
    TENDER_PARSER_API_URL: process.env.TENDER_PARSER_API_URL,
  });
}
