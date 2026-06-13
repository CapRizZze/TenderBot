import { prisma } from "@/lib/prisma";
import { sabyRpcClient } from "@/lib/services/sabyRpcClient";
import { normalizeRecordValue } from "@/lib/services/sabyTreeService";
import { normalizeSabyResultToTenders } from "@/lib/tender-parser/tenderParserService";
import type { Tender } from "@/types/tender-parser.dto";

const TENDER_GET_LIST_LIMIT = 10;

export class SabyQueryTenderService {
  async getTendersForQuery(queryId: number): Promise<Tender[]> {
    const query = await prisma.sabyQuery.findUnique({
      where: {
        sabyQueryId: queryId,
      },
    });

    if (!query?.rawConfigJson || typeof query.rawConfigJson !== "object") {
      throw new Error("SabyQuery config is missing. Run structure sync first.");
    }

    const payload = this.buildTenderGetListPayload(
      normalizeRecordValue(query.rawConfigJson),
      query.sabyQueryId,
    );
    const response = await sabyRpcClient.callTradeService<unknown>(
      "Tender.GetList",
      payload,
    );

    if ("error" in response) {
      throw new Error(`Failed to fetch tenders for SabyQuery: ${response.error}`);
    }

    return this.normalizeRpcTenderList(response.result);
  }

  buildTenderGetListPayload(
    queryConfig: Record<string, unknown>,
    sabyQueryId: number,
  ) {
    const parentId = normalizeOptionalInteger(queryConfig.parent_id);
    const parentName = normalizeOptionalString(queryConfig.parent_name);

    return {
      Фильтр: {
        d: TENDER_GET_LIST_FILTER_FIELDS.map((field) =>
          field.resolve(queryConfig, sabyQueryId, parentId, parentName),
        ),
        s: TENDER_GET_LIST_FILTER_FIELDS.map((field) => field.definition),
        _type: "record",
        f: 0,
      },
      Сортировка: {
        d: [[false, "amount", true]],
        s: [
          { t: "Логическое", n: "l" },
          { t: "Строка", n: "n" },
          { t: "Логическое", n: "o" },
        ],
        _type: "recordset",
        f: 0,
      },
      Навигация: {
        d: ["forward", true, TENDER_GET_LIST_LIMIT, null],
        s: [
          { t: "Строка", n: "Direction" },
          { t: "Логическое", n: "HasMore" },
          { t: "Число целое", n: "Limit" },
          { t: "Строка", n: "Position" },
        ],
        _type: "record",
        f: 0,
      },
      ДопПоля: [],
    };
  }

  normalizeRpcTenderList(result: unknown): Tender[] {
    return normalizeSabyResultToTenders(result);
  }
}

export const sabyQueryTenderService = new SabyQueryTenderService();

type FilterFieldDefinition = {
  n: string;
  t: string | { n: string; t: string };
};

type FilterField = {
  definition: FilterFieldDefinition;
  resolve: (
    queryConfig: Record<string, unknown>,
    sabyQueryId: number,
    parentId: number | undefined,
    parentName: string | null,
  ) => unknown;
};

