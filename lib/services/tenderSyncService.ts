import { upsertTenderFromParserDto } from "@/lib/repositories/tenderRepository";
import type { Tender } from "@/types/tender-parser.dto";

export interface ITenderSyncService {
  syncParsedTenders(userId: string, requestName: string, tenders: Tender[]): Promise<Tender[]>;
}

export class TenderSyncService implements ITenderSyncService {
  async syncParsedTenders(
    userId: string,
    requestName: string,
    tenders: Tender[],
  ): Promise<Tender[]> {
    await Promise.all(
      tenders.map((tender) => upsertTenderFromParserDto(tender, requestName, userId)),
    );

    return tenders;
  }
}

export const tenderSyncService: ITenderSyncService = new TenderSyncService();
