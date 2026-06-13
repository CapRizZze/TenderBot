import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import type {
  SabyQuery,
  SabySource,
  SearchProfile,
  SearchProfileSabyQuery,
  SearchProfileRule,
  SearchProfileSabySource,
  Tender as PrismaTender,
} from "@prisma/client";

import { getDeepSeekEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { Tender } from "@/types/tender-parser.dto";

type SearchProfileWithRelations = SearchProfile & {
  sources: Array<
    SearchProfileSabySource & {
      sabySource: SabySource;
    }
  >;
  queries: Array<
    SearchProfileSabyQuery & {
      sabyQuery: SabyQuery;
    }
  >;
  rules: SearchProfileRule[];
};

interface ParsedScore {
  score: number;
  verdict: "relevant" | "maybe" | "irrelevant";
  reasons: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  suggestedRules: string[];
  model?: string;
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

const LOCAL_SCORING_MODEL = "local-rules";

export async function scoreTendersForRequestName(input: {
  userId: string;
  requestName: string;
  tenders: Tender[];
  sabyQueryId?: string;
}) {
  const profiles = await prisma.searchProfile.findMany({
    where: {
      userId: input.userId,
      OR: [
        {
          ...(input.sabyQueryId
            ? {
                queries: {
                  some: {
                    sabyQueryId: input.sabyQueryId,
                  },
                },
              }
            : {}),
        },
        {
          sources: {
            some: {
              sabySource: {
                requestName: {
                  equals: input.requestName,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ],
    },
    include: {
      sources: {
        include: {
          sabySource: true,
        },
      },
      queries: {
        include: {
          sabyQuery: true,
        },
      },
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
          sources: {
            include: {
              sabySource: true,
            },
          },
          queries: {
            include: {
              sabyQuery: true,
            },
          },
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
  if (!hasUsableDeepSeekKey()) {
    return scoreTenderLocally(profile, tender);
  }

  try {
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
              sabySources: profile.sources.map((link) => ({
                id: link.sabySource.id,
                name: link.sabySource.name,
                requestName: link.sabySource.requestName,
                description: link.sabySource.description,
                includeKeywordsText: link.sabySource.includeKeywordsText,
                excludeKeywordsText: link.sabySource.excludeKeywordsText,
              })),
              sabyQueries: profile.queries.map((link) => ({
                id: link.sabyQuery.id,
                sabyQueryId: link.sabyQuery.sabyQueryId,
                name: link.sabyQuery.name,
                parentFolderName: link.sabyQuery.parentFolderName,
                ftsString: link.sabyQuery.ftsString,
                ftsStringExclude: link.sabyQuery.ftsStringExclude,
              })),
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
  } catch (error) {
    console.error("DeepSeek scoring failed, falling back to local rules", error);
    return scoreTenderLocally(profile, tender);
  }
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
  if (!hasUsableDeepSeekKey()) {
    return [];
  }

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
            sabySources: input.profile.sources.map((link) => ({
              id: link.sabySource.id,
              name: link.sabySource.name,
              requestName: link.sabySource.requestName,
              description: link.sabySource.description,
              includeKeywordsText: link.sabySource.includeKeywordsText,
              excludeKeywordsText: link.sabySource.excludeKeywordsText,
            })),
            existingRules: input.profile.rules.map((rule) => ({
              type: rule.type,
              value: rule.value,
              weight: rule.weight,
            })),
            sabyQueries: input.profile.queries.map((link) => ({
              id: link.sabyQuery.id,
              sabyQueryId: link.sabyQuery.sabyQueryId,
              name: link.sabyQuery.name,
              parentFolderName: link.sabyQuery.parentFolderName,
              ftsString: link.sabyQuery.ftsString,
              ftsStringExclude: link.sabyQuery.ftsStringExclude,
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
      model: input.score.model ?? deepSeekEnv.DEEPSEEK_MODEL,
    },
    update: {
      score: input.score.score,
      verdict: input.score.verdict,
      reasons: input.score.reasons,
      positiveSignals: input.score.positiveSignals,
      negativeSignals: input.score.negativeSignals,
      suggestedRules: input.score.suggestedRules,
      model: input.score.model ?? deepSeekEnv.DEEPSEEK_MODEL,
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
    model: deepSeekEnv.DEEPSEEK_MODEL,
  };
}

function hasUsableDeepSeekKey() {
  const normalizedKey = deepSeekEnv.DEEPSEEK_API_KEY.trim().toLowerCase();

  return (
    normalizedKey.length > 0 &&
    !normalizedKey.includes("placeholder") &&
    !normalizedKey.includes("changeme") &&
    !normalizedKey.includes("example") &&
    !normalizedKey.startsWith("dev-")
  );
}

function scoreTenderLocally(
  profile: SearchProfileWithRelations,
  tender: Tender,
): ParsedScore {
  const searchableText = [
    tender.title,
    tender.description,
    tender.customer,
    tender.number,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .join(" \n ")
    .toLocaleLowerCase("ru-RU");

  let totalScore = 50;
  const reasons: string[] = [];
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  const suggestedRules: string[] = [];
  let hardExcluded = false;

  for (const rule of profile.rules) {
    const normalizedRuleValue = rule.value.trim();

    if (normalizedRuleValue.length === 0) {
      continue;
    }

    const normalizedNeedle = normalizedRuleValue.toLocaleLowerCase("ru-RU");
    const isMatch = searchableText.includes(normalizedNeedle);

    if (rule.type === "instruction") {
      if (suggestedRules.length < 6) {
        suggestedRules.push(normalizedRuleValue);
      }
      continue;
    }

    if (!isMatch) {
      continue;
    }

    if (rule.type === "positive") {
      totalScore += Math.max(4, rule.weight * 6);
      if (positiveSignals.length < 6) {
        positiveSignals.push(normalizedRuleValue);
      }
      if (reasons.length < 6) {
        reasons.push(`Совпало позитивное правило: ${normalizedRuleValue}`);
      }
      continue;
    }

    if (rule.type === "negative") {
      totalScore -= Math.max(4, rule.weight * 6);
      if (negativeSignals.length < 6) {
        negativeSignals.push(normalizedRuleValue);
      }
      if (reasons.length < 6) {
        reasons.push(`Совпало негативное правило: ${normalizedRuleValue}`);
      }
      continue;
    }

    hardExcluded = true;
    totalScore = Math.min(totalScore, 10);
    if (negativeSignals.length < 6) {
      negativeSignals.push(normalizedRuleValue);
    }
    if (reasons.length < 6) {
      reasons.push(`Сработало исключающее правило: ${normalizedRuleValue}`);
    }
  }

  if (reasons.length === 0) {
    reasons.push(
      hardExcluded
        ? "Тендер локально помечен как нерелевантный по исключающим правилам."
        : "Локальная оценка выполнена по правилам профиля без ответа DeepSeek.",
    );
  }

  const score = clampScore(totalScore);
  const verdict: ParsedScore["verdict"] = hardExcluded
    ? "irrelevant"
    : score >= 80
      ? "relevant"
      : score >= 40
        ? "maybe"
        : "irrelevant";

  return {
    score,
    verdict,
    reasons,
    positiveSignals,
    negativeSignals,
    suggestedRules,
    model: LOCAL_SCORING_MODEL,
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
