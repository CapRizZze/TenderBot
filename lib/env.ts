import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),
});

const authEnvSchema = z.object({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),
  EMAIL_SERVER_HOST: z.string().min(1, "EMAIL_SERVER_HOST is required"),
  EMAIL_SERVER_PORT: z.coerce
    .number()
    .int()
    .positive("EMAIL_SERVER_PORT must be a positive number"),
  EMAIL_SERVER_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  EMAIL_SERVER_REQUIRE_TLS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  EMAIL_SERVER_USER: z.string().min(1, "EMAIL_SERVER_USER is required"),
  EMAIL_SERVER_PASSWORD: z
    .string()
    .min(1, "EMAIL_SERVER_PASSWORD is required"),
  EMAIL_FROM: z.string().min(1, "EMAIL_FROM is required"),
});

const deepSeekEnvSchema = z.object({
  DEEPSEEK_API_KEY: z.string().min(1, "DEEPSEEK_API_KEY is required"),
  DEEPSEEK_BASE_URL: z
    .string()
    .url("DEEPSEEK_BASE_URL must be a valid URL"),
  DEEPSEEK_MODEL: z.string().min(1, "DEEPSEEK_MODEL is required"),
});

const parserEnvSchema = z
  .object({
    TENDER_PARSER_MODE: z.enum(["mock", "rest", "saby"]).default("mock"),
    TENDER_PARSER_API_URL: z.string().url().optional(),
    SABY_AUTH_URL: z.string().url().optional(),
    SABY_TENDER_API_URL: z.string().url().optional(),
    SABY_LOGIN: z.string().optional(),
    SABY_PASSWORD: z.string().optional(),
    SABY_TENDER_METHODS: z.string().optional(),
    SABY_TENDER_REQUEST_NAMES: z.string().optional(),
    SABY_PAGE_SIZE: z.coerce.number().int().min(1).max(200).optional(),
  })
  .superRefine((value, context) => {
    if (value.TENDER_PARSER_MODE === "rest" && !value.TENDER_PARSER_API_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "TENDER_PARSER_API_URL is required in rest mode",
        path: ["TENDER_PARSER_API_URL"],
      });
    }

    if (value.TENDER_PARSER_MODE === "saby") {
      if (!value.SABY_AUTH_URL) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SABY_AUTH_URL is required in saby mode",
          path: ["SABY_AUTH_URL"],
        });
      }

      if (!value.SABY_TENDER_API_URL) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SABY_TENDER_API_URL is required in saby mode",
          path: ["SABY_TENDER_API_URL"],
        });
      }

      if (!value.SABY_LOGIN) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SABY_LOGIN is required in saby mode",
          path: ["SABY_LOGIN"],
        });
      }

      if (!value.SABY_PASSWORD) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SABY_PASSWORD is required in saby mode",
          path: ["SABY_PASSWORD"],
        });
      }
    }
  });

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

export function getDeepSeekEnv() {
  return deepSeekEnvSchema.parse({
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
  });
}

export function getParserEnv() {
  return parserEnvSchema.parse({
    TENDER_PARSER_MODE: process.env.TENDER_PARSER_MODE,
    TENDER_PARSER_API_URL: process.env.TENDER_PARSER_API_URL,
    SABY_AUTH_URL: process.env.SABY_AUTH_URL,
    SABY_TENDER_API_URL: process.env.SABY_TENDER_API_URL,
    SABY_LOGIN: process.env.SABY_LOGIN,
    SABY_PASSWORD: process.env.SABY_PASSWORD,
    SABY_TENDER_METHODS: process.env.SABY_TENDER_METHODS,
    SABY_TENDER_REQUEST_NAMES: process.env.SABY_TENDER_REQUEST_NAMES,
    SABY_PAGE_SIZE: process.env.SABY_PAGE_SIZE,
  });
}
