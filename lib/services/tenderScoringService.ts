import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import type {
  SearchProfile,
  SearchProfileRequestName,
  SearchProfileRule,
  Tender as PrismaTender,
} from "@prisma/client";

import { getDeepSeekEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { Tender } from "@/types/tender-parser.dto";

type SearchProfileWithRelations = SearchProfile & {
  requestNames: SearchProfileRequestName[];
  rules: SearchProfileRule[];
};

interface ParsedScore {
  score: number;
  verdict: "relevant" | "maybe" | "irrelevant";
  reasons: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  suggestedRules: string[];
}

interface ParsedProfileRule {
  type: "positive" | "negative" | "hard_exclude" | "instruction";
  value: string;
  weight: number;
}

const deepSeekEnv = getDeepSeekEnv();

const deepSeek = createOpenAICompatible({
  name: "deepseek",
  apiKey: deepSeekEnv.DEEPSEEK_API_KEY,
  baseURL: deepSeekEnv.DEEPSEEK_BASE_URL,
});

export async function scoreTendersForRequestName(input: {
  userId: string;
  requestName: string;
  tenders: Tender[];
}) {
  const profiles = await prisma.searchProfile.findMany({
    where: {
      userId: input.userId,
      requestNames: {
        some: {
          requestName: {
            equals: input.requestName,
            mode: "insensitive",
          },
        },
      },
    },
    include: {
      requestNames: true,
      rules: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (profiles.length === 0 || input.tenders.length === 0) {
    return;
  }

  for (const profile of profiles) {
    for (const tender of input.tenders) {
      await scoreTenderForProfile(profile, tender);
    }
  }
}

export async function saveTenderScoreFeedback(input: {
  userId: string;
  tenderExternalId: string;
  searchProfileId: string;
  verdict: "relevant" | "maybe" | "irrelevant";
  comment?: string;
  applyToProfile?: boolean;
}) {
  const scoreRecord = await prisma.tenderProfileScore.findFirst({
    where: {
      searchProfileId: input.searchProfileId,
      tender: {
        externalId: input.tenderExternalId,
        requestNames: {
          some: {
            userId: input.userId,
          },
        },
      },
      searchProfile: {
        userId: input.userId,
      },
    },
    include: {
      tender: true,
      searchProfile: {
        include: {
          requestNames: true,
          rules: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!scoreRecord) {
    throw new Error("Не удалось найти score по тендеру и профилю.");
  }

  const normalizedComment = input.comment?.trim() || null;

  await prisma.tenderProfileScore.update({
    where: {
      tenderId_searchProfileId: {
        tenderId: scoreRecord.tenderId,
        searchProfileId: scoreRecord.searchProfileId,
      },
    },
    data: {
      userVerdict: input.verdict,
      userComment: normalizedComment,
    },
  });

  let createdRules: ParsedProfileRule[] = [];

  if (input.applyToProfile) {
    createdRules = await generateAndApplyProfileRulesFromFeedback({
      profile: scoreRecord.searchProfile,
      tender: scoreRecord.tender,
      scoreRecord: {
        score: scoreRecord.score,
        verdict: scoreRecord.verdict,
        reasons: normalizeStringArray(scoreRecord.reasons),
        positiveSignals: normalizeStringArray(scoreRecord.positiveSignals),
        negativeSignals: normalizeStringArray(scoreRecord.negativeSignals),
        suggestedRules: normalizeStringArray(scoreRecord.suggestedRules),
      },
      targetVerdict: input.verdict,
      comment: normalizedComment,
    });
  }

  return {
    verdict: input.verdict,
    comment: normalizedComment,
    createdRules,
  };
}

async function scoreTenderForProfile(
  profile: SearchProfileWithRelations,
  tender: Tender,
) {
  const storedTender = await prisma.tender.findUnique({
    where: { externalId: tender.id },
  });

  if (!storedTender) {
    return;
  }

  const parsedScore = await requestDeepSeekScore(profile, tender);

  await upsertTenderProfileScore({
    tender: storedTender,
    profile,
    score: parsedScore,
  });
}

async function requestDeepSeekScore(
  profile: SearchProfileWithRelations,
  tender: Tender,
): Promise<ParsedScore> {
  const result = await generateText({
    model: deepSeek(deepSeekEnv.DEEPSEEK_MODEL),
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          "You score tender card relevance for a SaaS tender filtering product.",
          "Return only strict JSON without markdown.",
          "Schema: {\"score\":0-100,\"verdict\":\"relevant|maybe|irrelevant\",\"reasons\":[\"...\"],\"positiveSignals\":[\"...\"],\"negativeSignals\":[\"...\"],\"suggestedRules\":[\"...\"]}.",
          "Score 80-100 means clearly relevant, 40-79 means maybe, 0-39 means irrelevant.",
          profile.scoringPrompt,
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          profile: {
            name: profile.name,
            description: profile.description,
            rules: profile.rules.map((rule) => ({
              type: rule.type,
              value: rule.value,
              weight: rule.weight,
            })),
            requestNames: profile.requestNames.map((link) => link.requestName),
          },
          tender: {
            title: tender.title,
            description: tender.description,
            customer: tender.customer,
            budget: tender.budget ?? null,
            deadline: tender.deadline,
            placedAt: tender.placedAt ?? null,
            number: tender.number ?? null,
          },
        }),
      },
    ],
  });

  return normalizeScoreResponse(result.text);
}

async function generateAndApplyProfileRulesFromFeedback(input: {
  profile: SearchProfileWithRelations;
  tender: PrismaTender;
  scoreRecord: ParsedScore;
  targetVerdict: "relevant" | "maybe" | "irrelevant";
  comment: string | null;
}) {
  const generatedRules = await requestDeepSeekProfileRules(input);
  const createdRules: ParsedProfileRule[] = [];

  for (const rule of generatedRules) {
    const normalizedValue = rule.value.trim();

    if (normalizedValue.length === 0) {
      continue;
    }

    const existingRule = await prisma.searchProfileRule.findFirst({
      where: {
        searchProfileId: input.profile.id,
        type: rule.type,
        value: {
          equals: normalizedValue,
          mode: "insensitive",
        },
      },
    });

    if (existingRule) {
      continue;
    }

    await prisma.searchProfileRule.create({
      data: {
        searchProfileId: input.profile.id,
        type: rule.type,
        value: normalizedValue,
        weight: rule.weight,
      },
    });

    createdRules.push({
      type: rule.type,
      value: normalizedValue,
      weight: rule.weight,
    });
  }

  return createdRules;
}

async function requestDeepSeekProfileRules(input: {
  profile: SearchProfileWithRelations;
  tender: PrismaTender;
  scoreRecord: ParsedScore;
  targetVerdict: "relevant" | "maybe" | "irrelevant";
  comment: string | null;
}) {
  const result = await generateText({
    model: deepSeek(deepSeekEnv.DEEPSEEK_MODEL),
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          "You generate durable profile rules for tender relevance filtering.",
          "Return only strict JSON without markdown.",
          'Schema: {"rules":[{"type":"positive|negative|hard_exclude|instruction","value":"...","weight":1-10}]}',
          "Prefer concrete reusable rules, not one-off summaries.",
          "If target verdict is irrelevant, bias toward negative or hard_exclude rules.",
          "If target verdict is relevant, bias toward positive or instruction rules.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          profile: {
            name: input.profile.name,
            description: input.profile.description,
            scoringPrompt: input.profile.scoringPrompt,
            existingRules: input.profile.rules.map((rule) => ({
              type: rule.type,
              value: rule.value,
              weight: rule.weight,
            })),
          },
          tender: {
            title: input.tender.title,
            description: input.tender.description,
            customer: input.tender.customer,
            budget: input.tender.budget?.toString() ?? null,
            deadline: input.tender.deadline.toISOString(),
            placedAt: input.tender.placedAt?.toISOString() ?? null,
            number: input.tender.number ?? null,
          },
          currentScore: input.scoreRecord,
          userDecision: {
            verdict: input.targetVerdict,
            comment: input.comment,
          },
        }),
      },
    ],
  });

  const jsonText = result.text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(jsonText) as {
    rules?: Array<Partial<ParsedProfileRule>>;
  };

  if (!Array.isArray(parsed.rules)) {
    return [];
  }

  return parsed.rules
    .map((rule) => normalizeProfileRule(rule))
    .filter((rule): rule is ParsedProfileRule => Boolean(rule))
    .slice(0, 5);
}

