import { getParserEnv } from "../env.ts";
import {
  type SabyDailyLimitStatistics,
  type Tender,
  type TenderAttachment,
  tenderKeywordsSchema,
  tenderParserResponseSchema,
} from "../../types/tender-parser.dto.ts";

interface TenderDocumentLookup {
  externalId: string;
  number?: string;
}

export interface ITenderParserService {
  fetchTendersByKeywords(keywords: string[]): Promise<Tender[]>;
  fetchDailyLimitStatistics?(): Promise<SabyDailyLimitStatistics | null>;
  fetchTenderDocuments?(lookup: TenderDocumentLookup): Promise<TenderAttachment[]>;
  downloadAttachment?(
    attachment: TenderAttachment,
  ): Promise<{
    buffer: Buffer;
    mimeType?: string;
    size?: number;
  }>;
}

export class SabyDailyLimitError extends Error {
  constructor(message = "Р”РѕСЃС‚РёРіРЅСѓС‚ СЃСѓС‚РѕС‡РЅС‹Р№ Р»РёРјРёС‚ Saby API РїРѕ РїРѕР»СѓС‡РµРЅРёСЋ С‚РѕСЂРіРѕРІ") {
    super(message);
    this.name = "SabyDailyLimitError";
  }
}

const DEFAULT_SABY_METHODS = [
  "SbisTenderAPI.GetTenderList",
  "GetFavouriteTenderList",
  "GetTenderListFromFolder",
  "GetTenderListByNumber",
];

const DEFAULT_SABY_PAGE_SIZE = 1;
const DEFAULT_SABY_PROTOCOL = 4;
const DEFAULT_SBIS_AUTH_METHOD = "СБИС.Аутентифицировать";
const DEFAULT_SABY_BASE_URL = "https://online.saby.ru";

class TenderParserService implements ITenderParserService {
  async fetchTendersByKeywords(keywords: string[]): Promise<Tender[]> {
    const validatedKeywords = tenderKeywordsSchema.parse(keywords);

    const mockedTenders: Tender[] = [
      {
        id: "zakupki-001",
        title: "РџРѕСЃС‚Р°РІРєР° СЃРµСЂРІРµСЂРЅРѕРіРѕ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ",
        description:
          "Р—Р°РєСѓРїРєР° СЃРµСЂРІРµСЂРѕРІ, СЃРёСЃС‚РµРј С…СЂР°РЅРµРЅРёСЏ РґР°РЅРЅС‹С… Рё СЃРµС‚РµРІРѕРіРѕ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ РґР»СЏ РјРѕРґРµСЂРЅРёР·Р°С†РёРё РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂС‹.",
        customer: "Р“Р‘РЈ РРЅС„РѕСЂРјР°С†РёРѕРЅРЅС‹Рµ СЃРёСЃС‚РµРјС‹",
        deadline: "2026-06-20T18:00:00.000Z",
        budget: 12_500_000,
        url: "https://example.com/tenders/zakupki-001",
        attachments: [],
      },
      {
        id: "commercial-002",
        title: "Р Р°Р·СЂР°Р±РѕС‚РєР° РјРѕРґСѓР»СЏ Р°РЅР°Р»РёС‚РёРєРё Р·Р°РєСѓРїРѕРє",
        description:
          "РљРѕРјРјРµСЂС‡РµСЃРєРёР№ С‚РµРЅРґРµСЂ РЅР° СЂР°Р·СЂР°Р±РѕС‚РєСѓ РІРµР±-РјРѕРґСѓР»СЏ Р°РЅР°Р»РёС‚РёРєРё, РѕС‚С‡РµС‚РЅРѕСЃС‚Рё Рё РёРЅС‚РµРіСЂР°С†РёРё СЃ РІРЅСѓС‚СЂРµРЅРЅРµР№ CRM.",
        customer: "Р С›Р С›Р С› Р СћР С•РЎР‚Р С–Р С•Р Р†Р В°РЎРЏ Р С—Р В»Р В°РЎвЂљРЎвЂћР С•РЎР‚Р СР В°",
        deadline: "2026-07-05T15:00:00.000Z",
        budget: 4_800_000,
        url: "https://example.com/tenders/commercial-002",
        attachments: [],
      },
      {
        id: "zakupki-003",
        title: "РЎРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅРѕР№ СЃРёСЃС‚РµРјС‹",
        description:
          "РћРєР°Р·Р°РЅРёРµ СѓСЃР»СѓРі С‚РµС…РЅРёС‡РµСЃРєРѕР№ РїРѕРґРґРµСЂР¶РєРё, РјРѕРЅРёС‚РѕСЂРёРЅРіР° Рё РґРѕСЂР°Р±РѕС‚РєРё РґРµР№СЃС‚РІСѓСЋС‰РµР№ РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅРѕР№ СЃРёСЃС‚РµРјС‹.",
        customer: "Р¤РљРЈ Р¦РµРЅС‚СЂ С†РёС„СЂРѕРІС‹С… СЂРµС€РµРЅРёР№",
        deadline: "2026-06-30T12:00:00.000Z",
        url: "https://example.com/tenders/zakupki-003",
        attachments: [],
      },
    ];

    return tenderParserResponseSchema.parse(
      filterTendersByKeywords(mockedTenders, validatedKeywords),
    );
  }

  async fetchDailyLimitStatistics(): Promise<SabyDailyLimitStatistics | null> {
    return null;
  }

