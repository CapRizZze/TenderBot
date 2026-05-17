import { prisma } from "@/lib/prisma";
import type { KeywordDto } from "@/types/keyword.dto";

const DEFAULT_KEYWORDS = ["серверы", "аналитика", "поддержка"];

export interface IUserKeywordService {
  getOrCreateUserKeywords(userId: string): Promise<KeywordDto[]>;
}

export class UserKeywordService implements IUserKeywordService {
  async getOrCreateUserKeywords(userId: string): Promise<KeywordDto[]> {
    const existingKeywords = await this.findUserKeywords(userId);

    if (existingKeywords.length > 0) {
      return existingKeywords;
    }

    await prisma.userKeyword.createMany({
      data: DEFAULT_KEYWORDS.map((keyword) => ({
        userId,
        value: keyword,
      })),
    });

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

export const userKeywordService: IUserKeywordService =
  new UserKeywordService();
