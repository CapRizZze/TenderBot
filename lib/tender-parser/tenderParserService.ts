import {
  type Tender,
  tenderKeywordsSchema,
  tenderParserResponseSchema,
} from "@/types/tender-parser.dto";
import { getParserEnv } from "@/lib/env";

export interface ITenderParserService {
  fetchTendersByKeywords(keywords: string[]): Promise<Tender[]>;
}

export class TenderParserService implements ITenderParserService {
  async fetchTendersByKeywords(keywords: string[]): Promise<Tender[]> {
    const validatedKeywords = tenderKeywordsSchema.parse(keywords);

    // MVP-заглушка имитирует внешний REST-парсер.
    // Позже здесь можно заменить массив на fetch(TENDER_PARSER_API_URL).
    const mockedTenders: Tender[] = [
      {
        id: "zakupki-001",
        title: "Поставка серверного оборудования",
        description:
          "Закупка серверов, систем хранения данных и сетевого оборудования для модернизации инфраструктуры.",
        customer: "ГБУ Информационные системы",
        deadline: "2026-06-20T18:00:00.000Z",
        budget: 12_500_000,
        url: "https://example.com/tenders/zakupki-001",
      },
      {
        id: "commercial-002",
        title: "Разработка модуля аналитики закупок",
        description:
          "Коммерческий тендер на разработку веб-модуля аналитики, отчетности и интеграции с внутренней CRM.",
        customer: "ООО Торговая платформа",
        deadline: "2026-07-05T15:00:00.000Z",
        budget: 4_800_000,
        url: "https://example.com/tenders/commercial-002",
      },
      {
        id: "zakupki-003",
        title: "Сопровождение информационной системы",
        description:
          "Оказание услуг технической поддержки, мониторинга и доработки действующей информационной системы.",
        customer: "ФКУ Центр цифровых решений",
        deadline: "2026-06-30T12:00:00.000Z",
        url: "https://example.com/tenders/zakupki-003",
      },
    ];

    const normalizedKeywords = validatedKeywords.map((keyword) =>
      keyword.toLocaleLowerCase("ru-RU"),
    );

    const filteredTenders = mockedTenders.filter((tender) => {
      const searchableText = [
        tender.title,
        tender.description,
        tender.customer,
      ]
        .join(" ")
        .toLocaleLowerCase("ru-RU");

      return normalizedKeywords.some((keyword) =>
        searchableText.includes(keyword),
      );
    });

    return tenderParserResponseSchema.parse(filteredTenders);
  }
}

export class RestTenderParserService implements ITenderParserService {
  async fetchTendersByKeywords(keywords: string[]): Promise<Tender[]> {
    const validatedKeywords = tenderKeywordsSchema.parse(keywords);
    const parserEnv = getParserEnv();

    if (!parserEnv.TENDER_PARSER_API_URL) {
      throw new Error("TENDER_PARSER_API_URL обязателен для REST-парсера");
    }

    const url = new URL(parserEnv.TENDER_PARSER_API_URL);

    validatedKeywords.forEach((keyword) => {
      url.searchParams.append("keywords", keyword);
    });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Внешний парсер тендеров вернул ошибку");
    }

    const data: unknown = await response.json();

    return tenderParserResponseSchema.parse(data);
  }
}

const parserEnv = getParserEnv();

export const tenderParserService: ITenderParserService =
  parserEnv.TENDER_PARSER_MODE === "rest"
    ? new RestTenderParserService()
    : new TenderParserService();