  async fetchTenderDocuments(
    _lookup: TenderDocumentLookup,
  ): Promise<TenderAttachment[]> {
    return [];
  }

  async downloadAttachment(
    attachment: TenderAttachment,
  ): Promise<{ buffer: Buffer; mimeType?: string; size?: number }> {
    const response = await fetch(attachment.url, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get("content-type") ?? attachment.mimeType ?? undefined,
      size:
        Number(response.headers.get("content-length")) || attachment.size || undefined,
    };
  }
}

class RestTenderParserService implements ITenderParserService {
  async fetchTendersByKeywords(keywords: string[]): Promise<Tender[]> {
    const validatedKeywords = tenderKeywordsSchema.parse(keywords);
    const parserEnv = getParserEnv();

    if (!parserEnv.TENDER_PARSER_API_URL) {
      throw new Error("TENDER_PARSER_API_URL is required for rest mode");
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
      throw new Error("External tender parser returned an error");
    }

    const data: unknown = await response.json();
    const parsed = tenderParserResponseSchema.parse(data);

    return filterTendersByKeywords(parsed, validatedKeywords);
  }

  async fetchDailyLimitStatistics(): Promise<SabyDailyLimitStatistics | null> {
    return null;
  }

  async fetchTenderDocuments(
    _lookup: TenderDocumentLookup,
  ): Promise<TenderAttachment[]> {
    return [];
  }

  async downloadAttachment(
    attachment: TenderAttachment,
  ): Promise<{ buffer: Buffer; mimeType?: string; size?: number }> {
    const response = await fetch(attachment.url, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get("content-type") ?? attachment.mimeType ?? undefined,
      size:
        Number(response.headers.get("content-length")) || attachment.size || undefined,
    };
  }
}

class SabyTenderParserService implements ITenderParserService {
  private readonly env = getParserEnv();
  private sidCache: { sid: string; expiresAt: number } | null = null;

  async fetchDailyLimitStatistics(): Promise<SabyDailyLimitStatistics> {
    if (!this.env.SABY_TENDER_API_URL) {
      throw new Error("SABY_TENDER_API_URL is not set");
    }

    const sid = await this.authenticate();
    const response = await this.callJsonRpc(
      this.env.SABY_TENDER_API_URL,
      {
        jsonrpc: "2.0",
        method: "SbisTenderAPI.GetStatistics",
        params: {},
        id: `SbisTenderAPI.GetStatistics-${Math.random().toString(36).slice(2)}`,
      },
      sid,
    );

    if (response.error) {
      throw new Error(`Saby statistics request failed: ${response.error}`);
    }

    return normalizeSabyDailyLimitStatistics(response.result);
  }

  async fetchTenderDocuments(
    lookup: TenderDocumentLookup,
  ): Promise<TenderAttachment[]> {
    if (!this.env.SABY_TENDER_API_URL) {
      throw new Error("SABY_TENDER_API_URL is not set");
    }

    const tenderExternalId = lookup.externalId.trim();
    const tenderNumber = lookup.number?.trim();
    const sid = await this.authenticate();
    const errors: string[] = [];
    const requests = buildSabyTenderDocumentLookupRequests({
      externalId: tenderExternalId,
      ...(tenderNumber ? { number: tenderNumber } : {}),
    });

    for (const request of requests) {
      const response = await this.callJsonRpc(
        this.env.SABY_TENDER_API_URL,
        {
          jsonrpc: "2.0",
          protocol: DEFAULT_SABY_PROTOCOL,
          method: request.method,
          params: request.params,
          id: `${request.method}-${Math.random().toString(36).slice(2)}`,
        },
        sid,
      );

      if (response.error) {
        errors.push(`${request.method}: ${response.error}`);
        continue;
      }

      const tenders = normalizeSabyResultToTenders(response.result);
      const matchedTender =
        tenders.find(
          (tender) =>
            tender.id === tenderExternalId ||
            (tenderNumber ? tender.number === tenderNumber : false),
        ) ?? tenders[0];
      const attachments = matchedTender?.attachments ?? [];

      if (attachments.length > 0) {
        return attachments;
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[saby-parser] tender documents not found", {
        tenderExternalId,
        tenderNumber,
        errors,
      });
    }

