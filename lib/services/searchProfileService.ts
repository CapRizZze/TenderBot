import type {
  SabySource,
  SearchProfile,
  SearchProfileRule,
  SearchProfileSabySource,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  findActiveSabySources,
  syncConfiguredSabySources,
} from "@/lib/services/sabySourceService";
import type { SearchProfileDto } from "@/types/search-profile.dto";
import type { SearchProfileUpdateDto } from "@/types/search-profile-update.dto";

type SearchProfileWithRelations = SearchProfile & {
  sources: Array<
    SearchProfileSabySource & {
      sabySource: SabySource;
    }
  >;
  rules: SearchProfileRule[];
};

const DEFAULT_MAIN_PROFILE_NAME = "Основной админ";
const DEFAULT_TEST_PROFILE_NAME = "Тестовый профиль";

const MAIN_PROFILE_DESCRIPTION =
  "Компания занимается разработкой, внедрением и сопровождением программного обеспечения. Релевантны тендеры на ПО, информационные системы, интеграции, поддержку, аналитику и автоматизацию.";

const TEST_PROFILE_DESCRIPTION =
  "Тестовый профиль для сравнения выдачи. Считать релевантными только тендеры с явной IT-составляющей: разработкой ПО, цифровыми сервисами, интеграциями или сопровождением программных продуктов.";

const MAIN_PROFILE_PROMPT =
  "Оцени релевантность тендера для компании-разработчика программного обеспечения. Высокая релевантность: разработка ПО, внедрение информационных систем, интеграции, аналитика, сопровождение ПО, техническая поддержка цифровых сервисов. Низкая релевантность: строительство, ремонт, поставка физического оборудования без IT-составляющей.";

const TEST_PROFILE_PROMPT =
  "Оцени релевантность строго. Профиль ищет только разработку, внедрение или сопровождение программного обеспечения. Не считать релевантными строительные, монтажные, ремонтные работы, поставку пандусов, поручней, тактильной плитки, указателей и других физических конструкций, если нет явной разработки ПО.";

function defaultRulesForMainProfile() {
  return [
    { type: "positive" as const, value: "разработка ПО", weight: 5 },
    { type: "positive" as const, value: "информационная система", weight: 4 },
    { type: "positive" as const, value: "сопровождение ПО", weight: 4 },
    { type: "negative" as const, value: "ремонт", weight: 3 },
    { type: "negative" as const, value: "строительство", weight: 4 },
  ];
}

function defaultRulesForTestProfile() {
  return [
    { type: "positive" as const, value: "программное обеспечение", weight: 6 },
    { type: "positive" as const, value: "разработка", weight: 4 },
    { type: "hard_exclude" as const, value: "пандус", weight: 10 },
    { type: "hard_exclude" as const, value: "поручни", weight: 10 },
    { type: "hard_exclude" as const, value: "строительные работы", weight: 10 },
  ];
}

function createSourceLinkData(sourceIds: string[]) {
  return sourceIds.map((sabySourceId) => ({ sabySourceId }));
}

export async function getOrCreateSearchProfiles(
  userId: string,
  availableRequestNames: string[],
): Promise<SearchProfileDto[]> {
  const existingProfiles = await findSearchProfiles(userId);

  if (existingProfiles.length > 0) {
    return existingProfiles.map(mapSearchProfileToDto);
  }

  const sources = await syncConfiguredSabySources(availableRequestNames);
  const sourceIds = sources.map((source) => source.id);

  if (sourceIds.length === 0) {
    return [];
  }

  await prisma.$transaction(async (transaction) => {
    const mainProfile = await transaction.searchProfile.create({
      data: {
        userId,
        name: DEFAULT_MAIN_PROFILE_NAME,
        description: MAIN_PROFILE_DESCRIPTION,
        scoringPrompt: MAIN_PROFILE_PROMPT,
        isDefault: true,
        sources: {
          create: createSourceLinkData(sourceIds),
        },
        rules: {
          create: defaultRulesForMainProfile(),
        },
      },
    });

    await transaction.searchProfile.create({
      data: {
        userId,
        name: DEFAULT_TEST_PROFILE_NAME,
        description: TEST_PROFILE_DESCRIPTION,
        scoringPrompt: TEST_PROFILE_PROMPT,
        isDefault: false,
        sources: {
          create: createSourceLinkData(sourceIds),
        },
        rules: {
          create: defaultRulesForTestProfile(),
        },
      },
    });

    await transaction.searchProfile.update({
      where: { id: mainProfile.id },
      data: { isDefault: true },
    });
  });

  return (await findSearchProfiles(userId)).map(mapSearchProfileToDto);
}

