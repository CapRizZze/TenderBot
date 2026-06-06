import assert from "node:assert/strict";
import test from "node:test";

import {
  filterAllowedAttachments,
  getMaxTotalAttachmentTextLength,
  limitAttachmentContentsForPrompt,
} from "../lib/services/chatAttachmentPolicy.ts";
import {
  buildRefreshKey,
  getDailyLimitBlockedMessage,
  getRefreshBlockMessage,
  getSabyStatisticsSpent,
} from "../lib/services/tenderRefreshPolicy.ts";

test("buildRefreshKey binds user and request name deterministically", () => {
  assert.equal(buildRefreshKey("user-1", "серверы"), "user-1:серверы");
});

test("getRefreshBlockMessage distinguishes in-flight and cooldown blocks", () => {
  assert.match(
    getRefreshBlockMessage({
      isInFlight: true,
      hasRecentRefresh: false,
    }) ?? "",
    /уже выполняется/i,
  );

  assert.match(
    getRefreshBlockMessage({
      isInFlight: false,
      hasRecentRefresh: true,
    }) ?? "",
    /5 минут/i,
  );

  assert.equal(
    getRefreshBlockMessage({
      isInFlight: false,
      hasRecentRefresh: false,
    }),
    null,
  );
});

test("getDailyLimitBlockedMessage explains why refresh is denied", () => {
  assert.match(getDailyLimitBlockedMessage(), /суточный лимит/i);
  assert.match(getDailyLimitBlockedMessage(), /заблокирован/i);
});

test("getSabyStatisticsSpent returns zero-safe non-negative deltas", () => {
  assert.deepEqual(
    getSabyStatisticsSpent(
      {
        dayCounter: 185,
        dayLimit: 200,
        dayRemaining: 15,
      },
      {
        dayCounter: 188,
        dayLimit: 200,
        dayRemaining: 12,
      },
    ),
    {
      usedRequests: 3,
      remainingDelta: 3,
    },
  );

  assert.deepEqual(
    getSabyStatisticsSpent(
      {
        dayCounter: 188,
        dayLimit: 200,
        dayRemaining: 12,
      },
      {
        dayCounter: 187,
        dayLimit: 200,
        dayRemaining: 13,
      },
    ),
    {
      usedRequests: 0,
      remainingDelta: 0,
    },
  );
});

test("filterAllowedAttachments keeps only attachments saved for the tender", () => {
  const allowed = [
    { name: "spec.pdf", url: "https://files.example/spec.pdf" },
    { name: "price.xlsx", url: "https://files.example/price.xlsx" },
  ];
  const selected = [
    { name: "spec.pdf", url: "https://files.example/spec.pdf" },
    { name: "other.pdf", url: "https://attacker.example/other.pdf" },
  ];

  assert.deepEqual(filterAllowedAttachments(allowed, selected), [
    { name: "spec.pdf", url: "https://files.example/spec.pdf" },
  ]);
});

test("limitAttachmentContentsForPrompt truncates total prompt size and flags overflow", () => {
  const maxLength = getMaxTotalAttachmentTextLength();
  const attachments = limitAttachmentContentsForPrompt([
    {
      name: "first.txt",
      url: "https://files.example/first.txt",
      extractedText: "A".repeat(maxLength - 5),
      extractedTextError: null,
    },
    {
      name: "second.txt",
      url: "https://files.example/second.txt",
      extractedText: "B".repeat(50),
      extractedTextError: null,
    },
    {
      name: "third.txt",
      url: "https://files.example/third.txt",
      extractedText: "C".repeat(50),
      extractedTextError: null,
    },
  ]);

  assert.equal(attachments[0]?.extractedText?.length, maxLength - 5);
  assert.match(attachments[1]?.extractedText ?? "", /\[Текст документа обрезан/i);
  assert.equal(attachments[2]?.extractedText, null);
  assert.match(attachments[2]?.extractedTextError ?? "", /ограничения размера/i);
});
