import createClient from "openapi-fetch";
import type { paths } from "./generated/sevdesk-api.js";

const BASE_URL = "https://my.sevdesk.de/api/v1";

/**
 * Without this a stalled sevdesk response leaves the request open forever and
 * the caller just waits with no error to act on.
 */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Query values sevdesk accepts: scalars, or nested objects that are flattened
 * into bracket notation (e.g. `contact[id]=1&contact[objectName]=Contact`).
 */
export type SevdeskQuery = Record<
  string,
  string | number | boolean | null | undefined | Record<string, string | number>
>;

export function toSevdeskQuery(query: SevdeskQuery): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object") {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (subValue === undefined || subValue === null) continue;
        flat[`${key}[${subKey}]`] = String(subValue);
      }
    } else {
      flat[key] = String(value);
    }
  }
  return flat;
}

/**
 * `fetch` with the timeout applied, turning the opaque `TimeoutError` into a
 * message that names the endpoint that stalled.
 */
async function fetchWithTimeout(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      throw new Error(`sevdesk request to ${url} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  }
}

export function createSevdeskClient(apiToken: string) {
  const client = createClient<paths>({
    baseUrl: BASE_URL,
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    fetch: fetchWithTimeout,
  });

  /**
   * Escape hatch for sevdesk endpoints that are not part of the OpenAPI spec
   * (e.g. /StaticCountry, /Category).
   */
  async function request<T = unknown>(
    path: string,
    options: { method?: string; query?: SevdeskQuery; body?: unknown } = {}
  ): Promise<T> {
    const { method = "GET", query, body } = options;
    const search = new URLSearchParams(toSevdeskQuery(query ?? {})).toString();
    const response = await fetchWithTimeout(`${BASE_URL}${path}${search ? `?${search}` : ""}`, {
      method,
      headers: {
        Authorization: apiToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`sevdesk ${method} ${path} failed (${response.status}): ${text}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  /**
   * Multipart upload for endpoints that expect form-data (e.g. voucher file
   * upload). `Content-Type` is left to fetch so the boundary is set correctly.
   */
  async function requestForm<T = unknown>(path: string, form: FormData): Promise<T> {
    const response = await fetchWithTimeout(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: apiToken,
        Accept: "application/json",
      },
      body: form,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`sevdesk POST ${path} failed (${response.status}): ${text}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  /**
   * GET for endpoints that answer with a file (CSV, PDF) instead of JSON, e.g.
   * the list exports and reports. Text is returned as is, anything else as
   * base64. Bodies above `maxBytes` are refused so a huge export cannot flood
   * the caller - narrow the filter or lower the limit instead.
   */
  async function requestFile(
    path: string,
    options: { query?: SevdeskQuery; maxBytes?: number } = {}
  ): Promise<{ contentType: string; encoding: "text" | "base64"; content: string }> {
    const { query, maxBytes = 1_000_000 } = options;
    const search = new URLSearchParams(toSevdeskQuery(query ?? {})).toString();
    const response = await fetchWithTimeout(`${BASE_URL}${path}${search ? `?${search}` : ""}`, {
      headers: { Authorization: apiToken },
    });

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      throw new Error(`sevdesk GET ${path} failed (${response.status}): ${bytes.toString("utf8")}`);
    }
    if (bytes.length > maxBytes) {
      throw new Error(
        `sevdesk GET ${path} returned ${bytes.length} bytes (limit ${maxBytes}). Narrow the filters or set a lower limit.`
      );
    }
    const isText = /^(text\/|application\/(json|csv|xml))/.test(contentType);
    return {
      contentType,
      encoding: isText ? "text" : "base64",
      content: bytes.toString(isText ? "utf8" : "base64"),
    };
  }

  return Object.assign(client, { request, requestForm, requestFile });
}

export type SevdeskClient = ReturnType<typeof createSevdeskClient>;
