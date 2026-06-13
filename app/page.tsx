import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getParserEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  findCachedTenderByExternalId,
  findCachedTendersByKeyword,
} from "@/lib/repositories/tenderRepository";
import { buildSabyQueryCacheKey } from "@/lib/saby-query";
import { findRecentSabyApiCallLogs } from "@/lib/services/sabyApiCallLogService";
import {
  findActiveSearchProfile,
  getOrCreateSearchProfiles,
  mapSearchProfileToDto,
} from "@/lib/services/searchProfileService";
import { fetchTenderParserDailyLimitStatistics } from "@/lib/tender-parser/tenderParserService";
import type { SabyApiCallLogEntry } from "@/types/saby-api-log.dto";
import type { SabyQueryDto } from "@/types/saby-query.dto";
import type { SearchProfileDto } from "@/types/search-profile.dto";
import type { SabyDailyLimitStatistics, Tender } from "@/types/tender-parser.dto";

interface HomePageProps {
  searchParams?: {
    tenderId?: string;
    requestName?: string;
    queryId?: string;
    profileId?: string;
  };
}

function hasLegacySabyCache(tenders: Array<{ id: string; number?: string }>) {
  return tenders.some((tender) => !tender.number || !/^\d+$/.test(tender.id));
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const parserEnv = getParserEnv();
  const isRpcMode =
    parserEnv.TENDER_PARSER_MODE === "saby" &&
    parserEnv.SABY_INTEGRATION_MODE === "rpc";
  let searchProfiles: SearchProfileDto[] = [];
  let availableQueries: SabyQueryDto[] = [];

  try {
    searchProfiles = await getOrCreateSearchProfiles(session.user.id);
  } catch (error) {
    console.error("Failed to load search profiles", error);
  }

  if (isRpcMode) {
    try {
      const queries = await prisma.sabyQuery.findMany({
        where: {
          isActive: true,
        },
        include: {
          folder: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ name: "asc" }],
      });

      availableQueries = queries.map((query) => ({
        id: query.id,
        sabyQueryId: query.sabyQueryId,
        folderId: query.folderId,
        folderName: query.folder?.name ?? null,
        name: query.name,
        parentFolderName: query.parentFolderName,
        ftsString: query.ftsString,
        ftsStringExclude: query.ftsStringExclude,
        isActive: query.isActive,
        lastSyncedAt: query.lastSyncedAt?.toISOString(),
      }));
    } catch (error) {
      console.error("Failed to load Saby queries", error);
    }
  }

  const activeSearchProfileRecord = await findActiveSearchProfile(
    session.user.id,
    searchParams?.profileId,
  );
  const activeSearchProfile = activeSearchProfileRecord
    ? mapSearchProfileToDto(activeSearchProfileRecord)
    : searchProfiles[0];

  const requestedQueryId = searchParams?.queryId?.trim();
  const activeQuery =
    isRpcMode && activeSearchProfile?.queries.length
      ? requestedQueryId
        ? activeSearchProfile.queries.find((query) => query.id === requestedQueryId) ??
          activeSearchProfile.queries[0]
        : activeSearchProfile.queries[0]
      : null;

  const defaultRequestName =
    activeQuery?.name ??
    activeSearchProfile?.queries[0]?.name ??
    availableQueries[0]?.name ??
    "разработка";
  const requestedRequestName = searchParams?.requestName?.trim();
  const activeRequestName = activeQuery
    ? activeQuery.name
    : requestedRequestName
      ? requestedRequestName
      : defaultRequestName;
  const activeCacheKey = activeQuery
    ? buildSabyQueryCacheKey(activeQuery.id)
    : activeRequestName;

  let tenders: Tender[] = [];
  let tendersLoadError: string | null = null;
  let sabyDailyLimitStatistics: SabyDailyLimitStatistics | null = null;
  let recentSabyApiCalls: SabyApiCallLogEntry[] = [];
  let activeTender = null as Awaited<ReturnType<typeof findCachedTenderByExternalId>>;

  if (parserEnv.TENDER_PARSER_MODE === "saby") {
    try {
      sabyDailyLimitStatistics = await fetchTenderParserDailyLimitStatistics();
      recentSabyApiCalls = await findRecentSabyApiCallLogs();
    } catch (error) {
      console.error("Failed to load Saby daily limit statistics", error);
    }
  }

  try {
    tenders = await findCachedTendersByKeyword(
      session.user.id,
      activeCacheKey,
      10,
      activeSearchProfile?.id,
    );
  } catch (error) {
    console.error("Failed to load cached tenders", error);
  }

  if (parserEnv.TENDER_PARSER_MODE === "saby") {
    if (tenders.length === 0) {
      tendersLoadError =
        "В локальном кэше пока нет тендеров по этому запросу. Для тестов используйте кнопку «Обновить из Saby вручную», чтобы не тратить лимит на автоматические перерисовки страницы.";
    } else if (hasLegacySabyCache(tenders)) {
      tendersLoadError =
        "Показаны сохранённые тендеры из локального кэша. Среди них есть старые записи без корректного номера. Обновляйте вручную только при необходимости.";
    } else {
      tendersLoadError =
        "Показаны сохранённые тендеры из локального кэша. Saby API не вызывается автоматически, чтобы не расходовать суточный лимит.";
    }
  }

  if (parserEnv.TENDER_PARSER_MODE === "saby" && recentSabyApiCalls.length === 0) {
    try {
      recentSabyApiCalls = await findRecentSabyApiCallLogs();
    } catch (error) {
      console.error("Failed to load recent Saby API call logs", error);
    }
  }

  if (searchParams?.tenderId) {
    try {
      activeTender = await findCachedTenderByExternalId(
        searchParams.tenderId,
        session.user.id,
      );
    } catch (error) {
      console.error("Failed to load active tender by external id", error);
    }
  }

  if (!activeTender && searchParams?.tenderId && tenders.length > 0) {
    activeTender =
      tenders.find((cachedTender) => cachedTender.id === searchParams.tenderId) ?? null;
  }

  return (
    <AppShell
      activeQueryId={activeQuery?.id}
      activeTender={activeTender ?? undefined}
      activeTenderId={searchParams?.tenderId}
      activeRequestName={activeRequestName}
      activeSearchProfile={activeSearchProfile}
      availableQueries={availableQueries}
      canSyncSabyStructure={isRpcMode}
      recentSabyApiCalls={recentSabyApiCalls}
      sabyDailyLimitStatistics={sabyDailyLimitStatistics}
      searchProfiles={searchProfiles}
      tendersLoadError={tendersLoadError}
      tenders={tenders}
    />
  );
}
