import { SabySourceRefreshPriority, type SabySource } from "@prisma/client";

import { getParserEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { SabySourceDto } from "@/types/saby-source.dto";

export function getConfiguredSabyRequestNames() {
  return (
    getParserEnv().SABY_TENDER_REQUEST_NAMES?.split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? []
  );
}

function buildDefaultSource(requestName: string) {
  return {
    name: requestName,
    requestName,
    description: "",
    includeKeywordsText: "",
    excludeKeywordsText: "",
    refreshPriority: SabySourceRefreshPriority.medium,
    refreshIntervalMin: 1440,
    isActive: true,
  };
}

export async function syncConfiguredSabySources(requestNames?: string[]) {
  const configuredRequestNames = requestNames ?? getConfiguredSabyRequestNames();

  if (configuredRequestNames.length === 0) {
    return findActiveSabySources();
  }

  const existingSources = await prisma.sabySource.findMany({
    where: {
      requestName: {
        in: configuredRequestNames,
      },
    },
    select: {
      requestName: true,
    },
  });

  const existingRequestNames = new Set(
    existingSources.map((source) => source.requestName.toLocaleLowerCase("ru-RU")),
  );

  const missingSources = configuredRequestNames.filter(
    (requestName) =>
      !existingRequestNames.has(requestName.toLocaleLowerCase("ru-RU")),
  );

  if (missingSources.length > 0) {
    await prisma.sabySource.createMany({
      data: missingSources.map((requestName) => buildDefaultSource(requestName)),
      skipDuplicates: true,
    });
  }

  return findActiveSabySources();
}

export async function findActiveSabySources() {
  const sources = await prisma.sabySource.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ refreshPriority: "asc" }, { createdAt: "asc" }],
  });

  return sources.map(mapSabySourceToDto);
}

export function mapSabySourceToDto(source: SabySource): SabySourceDto {
  return {
    id: source.id,
    name: source.name,
    requestName: source.requestName,
    description: source.description,
    includeKeywordsText: source.includeKeywordsText,
    excludeKeywordsText: source.excludeKeywordsText,
    refreshPriority: source.refreshPriority,
    refreshIntervalMin: source.refreshIntervalMin,
    isActive: source.isActive,
  };
}
