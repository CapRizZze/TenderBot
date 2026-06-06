import assert from "node:assert/strict";
import test from "node:test";

import { buildChatSystemMessage, findLastUserMessage, formatAttachmentList } from "../lib/services/chatRoutePresentation.ts";
import { buildTendersResponsePayload } from "../lib/services/tendersRoutePresentation.ts";

test("findLastUserMessage returns the latest user message from mixed history", () => {
  const message = findLastUserMessage([
    { role: "assistant", content: "Первый ответ" },
    { role: "user", content: "Первый вопрос" },
    { role: "assistant", content: "Второй ответ" },
    { role: "user", content: "Финальный вопрос" },
  ]);

  assert.deepEqual(message, {
    role: "user",
    content: "Финальный вопрос",
  });
});

test("formatAttachmentList returns fallback label for empty lists", () => {
  assert.equal(formatAttachmentList([], "not loaded"), "not loaded");
  assert.equal(
    formatAttachmentList(
      [
        { name: "spec.pdf", url: "https://files.example/spec.pdf" },
        { name: "price.xlsx", url: "https://files.example/price.xlsx" },
      ],
      "none",
    ),
    "spec.pdf: https://files.example/spec.pdf; price.xlsx: https://files.example/price.xlsx",
  );
});

test("buildChatSystemMessage includes tender context and extracted documents", () => {
  const message = buildChatSystemMessage(
    {
      id: "243100291",
      number: "0166300024726000721",
      title: "Поставка серверов",
      description: "Закупка оборудования",
      customer: "ООО Альфа",
      deadline: "2026-06-20T18:00:00.000Z",
      budget: 12500000,
      url: "https://example.com/tender/243100291",
      attachments: [
        { name: "spec.pdf", url: "https://files.example/spec.pdf" },
      ],
    },
    [{ name: "spec.pdf", url: "https://files.example/spec.pdf" }],
    [
      {
        name: "spec.pdf",
        url: "https://files.example/spec.pdf",
        extractedText: "Техническое задание",
        extractedTextError: null,
      },
    ],
  );

  assert.equal(message.role, "system");
  assert.match(String(message.content), /Title: Поставка серверов/);
  assert.match(String(message.content), /Customer: ООО Альфа/);
  assert.match(String(message.content), /Document: spec\.pdf/);
  assert.match(String(message.content), /Техническое задание/);
});

test("buildTendersResponsePayload includes optional blocks only when present", () => {
  const minimal = buildTendersResponsePayload({
    tenders: [],
  });

  assert.deepEqual(minimal, { tenders: [] });

  const full = buildTendersResponsePayload({
    tenders: [
      {
        id: "243100291",
        title: "Поставка серверов",
        description: "Закупка оборудования",
        customer: "ООО Альфа",
        deadline: "2026-06-20T18:00:00.000Z",
        url: "https://example.com/tender/243100291",
        attachments: [],
      },
    ],
    statistics: {
      dayCounter: 188,
      dayLimit: 200,
      dayRemaining: 12,
    },
    statisticsBefore: {
      dayCounter: 185,
      dayLimit: 200,
      dayRemaining: 15,
    },
    statisticsSpent: {
      usedRequests: 3,
      remainingDelta: 3,
    },
    cleanupDeletedCount: 2,
    warning: "Кэш сохранён частично",
  });

  assert.equal(full.tenders.length, 1);
  assert.deepEqual(full.statisticsSpent, {
    usedRequests: 3,
    remainingDelta: 3,
  });
  assert.deepEqual(full.cleanup, {
    deletedLegacyCount: 2,
  });
  assert.equal(full.warning, "Кэш сохранён частично");
});
