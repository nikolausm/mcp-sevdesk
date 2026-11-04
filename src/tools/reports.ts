import { z } from "zod";
import type { SevdeskClient } from "../client.js";
import { buildSevQuery } from "./exports.js";

const contactRef = (id: number) => ({ id, objectName: "Contact" });

const dateRange = {
  startDate: z.string().optional().describe("From this date on, ISO 8601 e.g. 2026-01-01"),
  endDate: z.string().optional().describe("Up to this date, ISO 8601 e.g. 2026-12-31"),
  startAmount: z.number().optional().describe("Minimum amount"),
  endAmount: z.number().optional().describe("Maximum amount"),
  contactId: z.number().optional().describe("Only documents of this contact"),
  limit: z.number().optional().describe("Maximum number of rows"),
};

type CommonParams = {
  startDate?: string;
  endDate?: string;
  startAmount?: number;
  endAmount?: number;
  contactId?: number;
  limit?: number;
};

function commonFilter(p: CommonParams) {
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    startAmount: p.startAmount,
    endAmount: p.endAmount,
    contact: p.contactId !== undefined ? contactRef(p.contactId) : undefined,
  };
}

/** Reports are read-only and are returned as file content. */
function runReport(client: SevdeskClient, path: string, query: Record<string, string>) {
  return client.requestFile(path, { query: { download: "false", ...query } });
}

export const reportTools = {
  report_invoices: {
    description: "Invoice list report (returned as file content). Read-only.",
    inputSchema: z.object({
      ...dateRange,
      view: z.string().optional().describe("Report view, default 'all'"),
      invoiceType: z
        .array(z.enum(["Re", "SR", "TR", "AR", "ER", "WKR", "MA"]))
        .optional()
        .describe("Invoice types to include"),
    }),
    handler: async (
      client: SevdeskClient,
      params: CommonParams & { view?: string; invoiceType?: string[] }
    ) =>
      runReport(client, "/Report/invoicelist", {
        view: params.view ?? "all",
        ...buildSevQuery("Invoice", params.limit, {
          ...commonFilter(params),
          invoiceType: params.invoiceType,
        }),
      }),
  },

  report_orders: {
    description: "Order list report (quotes, order confirmations, delivery notes). Read-only.",
    inputSchema: z.object({
      ...dateRange,
      view: z.string().optional().describe("Report view, default 'all'"),
      orderType: z.enum(["AN", "AB", "LI"]).optional().describe("AN = quotes, AB = orders, LI = delivery notes"),
    }),
    handler: async (
      client: SevdeskClient,
      params: CommonParams & { view?: string; orderType?: "AN" | "AB" | "LI" }
    ) =>
      runReport(client, "/Report/orderlist", {
        view: params.view ?? "all",
        ...buildSevQuery("Order", params.limit, {
          ...commonFilter(params),
          orderType: params.orderType,
        }),
      }),
  },

  report_vouchers: {
    description: "Voucher (receipt) list report. Read-only.",
    inputSchema: z.object({
      ...dateRange,
      startPayDate: z.string().optional().describe("Paid from this date on, ISO 8601"),
      endPayDate: z.string().optional().describe("Paid up to this date, ISO 8601"),
    }),
    handler: async (
      client: SevdeskClient,
      params: CommonParams & { startPayDate?: string; endPayDate?: string }
    ) =>
      runReport(
        client,
        "/Report/voucherlist",
        buildSevQuery("Voucher", params.limit, {
          ...commonFilter(params),
          startPayDate: params.startPayDate,
          endPayDate: params.endPayDate,
        })
      ),
  },

  report_contacts: {
    description: "Contact list report. Read-only.",
    inputSchema: z.object({
      zip: z.number().optional().describe("Filter by zip code"),
      city: z.string().optional().describe("Filter by city"),
      countryId: z.number().optional().describe("Filter by country ID (see list_countries)"),
      onlyOrganisations: z.boolean().optional().describe("Only organisations"),
      onlyPeople: z.boolean().optional().describe("Only people"),
      limit: z.number().optional().describe("Maximum number of rows"),
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        zip?: number;
        city?: string;
        countryId?: number;
        onlyOrganisations?: boolean;
        onlyPeople?: boolean;
        limit?: number;
      }
    ) =>
      runReport(
        client,
        "/Report/contactlist",
        buildSevQuery("Contact", params.limit, {
          zip: params.zip,
          city: params.city,
          country:
            params.countryId !== undefined
              ? { id: params.countryId, objectName: "StaticCountry" }
              : undefined,
          depth: params.onlyOrganisations,
          onlyPeople: params.onlyPeople,
        })
      ),
  },
};