export async function findSearchProfiles(userId: string) {
  return prisma.searchProfile.findMany({
    where: { userId },
    include: {
      sources: {
        include: {
          sabySource: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      rules: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function findActiveSearchProfile(
  userId: string,
  searchProfileId?: string,
): Promise<SearchProfileWithRelations | null> {
  const profiles = await findSearchProfiles(userId);

  return (
    profiles.find((profile) => profile.id === searchProfileId) ??
    profiles.find((profile) => profile.isDefault) ??
    profiles[0] ??
    null
  );
}

export function mapSearchProfileToDto(
  profile: SearchProfileWithRelations,
): SearchProfileDto {
  const sources = profile.sources.map((link) => ({
    id: link.sabySource.id,
    name: link.sabySource.name,
    requestName: link.sabySource.requestName,
    description: link.sabySource.description,
    includeKeywordsText: link.sabySource.includeKeywordsText,
    excludeKeywordsText: link.sabySource.excludeKeywordsText,
    refreshPriority: link.sabySource.refreshPriority,
    refreshIntervalMin: link.sabySource.refreshIntervalMin,
    isActive: link.sabySource.isActive,
  }));

  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    scoringPrompt: profile.scoringPrompt,
    isDefault: profile.isDefault,
    sources,
    requestNames: sources.map((source) => source.requestName),
    rules: profile.rules.map((rule) => ({
      id: rule.id,
      type: rule.type,
      value: rule.value,
      weight: rule.weight,
    })),
  };
}

export async function updateSearchProfile(
  userId: string,
  searchProfileId: string,
  input: SearchProfileUpdateDto,
) {
  const existingProfile = await prisma.searchProfile.findFirst({
    where: {
      id: searchProfileId,
      userId,
    },
  });

  if (!existingProfile) {
    throw new Error("Профиль поиска не найден.");
  }

  const activeSources = await findActiveSabySources();
  const allowedSourceIds = new Set(activeSources.map((source) => source.id));
  const invalidSourceIds = input.sourceIds.filter((sourceId) => !allowedSourceIds.has(sourceId));

  if (invalidSourceIds.length > 0) {
    throw new Error("Выбраны недоступные источники Saby.");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.searchProfile.update({
      where: { id: searchProfileId },
      data: {
        name: input.name,
        description: input.description,
        scoringPrompt: input.scoringPrompt,
      },
    });

    await transaction.searchProfileSabySource.deleteMany({
      where: { searchProfileId },
    });

    await transaction.searchProfileSabySource.createMany({
      data: input.sourceIds.map((sabySourceId) => ({
        searchProfileId,
        sabySourceId,
      })),
    });

    await transaction.searchProfileRule.deleteMany({
      where: { searchProfileId },
    });

    const nextRules = [
      ...input.rules.positive.map((value) => ({
        searchProfileId,
        type: "positive" as const,
        value,
        weight: 5,
      })),
      ...input.rules.negative.map((value) => ({
        searchProfileId,
        type: "negative" as const,
        value,
        weight: 4,
      })),
      ...input.rules.hardExclude.map((value) => ({
        searchProfileId,
        type: "hard_exclude" as const,
        value,
        weight: 10,
      })),
      ...input.rules.instruction.map((value) => ({
        searchProfileId,
        type: "instruction" as const,
        value,
        weight: 3,
      })),
    ];

    if (nextRules.length > 0) {
      await transaction.searchProfileRule.createMany({
        data: nextRules,
      });
    }
  });

  const updatedProfile = await prisma.searchProfile.findUniqueOrThrow({
    where: { id: searchProfileId },
    include: {
      sources: {
        include: {
          sabySource: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      rules: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return mapSearchProfileToDto(updatedProfile);
}
