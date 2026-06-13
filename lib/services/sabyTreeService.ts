import { sabyRpcClient, type JsonRpcResponse } from "@/lib/services/sabyRpcClient";

export interface SabyTreeItem {
  id: number;
  name: string;
  parent: number | null;
  kind: "folder" | "query" | string;
  active?: boolean;
  unreadNewCount?: number;
  totalAppReceivingCount?: number;
  username?: string;
}

interface SabyRecordsetField {
  n?: string;
}

interface SabyRecordset {
  d?: unknown[];
  s?: SabyRecordsetField[];
  _type?: string;
}

export class SabyTreeService {
  async getRootItems(): Promise<SabyTreeItem[]> {
    return this.readTreeItems(null);
  }

  async getFolderItems(folderId: number): Promise<SabyTreeItem[]> {
    return this.readTreeItems(folderId);
  }

  async getQueryConfig(queryId: number): Promise<Record<string, unknown>> {
    const response = await sabyRpcClient.callTenderService<Record<string, unknown>>(
      "Query.GetQuery",
      {
        query_id: queryId,
      },
    );

    if ("error" in response) {
      throw new Error(`Failed to read Saby query config: ${response.error}`);
    }

    return normalizeRecordValue(response.result);
  }

  async getQueryCounters(queryId: number): Promise<JsonRpcResponse<unknown>> {
    return sabyRpcClient.callTenderService("Query.get_counters_by_id", {
      query_ids: [queryId],
    });
  }

  private async readTreeItems(parent: number | null): Promise<SabyTreeItem[]> {
    const response = await sabyRpcClient.callTenderService<SabyRecordset>(
      "Query.query_list",
      buildQueryListParams(parent),
    );

    if ("error" in response) {
      throw new Error(`Failed to read Saby tree: ${response.error}`);
    }

    return normalizeTreeItemsFromRecordset(response.result);
  }
}

function buildQueryListParams(parent: number | null) {
  return {
    Фильтр: {
      d: [false, parent, true, true, 1, true],
      s: [
        { t: "Логическое", n: "is_new_rp" },
        { t: "Число целое", n: "parent" },
        { t: "Логическое", n: "show_interesting_comp" },
        { t: "Логическое", n: "show_our_industry" },
        { t: "Число целое", n: "tenderType" },
        { t: "Логическое", n: "user_folders_first" },
      ],
      _type: "record",
      f: 0,
    },
    Сортировка: null,
    Навигация: {
      d: [true, 100, 0],
      s: [
        { t: "Логическое", n: "ЕстьЕще" },
        { t: "Число целое", n: "РазмерСтраницы" },
        { t: "Число целое", n: "Страница" },
      ],
      _type: "record",
      f: 0,
    },
    ДопПоля: [],
  };
}

function normalizeTreeItemsFromRecordset(recordset: SabyRecordset): SabyTreeItem[] {
  const columns = Array.isArray(recordset?.s)
    ? recordset.s
        .map((field) => (typeof field?.n === "string" ? field.n : null))
        .filter((value): value is string => Boolean(value))
    : [];
  const rows = Array.isArray(recordset?.d) ? recordset.d : [];

  return rows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => mapRecordsetRowToTreeItem(row, columns))
    .filter((item): item is SabyTreeItem => item !== null);
}

function normalizeRecordValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const maybeRecordset = value as SabyRecordset;
  const normalizedRecordset = normalizeSingleRecordFromRecordset(maybeRecordset);

  if (normalizedRecordset) {
    return normalizedRecordset;
  }

  return value as Record<string, unknown>;
}

function normalizeSingleRecordFromRecordset(
  recordset: SabyRecordset,
): Record<string, unknown> | null {
  const columns = Array.isArray(recordset?.s)
    ? recordset.s
        .map((field) => (typeof field?.n === "string" ? field.n : null))
        .filter((value): value is string => Boolean(value))
    : [];
  const row = Array.isArray(recordset?.d) ? recordset.d : null;

  if (columns.length === 0 || !row) {
    return null;
  }

  return Object.fromEntries(columns.map((column, index) => [column, row[index]]));
}

function mapRecordsetRowToTreeItem(
  row: unknown[],
  columns: string[],
): SabyTreeItem | null {
  const item = Object.fromEntries(columns.map((column, index) => [column, row[index]]));
  const id = toNumber(item.id);
  const name = toStringValue(item.name);
  const kind = toStringValue(item.kind);

  if (!Number.isFinite(id) || !name || (kind !== "folder" && kind !== "query")) {
    return null;
  }

  return {
    id,
    name,
    parent: toNullableNumber(item.parent),
    kind,
    active: toOptionalBoolean(item.active),
    unreadNewCount: toOptionalNumber(item.unread_new_count),
    totalAppReceivingCount: toOptionalNumber(item.total_app_receiving_count),
    username: toOptionalString(item.username),
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return Number(value);
  }

  return Number.NaN;
}

function toNullableNumber(value: unknown): number | null {
  const normalized = toNumber(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function toOptionalNumber(value: unknown): number | undefined {
  const normalized = toNumber(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export const sabyTreeService = new SabyTreeService();
export { normalizeRecordValue };
