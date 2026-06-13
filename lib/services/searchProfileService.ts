import type {
  SabyFolder,
  SabyQuery,
  SearchProfile,
  SearchProfileRule,
  SearchProfileSabyQuery,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { SearchProfileDto } from "@/types/search-profile.dto";
import type { SearchProfileUpdateDto } from "@/types/search-profile-update.dto";

type SearchProfileWithRelations = SearchProfile & {
  queries: Array<
    SearchProfileSabyQuery & {
      sabyQuery: SabyQuery & {
        folder: SabyFolder | null;
      };
    }
  >;
  rules: SearchProfileRule[];
};

const DEFAULT_MAIN_PROFILE_NAME = "РћСЃРЅРѕРІРЅРѕР№ Р°РґРјРёРЅ";
const DEFAULT_TEST_PROFILE_NAME = "РўРµСЃС‚РѕРІС‹Р№ РїСЂРѕС„РёР»СЊ";

const MAIN_PROFILE_DESCRIPTION =
  "РљРѕРјРїР°РЅРёСЏ Р·Р°РЅРёРјР°РµС‚СЃСЏ СЂР°Р·СЂР°Р±РѕС‚РєРѕР№, РІРЅРµРґСЂРµРЅРёРµРј Рё СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµРј РїСЂРѕРіСЂР°РјРјРЅРѕРіРѕ РѕР±РµСЃРїРµС‡РµРЅРёСЏ. Р РµР»РµРІР°РЅС‚РЅС‹ С‚РµРЅРґРµСЂС‹ РЅР° РџРћ, РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅС‹Рµ СЃРёСЃС‚РµРјС‹, РёРЅС‚РµРіСЂР°С†РёРё, РїРѕРґРґРµСЂР¶РєСѓ, Р°РЅР°Р»РёС‚РёРєСѓ Рё Р°РІС‚РѕРјР°С‚РёР·Р°С†РёСЋ.";

const TEST_PROFILE_DESCRIPTION =
  "РўРµСЃС‚РѕРІС‹Р№ РїСЂРѕС„РёР»СЊ РґР»СЏ СЃСЂР°РІРЅРµРЅРёСЏ РІС‹РґР°С‡Рё. РЎС‡РёС‚Р°С‚СЊ СЂРµР»РµРІР°РЅС‚РЅС‹РјРё С‚РѕР»СЊРєРѕ С‚РµРЅРґРµСЂС‹ СЃ СЏРІРЅРѕР№ IT-СЃРѕСЃС‚Р°РІР»СЏСЋС‰РµР№: СЂР°Р·СЂР°Р±РѕС‚РєРѕР№ РџРћ, С†РёС„СЂРѕРІС‹РјРё СЃРµСЂРІРёСЃР°РјРё, РёРЅС‚РµРіСЂР°С†РёСЏРјРё РёР»Рё СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµРј РїСЂРѕРіСЂР°РјРјРЅС‹С… РїСЂРѕРґСѓРєС‚РѕРІ.";

const MAIN_PROFILE_PROMPT =
  "РћС†РµРЅРё СЂРµР»РµРІР°РЅС‚РЅРѕСЃС‚СЊ С‚РµРЅРґРµСЂР° РґР»СЏ РєРѕРјРїР°РЅРёРё-СЂР°Р·СЂР°Р±РѕС‚С‡РёРєР° РїСЂРѕРіСЂР°РјРјРЅРѕРіРѕ РѕР±РµСЃРїРµС‡РµРЅРёСЏ. Р’С‹СЃРѕРєР°СЏ СЂРµР»РµРІР°РЅС‚РЅРѕСЃС‚СЊ: СЂР°Р·СЂР°Р±РѕС‚РєР° РџРћ, РІРЅРµРґСЂРµРЅРёРµ РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅС‹С… СЃРёСЃС‚РµРј, РёРЅС‚РµРіСЂР°С†РёРё, Р°РЅР°Р»РёС‚РёРєР°, СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ РџРћ, С‚РµС…РЅРёС‡РµСЃРєР°СЏ РїРѕРґРґРµСЂР¶РєР° С†РёС„СЂРѕРІС‹С… СЃРµСЂРІРёСЃРѕРІ. РќРёР·РєР°СЏ СЂРµР»РµРІР°РЅС‚РЅРѕСЃС‚СЊ: СЃС‚СЂРѕРёС‚РµР»СЊСЃС‚РІРѕ, СЂРµРјРѕРЅС‚, РїРѕСЃС‚Р°РІРєР° С„РёР·РёС‡РµСЃРєРѕРіРѕ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ Р±РµР· IT-СЃРѕСЃС‚Р°РІР»СЏСЋС‰РµР№.";

const TEST_PROFILE_PROMPT =
  "РћС†РµРЅРё СЂРµР»РµРІР°РЅС‚РЅРѕСЃС‚СЊ СЃС‚СЂРѕРіРѕ. РџСЂРѕС„РёР»СЊ РёС‰РµС‚ С‚РѕР»СЊРєРѕ СЂР°Р·СЂР°Р±РѕС‚РєСѓ, РІРЅРµРґСЂРµРЅРёРµ РёР»Рё СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ РїСЂРѕРіСЂР°РјРјРЅРѕРіРѕ РѕР±РµСЃРїРµС‡РµРЅРёСЏ. РќРµ СЃС‡РёС‚Р°С‚СЊ СЂРµР»РµРІР°РЅС‚РЅС‹РјРё СЃС‚СЂРѕРёС‚РµР»СЊРЅС‹Рµ, РјРѕРЅС‚Р°Р¶РЅС‹Рµ, СЂРµРјРѕРЅС‚РЅС‹Рµ СЂР°Р±РѕС‚С‹, РїРѕСЃС‚Р°РІРєСѓ РїР°РЅРґСѓСЃРѕРІ, РїРѕСЂСѓС‡РЅРµР№, С‚Р°РєС‚РёР»СЊРЅРѕР№ РїР»РёС‚РєРё, СѓРєР°Р·Р°С‚РµР»РµР№ Рё РґСЂСѓРіРёС… С„РёР·РёС‡РµСЃРєРёС… РєРѕРЅСЃС‚СЂСѓРєС†РёР№, РµСЃР»Рё РЅРµС‚ СЏРІРЅРѕР№ СЂР°Р·СЂР°Р±РѕС‚РєРё РџРћ.";

function defaultRulesForMainProfile() {
  return [
    { type: "positive" as const, value: "СЂР°Р·СЂР°Р±РѕС‚РєР° РџРћ", weight: 5 },
    { type: "positive" as const, value: "РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅР°СЏ СЃРёСЃС‚РµРјР°", weight: 4 },
    { type: "positive" as const, value: "СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ РџРћ", weight: 4 },
    { type: "negative" as const, value: "СЂРµРјРѕРЅС‚", weight: 3 },
    { type: "negative" as const, value: "СЃС‚СЂРѕРёС‚РµР»СЊСЃС‚РІРѕ", weight: 4 },
  ];
}

function defaultRulesForTestProfile() {
  return [
    { type: "positive" as const, value: "РїСЂРѕРіСЂР°РјРјРЅРѕРµ РѕР±РµСЃРїРµС‡РµРЅРёРµ", weight: 6 },
    { type: "positive" as const, value: "СЂР°Р·СЂР°Р±РѕС‚РєР°", weight: 4 },
    { type: "hard_exclude" as const, value: "РїР°РЅРґСѓСЃ", weight: 10 },
    { type: "hard_exclude" as const, value: "РїРѕСЂСѓС‡РЅРё", weight: 10 },
    { type: "hard_exclude" as const, value: "СЃС‚СЂРѕРёС‚РµР»СЊРЅС‹Рµ СЂР°Р±РѕС‚С‹", weight: 10 },
  ];
}

function createQueryLinkData(queryIds: string[]) {
  return queryIds.map((sabyQueryId) => ({ sabyQueryId }));
}

export async function getOrCreateSearchProfiles(
  userId: string,
): Promise<SearchProfileDto[]> {
  const existingProfiles = await findSearchProfiles(userId);

  if (existingProfiles.length > 0) {
    return existingProfiles.map(mapSearchProfileToDto);
  }

  const activeQueries = await prisma.sabyQuery.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
    },
    orderBy: [{ name: "asc" }],
  });
  const queryIds = activeQueries.map((query) => query.id);

  if (queryIds.length === 0) {
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
        queries: {
          create: createQueryLinkData(queryIds),
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
        queries: {
          create: createQueryLinkData(queryIds),
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
      queries: {
        include: {
          sabyQuery: {
            include: {
              folder: true,
            },
          },
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
  const queries = profile.queries.map((link) => ({
    id: link.sabyQuery.id,
    sabyQueryId: link.sabyQuery.sabyQueryId,
    folderId: link.sabyQuery.folderId,
    folderName: link.sabyQuery.folder?.name ?? null,
    name: link.sabyQuery.name,
    parentFolderName: link.sabyQuery.parentFolderName,
    ftsString: link.sabyQuery.ftsString,
    ftsStringExclude: link.sabyQuery.ftsStringExclude,
    isActive: link.sabyQuery.isActive,
    lastSyncedAt: link.sabyQuery.lastSyncedAt?.toISOString(),
  }));

  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    scoringPrompt: profile.scoringPrompt,
    isDefault: profile.isDefault,
    queries,
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
    throw new Error("РџСЂРѕС„РёР»СЊ РїРѕРёСЃРєР° РЅРµ РЅР°Р№РґРµРЅ.");
  }

  const activeQueries = await prisma.sabyQuery.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
    },
  });
  const allowedQueryIds = new Set(activeQueries.map((query) => query.id));
  const invalidQueryIds = input.queryIds.filter(
    (queryId) => !allowedQueryIds.has(queryId),
  );

  if (invalidQueryIds.length > 0) {
    throw new Error("Р’С‹Р±СЂР°РЅС‹ РЅРµРґРѕСЃС‚СѓРїРЅС‹Рµ Р·Р°РїСЂРѕСЃС‹ Saby.");
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

    await transaction.searchProfileSabyQuery.deleteMany({
      where: { searchProfileId },
    });

    if (input.queryIds.length > 0) {
      await transaction.searchProfileSabyQuery.createMany({
        data: input.queryIds.map((sabyQueryId) => ({
          searchProfileId,
          sabyQueryId,
        })),
      });
    }

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
      queries: {
        include: {
          sabyQuery: {
            include: {
              folder: true,
            },
          },
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
