import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getParserEnv } from "@/lib/env";
import {
  findCachedTenderByExternalId,
  findCachedTendersByKeyword,
} from "@/lib/repositories/tenderRepository";
import { findRecentSabyApiCallLogs } from "@/lib/services/sabyApiCallLogService";
import {
  findActiveSearchProfile,
  getOrCreateSearchProfiles,
  mapSearchProfileToDto,
} from "@/lib/services/searchProfileService";
import {
  getConfiguredSabyRequestNames,
  userKeywordService,
} from "@/lib/services/userKeywordService";
import { fetchTenderParserDailyLimitStatistics } from "@/lib/tender-parser/tenderParserService";
import type { KeywordDto } from "@/types/keyword.dto";
import type { SabyApiCallLogEntry } from "@/types/saby-api-log.dto";
import type { SearchProfileDto } from "@/types/search-profile.dto";
import type { SabyDailyLimitStatistics, Tender } from "@/types/tender-parser.dto";

interface HomePageProps {
  searchParams?: {
    tenderId?: string;
    requestName?: string;
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
  const envRequestNames = getConfiguredSabyRequestNames();
  let initialKeywords: KeywordDto[] = [];
  let searchProfiles: SearchProfileDto[] = [];

  try {
    initialKeywords = await userKeywordService.getOrCreateUserKeywords(session.user.id);
  } catch (error) {
    console.error("Failed to load user keywords", error);
  }

  try {
    searchProfiles = await getOrCreateSearchProfiles(session.user.id, envRequestNames);
  } catch (error) {
    console.error("Failed to load search profiles", error);
  }

  const activeSearchProfileRecord = await findActiveSearchProfile(
    session.user.id,
    searchParams?.profileId,
  );
  const activeSearchProfile = activeSearchProfileRecord
    ? mapSearchProfileToDto(activeSearchProfileRecord)
    : searchProfiles[0];

  const requestNames =
    activeSearchProfile?.requestNames.length
      ? activeSearchProfile.requestNames
      : initialKeywords.length > 0
        ? initialKeywords.map((keyword) => keyword.value)
        : envRequestNames;
  const defaultRequestName = requestNames[0] ?? "разработка";
  const requestedRequestName = searchParams?.requestName?.trim();
  const activeRequestName =
    requestedRequestName && requestNames.includes(requestedRequestName)
      ? requestedRequestName
      : defaultRequestName;

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
      activeRequestName,
      50,
      activeSearchProfile?.id,
    );
  } catch (error) {
    console.error("Failed to load cached tenders", error);
  }

  if (parserEnv.TENDER_PARSER_MODE === "saby") {
    if (tenders.length === 0) {
      tendersLoadError =
        "В локальном кэше пока нет тендеров по этому RequestName. Для тестов используйте кнопку «Обновить из Saby вручную», чтобы не тратить лимит на автоматические перерисовки страницы.";
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
      activeTender={activeTender ?? undefined}
      activeTenderId={searchParams?.tenderId}
      activeRequestName={activeRequestName}
      activeSearchProfile={activeSearchProfile}
      availableRequestNames={envRequestNames}
      initialKeywords={initialKeywords}
      recentSabyApiCalls={recentSabyApiCalls}
      requestNames={requestNames}
      sabyDailyLimitStatistics={sabyDailyLimitStatistics}
      searchProfiles={searchProfiles}
      tendersLoadError={tendersLoadError}
      tenders={tenders}
    />
  );
}