const TENDER_GET_LIST_FILTER_FIELDS: FilterField[] = [
  stringField("additional_fts", (config) => normalizeOptionalString(config.additional_fts) ?? ""),
  intField("additional_fts_mode", (config) => normalizeOptionalInteger(config.additional_fts_mode) ?? 1),
  intField("additional_search_type", (config) => normalizeOptionalInteger(config.additional_search_type) ?? 3),
  booleanField("additional_strict_search", (config) => normalizeOptionalBoolean(config.additional_strict_search) ?? false),
  stringField("advantage", (config) => normalizeOptionalString(config.advantage)),
  stringArrayField("articleId", (config) => normalizeStringArray(config.articleId)),
  stringArrayField("articleId_exclude", (config) => normalizeStringArray(config.articleId_exclude)),
  intField("category_with_keywords", (config) => normalizeOptionalInteger(config.category_with_keywords) ?? 1),
  stringField("colorId", () => null),
  stringField("country_interface", (config) => normalizeOptionalString(config.country_interface)),
  intField("customers_mode", (config) => normalizeOptionalInteger(config.customers_mode) ?? 1),
  stringField("dBegin", (config) => normalizeOptionalString(config.date_begin)),
  stringField("dEnd", (config) => normalizeOptionalString(config.date_end)),
  intField("datePeriods", (config) => normalizeOptionalInteger(config.datePeriods ?? config.date_periods) ?? 1),
  stringArrayField("delivery_place_region_code", (config) => normalizeStringArray(config.delivery_place_region_code)),
  stringField("end_date_periods", (config) => normalizeOptionalString(config.end_date_periods)),
  stringField("end_date_periods_begin", (config) => normalizeOptionalString(config.end_date_periods_begin)),
  stringField("end_date_periods_end", (config) => normalizeOptionalString(config.end_date_periods_end)),
  stringArrayField("fias_delivery_place", (config) => normalizeStringArray(config.fias_delivery_place)),
  stringArrayField("filter_marked", (config) => normalizeStringArray(config.filter_marked)),
  intField("fts_exclude_mode", (config) => normalizeOptionalInteger(config.fts_exclude_mode) ?? 1),
  intField("fts_mode", (config) => normalizeOptionalInteger(config.fts_mode) ?? 1),
  stringField("fts_string", (config) => normalizeOptionalString(config.fts_string) ?? ""),
  stringField("fts_string_exclude", (config) => normalizeOptionalString(config.fts_string_exclude) ?? ""),
  booleanField("has_prepayment", (config) => normalizeOptionalBoolean(config.has_prepayment) ?? false),
  stringArrayField("initiator_spp_uuid_list", (config) => normalizeStringArray(config.initiator_spp_uuid_list)),
  booleanField("is_strict_search_exclude", (config) => normalizeOptionalBoolean(config.is_strict_search_exclude) ?? false),
  stringField("liability_mode", (config) => normalizeOptionalString(config.liability_mode)),
  stringField("liability_price", (config) => normalizeOptionalString(config.liability_price)),
  stringField("maxPrice", (config) => normalizeOptionalString(config.maxPrice)),
  stringField("minPrice", (config) => normalizeOptionalString(config.minPrice)),
  stringArrayField("mnn", (config) => normalizeStringArray(config.mnn)),
  stringArrayField("okpd2_id_arr", (config) => normalizeStringArray(config.okpd2_id_arr)),
  stringArrayField("okpd2_id_arr_exclude", (config) => normalizeStringArray(config.okpd2_id_arr_exclude)),
  intField("parent_id", (_config, _queryId, parentId) => parentId ?? null),
  stringField("parent_name", (_config, _queryId, _parentId, parentName) => parentName),
  intField("part_spp_uuid_list_type", (config) => normalizeOptionalInteger(config.part_spp_uuid_list_type) ?? 0),
  stringArrayField("participant_spp_uuid_list", (config) => normalizeStringArray(config.participant_spp_uuid_list)),
  intField("previousFolderId", (_config, _queryId, parentId) => parentId ?? null),
  stringArrayField("proctypeIdArray", (config) => normalizeStringArray(config.proctypeIdArray)),
  intField("queryFolderId", (_config, sabyQueryId) => sabyQueryId),
  stringField("queryId", () => null),
  stringField("queryName", (config) => normalizeOptionalString(config.queryName) ?? ""),
  intField("query_parent_id", (_config, _queryId, parentId) => parentId ?? null),
  stringField("query_parent_name", (_config, _queryId, _parentId, parentName) => parentName),
  intField("radioSearchType", (config) => normalizeOptionalInteger(config.radioSearchType) ?? 3),
  intField("radioSearchTypeExclude", (config) => normalizeOptionalInteger(config.radioSearchTypeExclude) ?? 3),
  stringArrayField("region_code_filter", (config) => normalizeStringArray(config.region_code_filter)),
  stringArrayField("region_code_filter_exclude", (config) => normalizeStringArray(config.region_code_filter_exclude)),
  stringField("responsibleId", (config) => normalizeOptionalString(config.responsibleId)),
  booleanField("search_branches", (config) => normalizeOptionalBoolean(config.search_branches) ?? false),
  booleanField("search_by_tender", () => false),
  stringField("section_ids", (config) => normalizeOptionalString(config.section_ids)),
  booleanField("show_our_industry", () => true),
  booleanField("show_pictures", () => false),
  booleanField("show_without_industry", (config) => normalizeOptionalBoolean(config.show_without_industry) ?? false),
  stringArrayField("state_agg_id_arr", (config) => normalizeStringArray(config.state_agg_id_arr)),
  intArrayField("stateid_arr", (config) => normalizeIntegerArray(config.stateid_arr ?? config.stateId)),
  booleanField("strict_search", (config) => normalizeOptionalBoolean(config.strict_search) ?? false),
  stringArrayField("tag_ids", (config) => normalizeStringArray(config.tag_ids)),
  intField("tenderType", (config) => normalizeOptionalInteger(config.tenderType) ?? 1),
  stringArrayField("trade_name", (config) => normalizeStringArray(config.trade_name)),
  stringArrayField("tradingPlatformIdArray", (config) => normalizeStringArray(config.tradingPlatformIdArray)),
  stringArrayField("tradingPlatformIdArray_exclude", (config) => normalizeStringArray(config.tradingPlatformIdArray_exclude)),
  stringField("warranty_liability_mode", (config) => normalizeOptionalString(config.warranty_liability_mode)),
  stringField("warranty_liability_price", (config) => normalizeOptionalString(config.warranty_liability_price)),
  booleanField("with_folders", () => true),
  stringField("without_price", (config) => normalizeOptionalString(config.without_price)),
];

function stringField(
  name: string,
  resolve: FilterField["resolve"],
): FilterField {
  return {
    definition: { t: "Строка", n: name },
    resolve,
  };
}

function intField(name: string, resolve: FilterField["resolve"]): FilterField {
  return {
    definition: { t: "Число целое", n: name },
    resolve,
  };
}

function booleanField(
  name: string,
  resolve: FilterField["resolve"],
): FilterField {
  return {
    definition: { t: "Логическое", n: name },
    resolve,
  };
}

function stringArrayField(
  name: string,
  resolve: FilterField["resolve"],
): FilterField {
  return {
    definition: { t: { n: "Массив", t: "Строка" }, n: name },
    resolve,
  };
}

function intArrayField(
  name: string,
  resolve: FilterField["resolve"],
): FilterField {
  return {
    definition: { t: { n: "Массив", t: "Число целое" }, n: name },
    resolve,
  };
}

function normalizeOptionalInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeOptionalString(item))
    .filter((item): item is string => item !== null);
}

function normalizeIntegerArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeOptionalInteger(item))
    .filter((item): item is number => item !== undefined);
}
