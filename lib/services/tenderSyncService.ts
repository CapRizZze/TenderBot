import { upsertTenderFromParserDto } from "@/lib/repositories/tenderRepository";
import type { Tender } from "@/types/tender-parser.dto";

export interface ITenderSyncService {
  syncParsedTenders(tenders: Tender[]): Promise<Tender[]>;
}

export class TenderSyncService implements ITenderSyncService {
  async syncParsedTenders(tenders: Tender[]): Promise<Tender[]> {
    // Синхронизация не меняет DTO парсера: UI продолжает работать с внешним
    // контрактом, а PostgreSQL получает актуальную копию найденных тендеров.
    await Promise.all(
      tenders.map((tender) => upsertTenderFromParserDto(tender)),
    );

    return tenders;
  }
}

export const tenderSyncService: ITenderSyncService = new TenderSyncService();
