import { prisma } from "@/lib/prisma";

function normalizeText(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
}

export class SearchProfileMigrationService {
  async mapLegacySourceToQuery(requestName: string): Promise<number | null> {
    const normalizedRequestName = normalizeText(requestName);

    if (!normalizedRequestName) {
      return null;
    }

    const queries = await prisma.sabyQuery.findMany({
      where: {
        isActive: true,
      },
      select: {
        sabyQueryId: true,
        name: true,
        ftsString: true,
        parentFolderName: true,
      },
      orderBy: [{ parentFolderName: "asc" }, { name: "asc" }],
    });

    const exactMatch = queries.find(
      (query) => normalizeText(query.name) === normalizedRequestName,
    );

    if (exactMatch) {
      return exactMatch.sabyQueryId;
    }

    const tokenSet = new Set(normalizedRequestName.split(" ").filter(Boolean));
    const scoredMatch = queries
      .map((query) => {
        const haystack = normalizeText(
          [query.name, query.ftsString, query.parentFolderName]
            .filter(Boolean)
            .join(" "),
        );

        let score = 0;

        for (const token of tokenSet) {
          if (haystack.includes(token)) {
            score += 1;
          }
        }

        if (score > 0 && haystack.includes(normalizedRequestName)) {
          score += 3;
        }

        return {
          sabyQueryId: query.sabyQueryId,
          score,
        };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)[0];

    return scoredMatch?.sabyQueryId ?? null;
  }

  async migrateProfileSourcesToQueries(searchProfileId: string): Promise<number> {
    const profile = await prisma.searchProfile.findUnique({
      where: {
        id: searchProfileId,
      },
      include: {
        sources: {
          include: {
            sabySource: true,
          },
        },
        queries: true,
      },
    });

    if (!profile) {
      throw new Error("Search profile not found.");
    }

    const existingLinkedQueryIds = new Set(
      profile.queries.map((query) => query.sabyQueryId),
    );
    const queryIdsToAttach: string[] = [];

    for (const sourceLink of profile.sources) {
      const sabyQueryId = await this.mapLegacySourceToQuery(
        sourceLink.sabySource.requestName,
      );

      if (!sabyQueryId) {
        continue;
      }

      const query = await prisma.sabyQuery.findUnique({
        where: {
          sabyQueryId,
        },
        select: {
          id: true,
        },
      });

      if (!query || existingLinkedQueryIds.has(query.id)) {
        continue;
      }

      existingLinkedQueryIds.add(query.id);
      queryIdsToAttach.push(query.id);
    }

    if (queryIdsToAttach.length > 0) {
      await prisma.searchProfileSabyQuery.createMany({
        data: queryIdsToAttach.map((sabyQueryId) => ({
          searchProfileId,
          sabyQueryId,
        })),
        skipDuplicates: true,
      });
    }

    return queryIdsToAttach.length;
  }

  async migrateAllProfilesToQueries(): Promise<{ profilesCount: number; attachedQueriesCount: number }> {
    const profiles = await prisma.searchProfile.findMany({
      select: {
        id: true,
      },
    });

    let attachedQueriesCount = 0;

    for (const profile of profiles) {
      attachedQueriesCount += await this.migrateProfileSourcesToQueries(profile.id);
    }

    return {
      profilesCount: profiles.length,
      attachedQueriesCount,
    };
  }
}

export const searchProfileMigrationService = new SearchProfileMigrationService();