    return [];
  }

  async downloadAttachment(
    attachment: TenderAttachment,
  ): Promise<{ buffer: Buffer; mimeType?: string; size?: number }> {
    const headers: HeadersInit = {};

    if (isSabyUrl(attachment.url)) {
      const sid = await this.authenticate();
      headers.Cookie = `sid=${sid}`;
      headers["X-SBISSessionID"] = sid;
    }

    const response = await fetch(attachment.url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to download Saby attachment: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get("content-type") ?? attachment.mimeType ?? undefined,
      size:
        Number(response.headers.get("content-length")) || attachment.size || undefined,
    };
  }

  async fetchTendersByKeywords(keywords: string[]): Promise<Tender[]> {
    const validatedKeywords = tenderKeywordsSchema.parse(keywords);
    const sid = await this.authenticate();
    const methodsToTry = this.getMethodCandidates();

    const collected = new Map<string, Tender>();
    const methodErrors: string[] = [];

    for (const methodName of methodsToTry) {
      if (methodName === "SbisTenderAPI.GetTenderList") {
        const requestNames = this.getRequestNameCandidates(validatedKeywords);
        const byRequestNames = await this.callV4TenderListByRequestNames(
          requestNames,
          sid,
          validatedKeywords,
        );

        if ("error" in byRequestNames) {
          methodErrors.push(`${methodName}: ${byRequestNames.error}`);
          continue;
        }

        byRequestNames.tenders.forEach((tender) => {
          collected.set(tender.id, tender);
        });
        continue;
      }

      const rpcResult = await this.callMethodWithFallbackPayloads(
        methodName,
        validatedKeywords,
        sid,
      );

      if (rpcResult.error) {
        methodErrors.push(`${methodName}: ${rpcResult.error}`);
        continue;
      }

      const normalized = normalizeSabyResultToTenders(rpcResult.data);
      normalized.forEach((tender) => {
        collected.set(tender.id, tender);
      });
    }

    const allTenders = [...collected.values()];

    if (allTenders.length === 0) {
      if (methodErrors.length > 0) {
        if (methodErrors.some(isSabyDailyLimitMessage)) {
          throw new SabyDailyLimitError();
        }

        console.error(
          "Saby parser did not return tenders",
          methodErrors.join("; "),
        );
      }

      return [];
    }

    const filtered = filterTendersByKeywords(allTenders, validatedKeywords);

    return tenderParserResponseSchema.parse(
      filtered.length > 0 ? filtered : allTenders,
    );
  }

  private getRequestNameCandidates(keywords: string[]): string[] {
    const fromEnv =
      this.env.SABY_TENDER_REQUEST_NAMES?.split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0) ?? [];
    const normalizedKeywordSet = new Set(
      keywords.map((keyword) => keyword.toLocaleLowerCase("ru-RU").trim()),
    );

    if (fromEnv.length > 0) {
      const matched = fromEnv.filter((requestName) =>
        normalizedKeywordSet.has(requestName.toLocaleLowerCase("ru-RU").trim()),
      );

      if (matched.length > 0) {
        return matched;
      }
    }

    const unique = new Set<string>();

    keywords.forEach((value) => {
      const normalized = value.trim();

      if (normalized.length > 0) {
        unique.add(normalized);
      }
    });

    return [...unique];
  }

  private async callV4TenderListByRequestNames(
    requestNames: string[],
    sid: string,
    keywords: string[],
  ): Promise<{ tenders: Tender[]; error?: never } | { tenders?: never; error: string }> {
    if (!this.env.SABY_TENDER_API_URL) {
      return { error: "SABY_TENDER_API_URL is not set" };
    }

    if (requestNames.length === 0) {
      return { error: "No request names for SbisTenderAPI.GetTenderList" };
    }

    const pageSize = this.env.SABY_PAGE_SIZE ?? DEFAULT_SABY_PAGE_SIZE;
    const collected = new Map<string, Tender>();
    const requestErrors: string[] = [];

    for (const requestName of requestNames) {
      const payloads = buildSabyV4MethodParamsForRequestName(requestName, pageSize);
      const errors: string[] = [];
      let success = false;

      for (const params of payloads) {
        const requestPayload = {
          jsonrpc: "2.0",
          protocol: DEFAULT_SABY_PROTOCOL,
          method: "SbisTenderAPI.GetTenderList",
          params,
          id: `SbisTenderAPI.GetTenderList-${Math.random().toString(36).slice(2)}`,
        };

        const response = await this.callJsonRpc(
          this.env.SABY_TENDER_API_URL,
          requestPayload,
          sid,
        );

        if (response.error) {
          errors.push(response.error);
          continue;
        }

        const normalized = normalizeSabyResultToTenders(response.result);
        normalized.forEach((tender) => {
          collected.set(tender.id, tender);
        });
        success = true;
        break;
      }

      if (!success) {
        requestErrors.push(`${requestName}: ${errors.join(" | ")}`);
      }
    }

    const tenders = [...collected.values()];

    if (tenders.length === 0) {
      const details =
        requestErrors.length > 0
          ? requestErrors.join("; ")
          : "no tenders returned";
      return { error: details };
    }

    const filtered = filterTendersByKeywords(tenders, keywords);

    return {
      tenders: filtered.length > 0 ? filtered : tenders,
    };
  }

  private async authenticate(): Promise<string> {
    if (
      !this.env.SABY_AUTH_URL ||
      !this.env.SABY_LOGIN ||
      !this.env.SABY_PASSWORD
    ) {
      throw new Error("Saby parser is not fully configured");
    }

    if (this.sidCache && this.sidCache.expiresAt > Date.now()) {
      return this.sidCache.sid;
    }

    const authPayloads: Array<Record<string, unknown>> = [
      {
        jsonrpc: "2.0",
        method: DEFAULT_SBIS_AUTH_METHOD,
        params: {
          "Параметр": {
            "Логин": this.env.SABY_LOGIN,
            "Пароль": this.env.SABY_PASSWORD,
          },
        },
        id: "auth-1",
      },
      {
        jsonrpc: "2.0",
        method: DEFAULT_SBIS_AUTH_METHOD,
        params: {
          login: this.env.SABY_LOGIN,
          password: this.env.SABY_PASSWORD,
        },
        id: "auth-2",
      },
    ];

    const authErrors: string[] = [];

    for (const payload of authPayloads) {
      const response = await this.callJsonRpc(this.env.SABY_AUTH_URL, payload);

      if (response.error) {
        authErrors.push(response.error);
        continue;
      }

      const sid = extractSid(response.result);

      if (sid) {
        this.sidCache = {
          sid,
          expiresAt: Date.now() + 10 * 60 * 1000,
        };
        return sid;
      }

      authErrors.push("response does not contain SID");
    }

    throw new Error(`Saby authentication failed: ${authErrors.join("; ")}`);
  }

  private getMethodCandidates(): string[] {
    const fromEnv =
      this.env.SABY_TENDER_METHODS?.split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0) ?? [];
    const source = fromEnv.length > 0 ? fromEnv : DEFAULT_SABY_METHODS;
    const unique = new Set<string>();

    for (const method of source) {
      const normalized = method.trim();

      if (!normalized) {
        continue;
      }

      unique.add(normalized);

      if (normalized.startsWith("Р РЋР вЂР ВР РЋ.")) {
        unique.add(normalized.replace(/^Р РЋР вЂР ВР РЋ\./u, ""));
      } else if (!normalized.includes(".")) {
        unique.add(`Р РЋР вЂР ВР РЋ.${normalized}`);
      }
    }

    return [...unique];
  }

  private async callMethodWithFallbackPayloads(
    methodName: string,
    keywords: string[],
    sid: string,
  ): Promise<{ data: unknown; error?: never } | { data?: never; error: string }> {
    if (!this.env.SABY_TENDER_API_URL) {
      return { error: "SABY_TENDER_API_URL is not set" };
    }

    const pageSize = this.env.SABY_PAGE_SIZE ?? DEFAULT_SABY_PAGE_SIZE;
    const payloads = buildSabyMethodParams(keywords, pageSize);
    const errors: string[] = [];

    for (const params of payloads) {
      const requestPayload = {
        jsonrpc: "2.0",
        method: methodName,
        params,
        id: `${methodName}-${Math.random().toString(36).slice(2)}`,
      };

      const response = await this.callJsonRpc(
        this.env.SABY_TENDER_API_URL,
        requestPayload,
        sid,
      );

      if (!response.error) {
        return { data: response.result };
      }

      errors.push(response.error);
    }

    return { error: errors.join(" | ") };
  }

  private async callJsonRpc(
    url: string,
    payload: Record<string, unknown>,
    sid?: string,
  ): Promise<{ result: unknown; error?: never } | { result?: never; error: string }> {
    const headers: HeadersInit = {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json",
    };

    if (sid) {
      headers.Cookie = `sid=${sid}`;
      headers["X-SBISSessionID"] = sid;
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Network request failed",
      };
    }

    const raw = await response.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        error: `Invalid JSON-RPC response: HTTP ${response.status}`,
      };
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {
        error: "Invalid JSON-RPC response payload",
      };
    }

    const rpc = parsed as Record<string, unknown>;

    if (rpc.error && typeof rpc.error === "object" && !Array.isArray(rpc.error)) {
      const rpcError = rpc.error as Record<string, unknown>;
      const code = rpcError.code ?? "unknown";
      const message =
        typeof rpcError.message === "string"
          ? rpcError.message
          : "Unknown RPC error";
      return { error: `${code}: ${message}` };
    }

    return { result: rpc.result };
  }
}

