import createClient from "openapi-fetch";
import type { paths } from "./generated/sevdesk-api.js";

const BASE_URL = "https://my.sevdesk.de/api/v1";

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

export function createSevdeskClient(apiToken: string) {
  const client = createClient<paths>({
    baseUrl: BASE_URL,
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
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
    const response = await fetch(`${BASE_URL}${path}${search ? `?${search}` : ""}`, {
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

  return Object.assign(client, { request });
}

export type SevdeskClient = ReturnType<typeof createSevdeskClient>;
