import { getParserEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { KeywordDto } from "@/types/keyword.dto";

function normalizeRequestName(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

export function getConfiguredSabyRequestNames() {
  return (
    getParserEnv().SABY_TENDER_REQUEST_NAMES?.split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? []
  );
}

export interface IUserKeywordService {
  getOrCreateUserKeywords(userId: string): Promise<KeywordDto[]>;
}

export class UserKeywordService implements IUserKeywordService {
  async getOrCreateUserKeywords(userId: string): Promise<KeywordDto[]> {
    const configuredRequestNames = getConfiguredSabyRequestNames();
    const existingKeywords = await this.findUserKeywords(userId);

    if (configuredRequestNames.length === 0) {
      return existingKeywords;
    }

    const configuredMap = new Map(
      configuredRequestNames.map((requestName) => [
        normalizeRequestName(requestName),
        requestName,
      ]),
    );

    const normalizedExisting = Array.from(
      new Set(
        existingKeywords
          .map((keyword) => configuredMap.get(normalizeRequestName(keyword.value)))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const targetRequestNames =
      normalizedExisting.length > 0 ? normalizedExisting : configuredRequestNames;
    const shouldRewrite =
      existingKeywords.length === 0 ||
      existingKeywords.length !== targetRequestNames.length ||
      existingKeywords.some((keyword, index) => keyword.value !== targetRequestNames[index]);

    if (shouldRewrite) {
      await prisma.$transaction([
        prisma.userKeyword.deleteMany({
          where: {
            userId,
          },
        }),
        prisma.userKeyword.createMany({
          data: targetRequestNames.map((requestName) => ({
            userId,
            value: requestName,
          })),
        }),
      ]);
    }

    return this.findUserKeywords(userId);
  }

  private async findUserKeywords(userId: string): Promise<KeywordDto[]> {
    const keywords = await prisma.userKeyword.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        value: true,
        createdAt: true,
      },
    });

    return keywords.map((keyword) => ({
      ...keyword,
      createdAt: keyword.createdAt.toISOString(),
    }));
  }
}

export const userKeywordService: IUserKeywordService = new UserKeywordService();