function isSabyDailyLimitMessage(message: string): boolean {
  const normalized = message.toLocaleLowerCase("ru-RU");

  return (
    normalized.includes("СЃСѓС‚РѕС‡") ||
    normalized.includes("daily limit") ||
    normalized.includes("limit")
  );
}

function buildSabyV4MethodParamsForRequestName(
  requestName: string,
  pageSize: number,
): Array<Record<string, unknown>> {
  const fromPublishDateTime = getSabyFromPublishDateTime();

  return [
    {
      params: {
        requestName,
        limit: pageSize,
        fromPublishDateTime,
      },
    },
    {
      params: {
        requestName,
        limit: pageSize,
      },
    },
    {
      params: {
        requestName,
      },
    },
  ];
}

function buildSabyMethodParams(
  keywords: string[],
  pageSize: number,
): Array<Record<string, unknown>> {
  const firstKeyword = keywords[0] ?? "";
  const navigation = {
    "РазмерСтраницы": pageSize,
    "Страница": 0,
  };

  return [
    {},
    {
      "Параметр": {},
    },
    {
      "Параметр": {
        "Навигация": navigation,
      },
    },
    {
      "Фильтр": {
        "Навигация": navigation,
      },
    },
    {
      "Параметр": {
        "Поиск": firstKeyword,
        "Навигация": navigation,
      },
    },
    {
      "Параметр": {
        "СтрокаПоиска": firstKeyword,
        "Навигация": navigation,
      },
    },
    {
      "Фильтр": {
        "Поиск": firstKeyword,
        "Навигация": navigation,
      },
    },
  ];
}

function buildSabyTenderDocumentParams(
  tenderExternalId: string,
): Array<Record<string, unknown>> {
  return [
    {},
    {
      params: {
        tenderId: tenderExternalId,
      },
    },
    {
      params: {
        id: tenderExternalId,
      },
    },
    {
      params: {
        tenderID: tenderExternalId,
      },
    },
    {
      tenderId: tenderExternalId,
    },
    {
      id: tenderExternalId,
    },
    {
      tenderID: tenderExternalId,
    },
    {
      "Параметр": {
        "Идентификатор": tenderExternalId,
      },
    },
  ];
}

