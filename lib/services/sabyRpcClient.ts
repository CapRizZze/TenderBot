import { getParserEnv } from "@/lib/env";

interface JsonRpcSuccess<T> {
  result: T;
  error?: never;
}

interface JsonRpcFailure {
  result?: never;
  error: string;
}

export type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

const DEFAULT_SBIS_AUTH_METHOD = "СБИС.Аутентифицировать";
const DEFAULT_TENDER_SERVICE_URL =
  "https://trade.saby.ru/tender/service/?x_version=26.3202-36.4";
const DEFAULT_SERVICE_URL =
  "https://trade.saby.ru/service/?x_version=26.3202-36.4";

export class SabyRpcClient {
  private readonly env = getParserEnv();
  private sidCache: { sid: string; expiresAt: number } | null = null;

  async authenticate(): Promise<string> {
    const authUrl = this.env.SABY_AUTH_URL;
    const login = this.env.SABY_LOGIN;
    const password = this.env.SABY_PASSWORD;

    if (!authUrl || !login || !password) {
      throw new Error("Saby RPC client is not fully configured");
    }

    if (this.sidCache && this.sidCache.expiresAt > Date.now()) {
      return this.sidCache.sid;
    }

    const authPayloads: Array<Record<string, unknown>> = [
      {
        jsonrpc: "2.0",
        method: DEFAULT_SBIS_AUTH_METHOD,
        params: {
          Параметр: {
            Логин: login,
            Пароль: password,
          },
        },
        id: "rpc-auth-1",
      },
      {
        jsonrpc: "2.0",
        method: DEFAULT_SBIS_AUTH_METHOD,
        params: {
          login,
          password,
        },
        id: "rpc-auth-2",
      },
    ];

    const errors: string[] = [];

    for (const payload of authPayloads) {
      const response = await this.callJsonRpc(authUrl, payload);

      if ("error" in response && typeof response.error === "string") {
        errors.push(response.error);
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

      errors.push("response does not contain SID");
    }

    throw new Error(`Saby RPC authentication failed: ${errors.join("; ")}`);
  }

  async callTenderService<T>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<JsonRpcResponse<T>> {
    return this.callProtected<T>(DEFAULT_TENDER_SERVICE_URL, method, params, {
      protocol: 7,
    });
  }

  async callService<T>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<JsonRpcResponse<T>> {
    return this.callProtected<T>(DEFAULT_SERVICE_URL, method, params);
  }

  async callTradeService<T>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<JsonRpcResponse<T>> {
    return this.callProtected<T>(DEFAULT_SERVICE_URL, method, params, {
      protocol: 7,
    });
  }

  private async callProtected<T>(
    url: string,
    method: string,
    params: Record<string, unknown>,
    extraPayload: Record<string, unknown> = {},
  ): Promise<JsonRpcResponse<T>> {
    const sid = await this.authenticate();

    return this.callJsonRpc<T>(
      url,
      {
        jsonrpc: "2.0",
        ...extraPayload,
        method,
        params,
        id: `${method}-${Math.random().toString(36).slice(2)}`,
      },
      sid,
    );
  }

  private async callJsonRpc<T>(
    url: string,
    payload: Record<string, unknown>,
    sid?: string,
  ): Promise<JsonRpcResponse<T>> {
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

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
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

    return { result: rpc.result as T };
  }
}

function extractSid(result: unknown): string | null {
  if (typeof result === "string" && result.trim().length > 0) {
    return result.trim();
  }

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const record = result as Record<string, unknown>;
  const directSid = record.sid ?? record.SID ?? record.Sid;

  if (typeof directSid === "string" && directSid.trim().length > 0) {
    return directSid.trim();
  }

  const nestedSession = record.session;

  if (
    nestedSession &&
    typeof nestedSession === "object" &&
    !Array.isArray(nestedSession)
  ) {
    const nestedSid = (nestedSession as Record<string, unknown>).sid;

    if (typeof nestedSid === "string" && nestedSid.trim().length > 0) {
      return nestedSid.trim();
    }
  }

  return null;
}

export const sabyRpcClient = new SabyRpcClient();
