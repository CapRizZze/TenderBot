import {
  Prisma,
  type Tender as PrismaTender,
  type TenderAttachment as PrismaTenderAttachment,
  type TenderRequestName as PrismaTenderRequestName,
  type TenderProfileScore as PrismaTenderProfileScore,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isSabyUrl } from "@/lib/tender-parser/tenderParserService";
import type { Tender, TenderAttachment } from "@/types/tender-parser.dto";

interface UpdateTenderAttachmentExtractedTextInput {
  extractedText?: string | null;
  extractedTextAt?: Date | null;
  extractedTextError?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

export async function upsertTenderFromParserDto(
  tender: Tender,
  requestName?: string,
  userId?: string,
): Promise<PrismaTender> {
  const sourceUrl = normalizeSourceUrl(tender);
  const sabyUrl = normalizeSabyUrl(tender);
  const tenderData: Prisma.TenderUncheckedCreateInput = {
    externalId: tender.id,
    number: tender.number,
    title: tender.title,
    description: tender.description,
    customer: tender.customer,
    placedAt: tender.placedAt ? new Date(tender.placedAt) : undefined,
    deadline: new Date(tender.deadline),
    budget:
      typeof tender.budget === "number"
        ? new Prisma.Decimal(tender.budget)
        : undefined,
    url: tender.url,
    sourceUrl,
    sabyUrl,
    source: "unknown",
  };

  return prisma.$transaction(async (transaction) => {
    const savedTender = await transaction.tender.upsert({
      where: {
        externalId: tender.id,
      },
      create: tenderData,
      update: {
        number: tender.number ?? null,
        title: tender.title,
        description: tender.description,
        customer: tender.customer,
        placedAt: tender.placedAt ? new Date(tender.placedAt) : null,
        deadline: new Date(tender.deadline),
        budget:
          typeof tender.budget === "number"
            ? new Prisma.Decimal(tender.budget)
            : null,
        url: tender.url,
        sourceUrl,
        sabyUrl,
      },
    });

    if (tender.attachments.length > 0) {
      const attachmentUrls = tender.attachments.map((attachment) => attachment.url);

      await transaction.tenderAttachment.deleteMany({
        where: {
          tenderId: savedTender.id,
          url: {
            notIn: attachmentUrls,
          },
        },
      });

      for (const attachment of tender.attachments) {
        await transaction.tenderAttachment.upsert({
          where: {
            tenderId_url: {
              tenderId: savedTender.id,
              url: attachment.url,
            },
          },
          create: {
            tenderId: savedTender.id,
            name: attachment.name,
            url: attachment.url,
            mimeType: attachment.mimeType,
            size: attachment.size,
          },
          update: {
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
          },
        });
      }
    }

    if (requestName?.trim() && userId) {
      await transaction.tenderRequestName.upsert({
        where: {
          userId_tenderId_requestName: {
            userId,
            tenderId: savedTender.id,
            requestName: requestName.trim(),
          },
        },
        create: {
          userId,
          tenderId: savedTender.id,
          requestName: requestName.trim(),
        },
        update: {},
      });
    }

    return savedTender;
  });
}

export async function findCachedTendersByKeyword(
  userId: string,
  keyword: string,
  take = 50,
  searchProfileId?: string,
): Promise<Tender[]> {
  const normalizedKeyword = keyword.trim();

  if (normalizedKeyword.length === 0) {
    const tenders = await prisma.tender.findMany({
      where: {
        requestNames: {
          some: {
            userId,
          },
        },
      },
      include: {
        attachments: true,
        requestNames: true,
        profileScores: buildProfileScoreInclude(searchProfileId),
      },
      orderBy: {
        updatedAt: "desc",
      },
      take,
    });

    return tenders.map(mapPrismaTenderToParserDto);
  }

  const directMatches = await prisma.tender.findMany({
    where: {
      requestNames: {
        some: {
          userId,
          requestName: {
            equals: normalizedKeyword,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      },
    },
    include: {
      attachments: true,
      requestNames: true,
      profileScores: buildProfileScoreInclude(searchProfileId),
    },
    orderBy: {
      updatedAt: "desc",
    },
    take,
  });

  if (directMatches.length > 0) {
    return directMatches.map(mapPrismaTenderToParserDto);
  }

  const fallbackMatches = await prisma.tender.findMany({
    where: {
      AND: [
        {
          requestNames: {
            some: {
              userId,
            },
          },
        },
        {
          OR: [
            {
              title: {
                contains: normalizedKeyword,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              description: {
                contains: normalizedKeyword,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              customer: {
                contains: normalizedKeyword,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        },
      ],
    },
    include: {
      attachments: true,
      requestNames: true,
      profileScores: buildProfileScoreInclude(searchProfileId),
    },
    orderBy: {
      updatedAt: "desc",
    },
    take,
  });

  return fallbackMatches.map(mapPrismaTenderToParserDto);
}

export async function deleteLegacyCachedTendersByKeyword(
  userId: string,
  keyword: string,
  keepExternalIds: string[] = [],
): Promise<number> {
  const normalizedKeyword = keyword.trim();

  if (normalizedKeyword.length === 0) {
    return 0;
  }

  const requestNameLinks = await prisma.tenderRequestName.findMany({
    where: {
      requestName: {
        equals: normalizedKeyword,
        mode: Prisma.QueryMode.insensitive,
      },
      userId,
      ...(keepExternalIds.length > 0
        ? {
            tender: {
              externalId: {
                notIn: keepExternalIds,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (requestNameLinks.length > 0) {
    const result = await prisma.tenderRequestName.deleteMany({
      where: {
        id: {
          in: requestNameLinks.map((link) => link.id),
        },
      },
    });

    return result.count;
  }

  return 0;
}

export async function findCachedTenderByExternalId(
  externalId: string,
  userId?: string,
): Promise<Tender | null> {
  const tender = await prisma.tender.findUnique({
    where: {
      externalId,
    },
    include: {
      attachments: true,
      requestNames: userId
        ? {
            where: {
              userId,
            },
          }
        : true,
    },
  });

  if (userId && tender && tender.requestNames.length === 0) {
    return null;
  }

  return tender ? mapPrismaTenderToParserDto(tender) : null;
}

export async function findStoredTenderByExternalId(externalId: string, userId?: string) {
  return prisma.tender.findUnique({
    where: {
      externalId,
    },
    include: {
      attachments: true,
      requestNames: userId
        ? {
            where: {
              userId,
            },
          }
        : true,
    },
  });
}

export async function replaceTenderAttachments(
  externalId: string,
  attachments: TenderAttachment[],
): Promise<TenderAttachment[]> {
  const tender = await prisma.tender.findUnique({
    where: {
      externalId,
    },
    select: {
      id: true,
    },
  });

  if (!tender) {
    return attachments;
  }

  const attachmentUrls = attachments.map((attachment) => attachment.url);

  await prisma.$transaction(async (transaction) => {
    await transaction.tenderAttachment.deleteMany({
      where: {
        tenderId: tender.id,
        url: {
          notIn: attachmentUrls,
        },
      },
    });

    for (const attachment of attachments) {
      await transaction.tenderAttachment.upsert({
        where: {
          tenderId_url: {
            tenderId: tender.id,
            url: attachment.url,
          },
        },
        create: {
          tenderId: tender.id,
          name: attachment.name,
          url: attachment.url,
          mimeType: attachment.mimeType,
          size: attachment.size,
        },
        update: {
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
        },
      });
    }
  });

  const updatedTender = await findCachedTenderByExternalId(externalId);

  return updatedTender?.attachments ?? attachments;
}

export async function findTenderAttachmentsByExternalIdAndUrls(
  externalId: string,
  urls: string[],
): Promise<PrismaTenderAttachment[]> {
  if (urls.length === 0) {
    return [];
  }

  return prisma.tenderAttachment.findMany({
    where: {
      url: {
        in: urls,
      },
      tender: {
        externalId,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function updateTenderAttachmentExtractedText(
  attachmentId: string,
  input: UpdateTenderAttachmentExtractedTextInput,
): Promise<PrismaTenderAttachment> {
  return prisma.tenderAttachment.update({
    where: {
      id: attachmentId,
    },
    data: {
      extractedText: input.extractedText ?? null,
      extractedTextAt: input.extractedTextAt ?? null,
      extractedTextError: input.extractedTextError ?? null,
      mimeType: input.mimeType ?? undefined,
      size: input.size ?? undefined,
    },
  });
}

type PrismaTenderWithRelations = PrismaTender & {
  attachments?: PrismaTenderAttachment[];
  requestNames?: PrismaTenderRequestName[];
  profileScores?: PrismaTenderProfileScore[];
};

function mapPrismaTenderToParserDto(tender: PrismaTenderWithRelations): Tender {
  return {
    id: tender.externalId,
    ...(tender.number ? { number: tender.number } : {}),
    title: tender.title,
    description: tender.description,
    customer: tender.customer,
    ...(tender.placedAt ? { placedAt: tender.placedAt.toISOString() } : {}),
    deadline: tender.deadline.toISOString(),
    url: tender.url,
    ...(tender.sourceUrl ? { sourceUrl: tender.sourceUrl } : {}),
    ...(tender.sabyUrl ? { sabyUrl: tender.sabyUrl } : {}),
    source: tender.source,
    ...(tender.profileScores?.[0]
      ? {
          profileScore: {
            score: tender.profileScores[0].score,
            verdict: tender.profileScores[0].verdict,
            ...(tender.profileScores[0].userVerdict
              ? { userVerdict: tender.profileScores[0].userVerdict }
              : {}),
            ...(tender.profileScores[0].userComment
              ? { userComment: tender.profileScores[0].userComment }
              : {}),
            reasons: normalizeJsonStringArray(tender.profileScores[0].reasons),
            positiveSignals: normalizeJsonStringArray(
              tender.profileScores[0].positiveSignals ?? [],
            ),
            negativeSignals: normalizeJsonStringArray(
              tender.profileScores[0].negativeSignals ?? [],
            ),
            suggestedRules: normalizeJsonStringArray(
              tender.profileScores[0].suggestedRules ?? [],
            ),
          },
        }
      : {}),
    attachments:
      tender.attachments?.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
        ...(attachment.size ? { size: attachment.size } : {}),
      })) ?? [],
    ...(tender.budget ? { budget: tender.budget.toNumber() } : {}),
  };
}

function buildProfileScoreInclude(searchProfileId?: string) {
  return searchProfileId
    ? {
        where: {
          searchProfileId,
        },
        take: 1,
      }
    : false;
}

function normalizeJsonStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeSourceUrl(tender: Tender): string | null {
  if (tender.sourceUrl) {
    return tender.sourceUrl;
  }

  if (!isSabyUrl(tender.url)) {
    return tender.url;
  }

  return null;
}

function normalizeSabyUrl(tender: Tender): string | null {
  if (tender.sabyUrl) {
    return tender.sabyUrl;
  }

  if (isSabyUrl(tender.url)) {
    return tender.url;
  }

  return null;
}