function buildSabyTenderDocumentLookupRequests(
  lookup: TenderDocumentLookup,
): Array<{
  method: "SbisTenderAPI.GetTenderListByID" | "SbisTenderAPI.GetTenderListByNumber";
  params: Record<string, unknown>;
}> {
  const requests: Array<{
    method: "SbisTenderAPI.GetTenderListByID" | "SbisTenderAPI.GetTenderListByNumber";
    params: Record<string, unknown>;
  }> = [];
  const numericId = Number(lookup.externalId);

  if (Number.isFinite(numericId) && lookup.externalId.length > 0) {
    requests.push({
      method: "SbisTenderAPI.GetTenderListByID",
      params: {
        params: {
          ids: [numericId],
        },
      },
    });
  }

  if (lookup.number) {
    requests.push({
      method: "SbisTenderAPI.GetTenderListByNumber",
      params: {
        params: {
          number: lookup.number,
        },
      },
    });
  }

  return requests;
}

function normalizeSabyDailyLimitStatistics(
  value: unknown,
): SabyDailyLimitStatistics {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Saby statistics response has invalid payload");
  }

  const record = value as Record<string, unknown>;
  const dayCounter = normalizeNonNegativeInteger(
    pickField(record, ["DayCounter", "dayCounter", "used", "counter"]),
  );
  const dayLimit = normalizeNonNegativeInteger(
    pickField(record, ["DayLimit", "dayLimit", "limit"]),
  );
  const dayRemaining = normalizeNonNegativeInteger(
    pickField(record, ["DayRemaining", "dayRemaining", "remaining"]),
  );

  if (dayCounter === undefined || dayLimit === undefined) {
    throw new Error("Saby statistics response does not contain daily limit fields");
  }

  return {
    dayCounter,
    dayLimit,
    dayRemaining: dayRemaining ?? Math.max(dayLimit - dayCounter, 0),
  };
}

