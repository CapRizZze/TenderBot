import { prisma } from "@/lib/prisma";

export interface DraftSearchProfile {
  name: string;
  description: string;
  scoringPrompt: string;
  sourceIds: string[];
  queryIds: string[];
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export class SearchProfileOnboardingService {
  async buildDraftProfileFromAnswers(
    answers: Record<string, string>,
  ): Promise<DraftSearchProfile | null> {
    const summary = [answers.company, answers.focus, answers.exclude]
      .filter(Boolean)
      .join(". ")
      .trim();

    if (!summary) {
      return null;
    }

    const queryIds = await this.selectMatchingQueries(summary);
    const sourceIds = await this.selectMatchingSources(summary);

    return {
      name: answers.profileName?.trim() || "Новый профиль",
      description: summary,
      scoringPrompt: this.buildScoringPrompt(summary),
      sourceIds,
      queryIds,
    };
  }

  async selectMatchingQueries(profileText: string): Promise<string[]> {
    const normalizedProfileText = normalizeText(profileText);
    const tokens = normalizedProfileText.split(" ").filter(Boolean);

    const queries = await prisma.sabyQuery.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        ftsString: true,
        ftsStringExclude: true,
      },
    });

    return queries
      .map((query) => {
        const haystack = normalizeText(
          [query.name, query.ftsString, query.ftsStringExclude].join(" "),
        );
        const score = tokens.reduce(
          (sum, token) => (haystack.includes(token) ? sum + 1 : sum),
          0,
        );

        return {
          id: query.id,
          score,
        };
      })
      .filter((query) => query.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)
      .map((query) => query.id);
  }

  async selectMatchingSources(profileText: string): Promise<string[]> {
    const normalizedProfileText = normalizeText(profileText);
    const sources = await prisma.sabySource.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        requestName: true,
        description: true,
      },
    });

    return unique(
      sources
        .filter((source) => {
          const haystack = normalizeText(
            [source.name, source.requestName, source.description].join(" "),
          );

          return haystack.length > 0 && normalizedProfileText.includes(haystack);
        })
        .map((source) => source.id),
    );
  }

  buildScoringPrompt(summary: string): string {
    return [
      "Оцени релевантность тендера для профиля компании.",
      `Контекст профиля: ${summary}.`,
      "Считай релевантными только тендеры, где требования и предмет закупки действительно совпадают с этим профилем.",
      "Если совпадение поверхностное или формальное, понижай оценку.",
    ].join(" ");
  }
}

export const searchProfileOnboardingService =
  new SearchProfileOnboardingService();
