import { Prisma, type Tender as PrismaTender } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tender } from "@/types/tender-parser.dto";

export async function upsertTenderFromParserDto(
  tender: Tender,
): Promise<PrismaTender> {
  const tenderData: Prisma.TenderUncheckedCreateInput = {
    externalId: tender.id,
    title: tender.title,
    description: tender.description,
    customer: tender.customer,
    deadline: new Date(tender.deadline),
    budget:
      typeof tender.budget === "number"
        ? new Prisma.Decimal(tender.budget)
        : undefined,
    url: tender.url,
    source: "unknown",
  };

  return prisma.tender.upsert({
    where: {
      externalId: tender.id,
    },
    create: tenderData,
    update: {
      title: tender.title,
      description: tender.description,
      customer: tender.customer,
      deadline: new Date(tender.deadline),
      budget:
        typeof tender.budget === "number"
          ? new Prisma.Decimal(tender.budget)
          : null,
      url: tender.url,
    },
  });
}