function getSabyFromPublishDateTime(): string {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 60);

  const year = fromDate.getFullYear();
  const month = String(fromDate.getMonth() + 1).padStart(2, "0");
  const day = String(fromDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day} 00:00:00`;
}

function extractSid(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const keys = ["sid", "SID", "sessionId", "SessionId"];

  for (const key of keys) {
    const candidate = record[key];

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeSabyResultToTenders(rawResult: unknown): Tender[] {
  const selection = findTenderLikeRecords(rawResult);
  const tenders: Tender[] = [];

  selection.records.forEach((record, index) => {
    const tender = mapRecordToTender(record, index);

    if (tender) {
      tenders.push(tender);
    }
  });

  logSabyTenderSelection(selection, tenders.length);

  return tenders;
}

function findTenderLikeRecords(rawResult: unknown): TenderRecordSelection {
  const explicitTenders = pickExplicitTenderArray(rawResult);

  if (explicitTenders.length > 0) {
    return {
      records: explicitTenders,
      source: "explicit",
      path: "tenders/result.tenders",
    };
  }

  const arrays: Array<Array<Record<string, unknown>>> = [];

  const walk = (value: unknown): void => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      const objects = value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item),
      );

      if (objects.length > 0) {
        arrays.push(objects);
      }

      value.forEach(walk);
      return;
    }

    if (typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  };

  walk(rawResult);

  if (arrays.length === 0) {
    return {
      records: [],
      source: "none",
      path: "no-array-found",
    };
  }

  const scored = arrays
    .map((items, index) => ({
      items,
      score:
        items.reduce((sum, item) => sum + getTenderLikeScore(item), 0) /
        items.length,
      index,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.items.length - a.items.length;
    });

  const winner = scored[0];

  return {
    records: winner.items,
    source: "heuristic",
    path: `scanned-array-${winner.index}`,
  };
}

function pickExplicitTenderArray(rawResult: unknown): Array<Record<string, unknown>> {
  const direct = toObjectArray(rawResult);

  if (direct.length > 0) {
    return direct;
  }

  if (!rawResult || typeof rawResult !== "object" || Array.isArray(rawResult)) {
    return [];
  }

  const record = rawResult as Record<string, unknown>;
  const directCandidateKeys = [
    "tenders",
    "Tenders",
    "tenderList",
    "TenderList",
    "rows",
    "Rows",
  ];

  for (const key of directCandidateKeys) {
    const array = toObjectArray(record[key]);

    if (array.length > 0) {
      return array;
    }
  }

  const result = record.result;

  if (result && typeof result === "object" && !Array.isArray(result)) {
    const nestedRecord = result as Record<string, unknown>;

    for (const key of directCandidateKeys) {
      const array = toObjectArray(nestedRecord[key]);

      if (array.length > 0) {
        return array;
      }
    }
  }

  return [];
}

function toObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item),
  );
}

interface TenderRecordSelection {
  records: Array<Record<string, unknown>>;
  source: "explicit" | "heuristic" | "none";
  path: string;
}

function logSabyTenderSelection(
  selection: TenderRecordSelection,
  normalizedCount: number,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[saby-parser] tender selection", {
    source: selection.source,
    path: selection.path,
    rawRecords: selection.records.length,
    normalizedTenders: normalizedCount,
  });
}

function getTenderLikeScore(record: Record<string, unknown>): number {
  const title = pickField(record, [
    "title",
    "Название",
    "Наименование",
    "Предмет",
    "РќР°Р·РІР°РЅРёРµ",
    "РќР°РёРјРµРЅРѕРІР°РЅРёРµ",
    "Р СџРЎР‚Р ВµР Т‘Р СР ВµРЎвЂљ",
    "subject",
    "name",
  ]);
  const customer = pickField(record, [
    "customer",
    "Заказчик",
    "Организатор",
    "Р—Р°РєР°Р·С‡РёРє",
    "РћСЂРіР°РЅРёР·Р°С‚РѕСЂ",
    "customerName",
    "initiator_name",
    "organizer_name",
    "initiator_full_name",
    "organizer_full_name",
  ]);
  const id = pickField(record, [
    "id",
    "ID",
    "Идентификатор",
    "Номер",
    "РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ",
    "TenderID",
    "tenderId",
    "Р СњР С•Р СР ВµРЎР‚",
  ]);

  let score = 0;

  if (typeof title === "string" && title.trim().length > 0) {
    score += 3;
  }

  if (typeof customer === "string" && customer.trim().length > 0) {
    score += 2;
  }

  if (
    (typeof id === "string" && id.trim().length > 0) ||
    typeof id === "number"
  ) {
    score += 1;
  }

  return score;
}

function mapRecordToTender(
  record: Record<string, unknown>,
  index: number,
): Tender | null {
  const titleRaw = pickField(record, [
    "title",
    "Название",
    "Наименование",
    "Предмет",
    "РќР°Р·РІР°РЅРёРµ",
    "РќР°РёРјРµРЅРѕРІР°РЅРёРµ",
    "РџСЂРµРґРјРµС‚",
    "subject",
    "name",
  ]);

  const title = toNonEmptyString(titleRaw);

  if (!title) {
    return null;
  }

  const idRaw = pickField(record, [
    "id",
    "ID",
    "Идентификатор",
    "РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ",
    "TenderID",
    "tenderId",
    "РќРѕРјРµСЂ",
    "number",
  ]);
  const id = toNonEmptyString(idRaw) ?? `saby-tender-${index + 1}`;
  const numberRaw = pickField(record, ["Номер", "РќРѕРјРµСЂ", "number"]);
  const number = toNonEmptyString(numberRaw);

  const descriptionRaw = pickField(record, [
    "description",
    "Описание",
    "КраткоеОписание",
    "Детали",
    "РћРїРёСЃР°РЅРёРµ",
    "РљСЂР°С‚РєРѕРµРћРїРёСЃР°РЅРёРµ",
    "Р”РµС‚Р°Р»Рё",
    "details",
  ]);
  const description = toNonEmptyString(descriptionRaw) ?? title;

  const customerRaw = pickField(record, [
    "customer",
    "Заказчик",
    "Организатор",
    "Р—Р°РєР°Р·С‡РёРє",
    "РћСЂРіР°РЅРёР·Р°С‚РѕСЂ",
    "customerName",
    "orgName",
    "initiator_name",
    "organizer_name",
    "initiator_full_name",
    "organizer_full_name",
  ]);
  const customer = toNonEmptyString(customerRaw) ?? "РќРµ СѓРєР°Р·Р°РЅ";

  const placedAtRaw = pickField(record, [
    "publish_date",
    "publishDate",
    "createdAt",
    "creationDate",
    "datePublished",
    "postedAt",
    "Р вЂќР В°РЎвЂљР В°Р СџРЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂ Р С‘Р С‘",
    "Р вЂќР В°РЎвЂљР В°Р В Р В°Р В·Р СР ВµРЎвЂ°Р ВµР Р…Р С‘РЎРЏ",
    "Р вЂќР В°РЎвЂљР В°Р РЋР С•Р В·Р Т‘Р В°Р Р…Р С‘РЎРЏ",
  ]);
  const placedAt = placedAtRaw ? normalizeDate(placedAtRaw) : undefined;

  const deadlineRaw =
    pickField(record, [
      "deadline",
      "submissionDeadline",
      "applicationDeadline",
      "request_receiving_end_date",
      "request_receiving_end_alt_date",
      "request_receiving_date",
      "endDate",
      "end_date",
      "dueDate",
      "closingDate",
      "closeDate",
      "bidEndDate",
      "biddingEndDate",
      "ДатаОкончанияПодачи",
      "ДатаОкончанияПодачиЗаявок",
      "ОкончаниеПодачиЗаявок",
      "ОкончаниеПодачи",
      "ДатаОкончанияПриемаЗаявок",
      "ОкончаниеПриемаЗаявок",
      "ДатаОкончания",
      "ДатаЗавершения",
    ]) ??
    pickField(record, [
      "end_at",
      "finishDate",
      "tender_end_date",
      "submission_end_date",
    ]);
  const deadline = normalizeDate(deadlineRaw);

  const budgetRaw = pickField(record, [
    "budget",
    "НМЦК",
    "НачальнаяЦена",
    "МаксимальнаяЦена",
    "РќРњР¦Рљ",
    "РќР°С‡Р°Р»СЊРЅР°СЏР¦РµРЅР°",
    "РњР°РєСЃРёРјР°Р»СЊРЅР°СЏР¦РµРЅР°",
    "price",
    "amount",
  ]);
  const budget = normalizeBudget(budgetRaw);

  const sourceUrlRaw = pickField(record, [
    "external_url",
    "externalUrl",
    "tender_url",
    "url",
    "Ссылка",
    "РЎСЃС‹Р»РєР°",
    "Link",
    "cardUrl",
  ]);
  const sabyUrlRaw = pickField(record, [
    "tender_sbis_url",
    "sbis_url",
    "sbisUrl",
    "КарточкаСсылка",
    "РљР°СЂС‚РѕС‡РєР°РЎСЃС‹Р»РєР°",
    "urlToOpen",
  ]);
  const normalizedSourceUrl = normalizeUrl(sourceUrlRaw, id);
  const normalizedSabyUrl = normalizeUrl(sabyUrlRaw, id);
  const sourceUrl = isSabyUrl(normalizedSourceUrl) ? undefined : normalizedSourceUrl;
  const sabyUrl = isSabyUrl(normalizedSabyUrl)
    ? normalizedSabyUrl
    : isSabyUrl(normalizedSourceUrl)
      ? normalizedSourceUrl
      : undefined;
  const url = sourceUrl ?? sabyUrl ?? normalizeUrl(sourceUrlRaw ?? sabyUrlRaw, id);
  const attachments = normalizeAttachments(record);

  const tender: Tender = {
    id,
    ...(number ? { number } : {}),
    title,
    description,
    customer,
    ...(placedAt ? { placedAt } : {}),
    deadline,
    url,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sabyUrl ? { sabyUrl } : {}),
    attachments,
    ...(typeof budget === "number" ? { budget } : {}),
  };

  return tender;
}

function normalizeAttachments(record: Record<string, unknown>): TenderAttachment[] {
  const attachmentRecords = findAttachmentLikeRecords(record);
  const unique = new Map<string, TenderAttachment>();

  attachmentRecords.forEach((attachmentRecord, index) => {
    const attachment = mapRecordToAttachment(attachmentRecord, index);

    if (!attachment) {
      return;
    }

    unique.set(attachment.url, attachment);
  });

  return [...unique.values()];
}

function normalizeSabyResultToAttachments(rawResult: unknown): TenderAttachment[] {
  const attachmentRecords = findAttachmentLikeRecords({
    documents: rawResult,
  });
  const unique = new Map<string, TenderAttachment>();

  attachmentRecords.forEach((attachmentRecord, index) => {
    const attachment = mapRecordToAttachment(attachmentRecord, index);

    if (!attachment) {
      return;
    }

    unique.set(attachment.url, attachment);
  });

  return [...unique.values()];
}

function findAttachmentLikeRecords(
  record: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const explicit = pickField(record, [
    "attachments",
    "attachment",
    "files",
    "fileList",
    "documents",
    "documentList",
    "docs",
    "Документы",
    "Файлы",
    "Вложения",
    "Файл",
    "Документ",
    "Р”РѕРєСѓРјРµРЅС‚С‹",
    "Р¤Р°Р№Р»С‹",
    "Р’Р»РѕР¶РµРЅРёСЏ",
    "Р¤Р°Р№Р»",
    "Р”РѕРєСѓРјРµРЅС‚",
  ]);
  const explicitArray = toObjectArray(explicit);

  if (explicitArray.length > 0) {
    return explicitArray;
  }

  const candidates: Array<Record<string, unknown>> = [];

  const walk = (value: unknown, depth: number): void => {
    if (depth > 4 || !value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, depth + 1));
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    const nestedRecord = value as Record<string, unknown>;

    if (getAttachmentLikeScore(nestedRecord) >= 3) {
      candidates.push(nestedRecord);
      return;
    }

    Object.values(nestedRecord).forEach((nestedValue) =>
      walk(nestedValue, depth + 1),
    );
  };

  Object.values(record).forEach((value) => walk(value, 0));

  return candidates;
}

function mapRecordToAttachment(
  record: Record<string, unknown>,
  index: number,
): TenderAttachment | null {
  const urlRaw = pickField(record, [
    "external_url",
    "externalUrl",
    "sbis_url",
    "sbisUrl",
    "url",
    "href",
    "link",
    "downloadUrl",
    "download_url",
    "fileUrl",
    "file_url",
    "relativeUrl",
    "urlToOpen",
    "Ссылка",
    "Адрес",
    "РЎСЃС‹Р»РєР°",
    "РђРґСЂРµСЃ",
  ]);
  const rawUrl = toNonEmptyString(urlRaw);

  if (!rawUrl) {
    return null;
  }

  const nameRaw = pickField(record, [
    "name",
    "title",
    "fileName",
    "filename",
    "description",
    "displayName",
    "caption",
    "Имя",
    "Название",
    "Наименование",
    "РРјСЏ",
    "РќР°Р·РІР°РЅРёРµ",
    "РќР°РёРјРµРЅРѕРІР°РЅРёРµ",
  ]);
  const name =
    toNonEmptyString(nameRaw) ??
    getFileNameFromUrl(rawUrl) ??
    `Р’Р»РѕР¶РµРЅРёРµ ${index + 1}`;
  const mimeTypeRaw = pickField(record, [
    "mimeType",
    "mime_type",
    "contentType",
    "type",
  ]);
  const sizeRaw = pickField(record, ["size", "fileSize", "Размер", "Р Р°Р·РјРµСЂ"]);

  return {
    name,
    url: normalizeUrl(rawUrl, `attachment-${index + 1}`),
    ...(toNonEmptyString(mimeTypeRaw)
      ? { mimeType: toNonEmptyString(mimeTypeRaw) ?? undefined }
      : {}),
    ...(normalizeInteger(sizeRaw) ? { size: normalizeInteger(sizeRaw) } : {}),
  };
}

function getAttachmentLikeScore(record: Record<string, unknown>): number {
  const name = pickField(record, [
    "name",
    "title",
    "fileName",
    "filename",
    "Имя",
    "Название",
    "РРјСЏ",
    "РќР°Р·РІР°РЅРёРµ",
  ]);
  const url = pickField(record, [
    "external_url",
    "externalUrl",
    "sbis_url",
    "sbisUrl",
    "url",
    "href",
    "link",
    "downloadUrl",
    "fileUrl",
    "relativeUrl",
    "urlToOpen",
    "Ссылка",
    "РЎСЃС‹Р»РєР°",
  ]);

  let score = 0;

  if (toNonEmptyString(name)) {
    score += 1;
  }

  if (toNonEmptyString(url)) {
    score += 3;
  }

  return score;
}

function pickField(record: Record<string, unknown>, aliases: string[]): unknown {
  const normalizedAliases = new Set(aliases.map(normalizeKey));

  for (const [key, value] of Object.entries(record)) {
    if (normalizedAliases.has(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}

function normalizeKey(value: string): string {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/[\s_\-.]/g, "")
    .trim();
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function normalizeDate(value: unknown): string {
  if (typeof value === "number") {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime())
      ? new Date().toISOString()
      : date.toISOString();
  }

  const raw = toNonEmptyString(value);

  if (!raw) {
    return new Date().toISOString();
  }

  const parsedDirect = Date.parse(raw);

  if (!Number.isNaN(parsedDirect)) {
    return new Date(parsedDirect).toISOString();
  }

  const ddmmyyyy = raw.match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2})[:.](\d{2})(?:[:.](\d{2}))?)?$/u,
  );

  if (ddmmyyyy) {
    const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = ddmmyyyy;
    const date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss),
    );

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeBudget(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  const raw = toNonEmptyString(value);

  if (!raw) {
    return undefined;
  }

  const normalized = raw
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const budget = Number(normalized);

  return Number.isFinite(budget) && budget > 0 ? budget : undefined;
}

function normalizeInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  const raw = toNonEmptyString(value);

  if (!raw) {
    return undefined;
  }

  const normalized = raw.replace(/\s+/g, "").replace(/[^\d]/g, "");
  const size = Number(normalized);

  return Number.isInteger(size) && size > 0 ? size : undefined;
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  const raw = toNonEmptyString(value);

  if (!raw) {
    return undefined;
  }

  const normalized = raw.replace(/\s+/g, "").replace(/[^\d]/g, "");
  const numberValue = Number(normalized);

  return Number.isInteger(numberValue) && numberValue >= 0
    ? numberValue
    : undefined;
}

function getFileNameFromUrl(value: string): string | null {
  try {
    const url = /^https?:\/\//i.test(value)
      ? new URL(value)
      : new URL(value, DEFAULT_SABY_BASE_URL);
    const filename = decodeURIComponent(
      url.pathname.split("/").filter(Boolean).at(-1) ?? "",
    );

    return filename.length > 0 ? filename : null;
  } catch {
    return null;
  }
}

export function isSabyUrl(value: string): boolean {
  try {
    const url = /^https?:\/\//i.test(value)
      ? new URL(value)
      : new URL(value, DEFAULT_SABY_BASE_URL);
    const host = url.host.toLocaleLowerCase("en-US");

    return host.includes("saby") || host.includes("sbis");
  } catch {
    return false;
  }
}

function normalizeUrl(value: unknown, tenderId: string): string {
  const raw = toNonEmptyString(value);

  if (!raw) {
    return `${DEFAULT_SABY_BASE_URL}/`;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return new URL(raw, DEFAULT_SABY_BASE_URL).toString();
  }

  return `${DEFAULT_SABY_BASE_URL}/?tender=${encodeURIComponent(tenderId)}`;
}

function filterTendersByKeywords(tenders: Tender[], keywords: string[]): Tender[] {
  const normalizedKeywords = keywords.map((keyword) =>
    keyword.toLocaleLowerCase("ru-RU"),
  );

  return tenders.filter((tender) => {
    const searchableText = [
      tender.title,
      tender.description,
      tender.customer,
      tender.id,
    ]
      .join(" ")
      .toLocaleLowerCase("ru-RU");

    return normalizedKeywords.some((keyword) =>
      searchableText.includes(keyword),
    );
  });
}

const parserEnv = getParserEnv();

export const tenderParserService: ITenderParserService =
  parserEnv.TENDER_PARSER_MODE === "rest"
    ? new RestTenderParserService()
    : parserEnv.TENDER_PARSER_MODE === "saby"
      ? new SabyTenderParserService()
      : new TenderParserService();

export async function fetchTenderParserDailyLimitStatistics() {
  return tenderParserService.fetchDailyLimitStatistics?.() ?? null;
}

export async function fetchTenderParserDocuments(lookup: TenderDocumentLookup) {
  return tenderParserService.fetchTenderDocuments?.(lookup) ?? [];
}

export {
  buildSabyMethodParams,
  buildSabyTenderDocumentLookupRequests,
  buildSabyV4MethodParamsForRequestName,
  filterTendersByKeywords,
  normalizeSabyDailyLimitStatistics,
  normalizeSabyResultToTenders,
};

export async function downloadTenderParserAttachment(attachment: TenderAttachment) {
  if (tenderParserService.downloadAttachment) {
    return tenderParserService.downloadAttachment(attachment);
  }

  const response = await fetch(attachment.url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to download attachment: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type") ?? attachment.mimeType ?? undefined,
    size:
      Number(response.headers.get("content-length")) || attachment.size || undefined,
  };
}