async function upsertTenderProfileScore(input: {
  tender: PrismaTender;
  profile: SearchProfileWithRelations;
  score: ParsedScore;
}) {
  await prisma.tenderProfileScore.upsert({
    where: {
      tenderId_searchProfileId: {
        tenderId: input.tender.id,
        searchProfileId: input.profile.id,
      },
    },
    create: {
      tenderId: input.tender.id,
      searchProfileId: input.profile.id,
      score: input.score.score,
      verdict: input.score.verdict,
      reasons: input.score.reasons,
      positiveSignals: input.score.positiveSignals,
      negativeSignals: input.score.negativeSignals,
      suggestedRules: input.score.suggestedRules,
      model: deepSeekEnv.DEEPSEEK_MODEL,
    },
    update: {
      score: input.score.score,
      verdict: input.score.verdict,
      reasons: input.score.reasons,
      positiveSignals: input.score.positiveSignals,
      negativeSignals: input.score.negativeSignals,
      suggestedRules: input.score.suggestedRules,
      model: deepSeekEnv.DEEPSEEK_MODEL,
    },
  });
}

function normalizeScoreResponse(rawText: string): ParsedScore {
  const jsonText = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(jsonText) as Partial<ParsedScore>;
  const score = clampScore(Number(parsed.score ?? 0));
  const verdict =
    parsed.verdict === "relevant" ||
    parsed.verdict === "maybe" ||
    parsed.verdict === "irrelevant"
      ? parsed.verdict
      : score >= 80
        ? "relevant"
        : score >= 40
          ? "maybe"
          : "irrelevant";

  return {
    score,
    verdict,
    reasons: normalizeStringArray(parsed.reasons),
    positiveSignals: normalizeStringArray(parsed.positiveSignals),
    negativeSignals: normalizeStringArray(parsed.negativeSignals),
    suggestedRules: normalizeStringArray(parsed.suggestedRules),
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);
}

function normalizeProfileRule(
  value: Partial<ParsedProfileRule> | null | undefined,
): ParsedProfileRule | null {
  if (!value?.type || !value?.value) {
    return null;
  }

  if (
    value.type !== "positive" &&
    value.type !== "negative" &&
    value.type !== "hard_exclude" &&
    value.type !== "instruction"
  ) {
    return null;
  }

  const normalizedValue = value.value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  const weight = Math.min(10, Math.max(1, Math.round(Number(value.weight ?? 5))));

  return {
    type: value.type,
    value: normalizedValue,
    weight,
  };
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}
