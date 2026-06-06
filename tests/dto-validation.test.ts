import assert from "node:assert/strict";
import test from "node:test";

import { chatRequestDtoSchema } from "../types/chat.dto.ts";
import {
  tenderAttachmentDtoSchema,
  tenderKeywordsSchema,
  tenderParserDtoSchema,
  tendersRequestSchema,
} from "../types/tender-parser.dto.ts";

const validTender = {
  id: "243100291",
  title: "Поставка серверов",
  description: "Закупка оборудования",
  customer: "ООО Альфа",
  deadline: "2026-06-20T18:00:00.000Z",
  url: "https://example.com/tender/243100291",
};

test("chatRequestDtoSchema applies default selectedAttachments", () => {
  const parsed = chatRequestDtoSchema.parse({
    tender: validTender,
    messages: [{ role: "user", content: "Проанализируй тендер" }],
  });

  assert.deepEqual(parsed.selectedAttachments, []);
});

test("chatRequestDtoSchema rejects empty message content", () => {
  assert.throws(
    () =>
      chatRequestDtoSchema.parse({
        tender: validTender,
        messages: [{ role: "user", content: "   " }],
      }),
    /Сообщение не может быть пустым/,
  );
});

test("tenderAttachmentDtoSchema rejects invalid attachment url", () => {
  assert.throws(
    () =>
      tenderAttachmentDtoSchema.parse({
        name: "spec.pdf",
        url: "not-a-url",
      }),
    /валидным URL/,
  );
});

test("tenderParserDtoSchema requires ISO deadline and positive budget", () => {
  assert.throws(
    () =>
      tenderParserDtoSchema.parse({
        ...validTender,
        deadline: "20.06.2026",
        budget: -1,
      }),
    /Срок подачи должен быть в формате ISO|Цена контракта должна быть положительным числом/,
  );
});

test("tenderKeywordsSchema trims and rejects empty keyword sets", () => {
  assert.deepEqual(tenderKeywordsSchema.parse([" серверы ", "аналитика"]), [
    "серверы",
    "аналитика",
  ]);

  assert.throws(() => tenderKeywordsSchema.parse(["   "]), /RequestName не может быть пустым/);
});

test("tendersRequestSchema validates top-level keywords payload", () => {
  const parsed = tendersRequestSchema.parse({
    keywords: ["серверы", "поддержка"],
  });

  assert.deepEqual(parsed, {
    keywords: ["серверы", "поддержка"],
  });
});
