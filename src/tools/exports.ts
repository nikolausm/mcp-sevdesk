import { z } from "zod";
import type { SevdeskClient } from "../client.js";

/**
 * sevdesk expects the `sevQuery` parameter in PHP bracket notation
 * (`sevQuery[filter][startDate]=...`), which the generated client does not
 * produce for nested objects, so queries are flattened by hand.
 */
export function flattenQuery(
  prefix: string,
  value: unknown,
  out: Record<string, string> = {}
): Record<string, string> {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => flattenQuery(`${prefix}[${i}]`, item, out));
  } else if (typeof value === "object") {
    for (const [key, sub] of Object.entries(value)) flattenQuery(`${prefix}[${key}]`, sub, out);
  } else {
    out[prefix] = String(value);
  }
  return out;
}

const contactRef = (id: number) => ({ id, objectName: "Contact" });

const dateRange = {
  startDate: z.string().optional().describe("Only documents from this date on, ISO 8601 e.g. 2026-01-01"),
  endDate: z.string().optional().describe("Only documents up to this date, ISO 8601 e.g. 2026-12-31"),
};

const amountRange = {
  startAmount: z.number().optional().describe("Minimum amount"),
  endAmount: z.number().optional().describe("Maximum amount"),
};

const limitField = z.number().optional().describe("Maximum number of rows to export");

const invoiceTypes = z
  .array(z.enum(["Re", "SR", "TR", "AR", "ER", "WKR", "MA"]))
  .optional()
  .describe("Invoice types: Re = invoice, SR = cancellation, TR = partial, AR = advance, ER = final, WKR = recurring, MA = reminder");

type RangeParams = { startDate?: string; endDate?: string; startAmount?: number; endAmount?: number };

/** Builds the flattened `sevQuery[...]` query for a list export / report. */
export function buildSevQuery(
  modelName: string,
  limit: number | undefined,
  filter: Record<string, unknown>
): Record<string, string> {
  return flattenQuery("sevQuery", { modelName, objectName: "SevQuery", limit, filter });
}

function toTimestamp(date: string): number {
  const ms = Date.parse(date);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${date}`);
  return Math.floor(ms / 1000);
}

/** Read-only: these endpoints return the CSV content, they do not change data. */
async function runExport(client: SevdeskClient, path: string, query: Record<string, string>) {
  return client.requestFile(path, { query: { download: "false", ...query } });
}

export const exportTools = {
  start_datev_csv_export: {
    description:
      "Start a DATEV CSV ZIP export job for a period and return the job ID. Poll with get_export_progress, then fetch the file link with get_export_download_info. Documents are never enshrined by this tool. The accounting year start must be set in sevdesk first.",
    inputSchema: z.object({
      startDate: z.string().describe("Start of the period, ISO 8601 e.g. 2026-01-01"),
      endDate: z.string().describe("End of the period, ISO 8601 e.g. 2026-12-31"),
      scope: z
        .string()
        .describe(
          "Letters for what to include: E = earnings, X = expenditure, T = transactions, C = cash register, D = assets (e.g. EXTCD)"
        ),
      exportByPaydate: z.boolean().optional().describe("Select documents by pay date instead of document date"),
      includeEnshrined: z.boolean().optional().describe("Include already enshrined documents (default true)"),
      includeDocumentImages: z.boolean().optional().describe("Include the document images in the ZIP"),
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        startDate: string;
        endDate: string;
        scope: string;
        exportByPaydate?: boolean;
        includeEnshrined?: boolean;
        includeDocumentImages?: boolean;
      }
    ) =>
      client.request("/Export/createDatevCsvZipExportJob", {
        query: {
          startDate: toTimestamp(params.startDate),
          endDate: toTimestamp(params.endDate),
          scope: params.scope,
          exportByPaydate: params.exportByPaydate,
          includeEnshrined: params.includeEnshrined,
          enshrineDocuments: false,
          includeDocumentImages: params.includeDocumentImages,
        },
      }),
  },

  start_datev_xml_export: {
    description:
      "Start a DATEV XML ZIP export job for a period and return the job ID. Poll with get_export_progress, then fetch the file link with get_export_download_info. The accounting year start must be set in sevdesk first.",
    inputSchema: z.object({
      startDate: z.string().describe("Start of the period, ISO 8601"),
      endDate: z.string().describe("End of the period, ISO 8601"),
      scope: z.string().describe("Letters for what to include: E = receipts, outgoing invoices & credit notes, X = expenditure documents (e.g. EX)"),
      exportByPaydate: z.boolean().optional().describe("Select documents by pay date instead of document date"),
      includeEnshrined: z.boolean().optional().describe("Include enshrined documents (default true)"),
      includeExportedDocuments: z.boolean().optional().describe("Include documents that were already exported"),
      includeDocumentXml: z.boolean().optional().describe("Include the document XML"),
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        startDate: string;
        endDate: string;
        scope: string;
        exportByPaydate?: boolean;
        includeEnshrined?: boolean;
        includeExportedDocuments?: boolean;
        includeDocumentXml?: boolean;
      }
    ) =>
      client.request("/Export/createDatevXmlZipExportJob", {
        query: {
          startDate: new Date(params.startDate).toISOString(),
          endDate: new Date(params.endDate).toISOString(),
          scope: params.scope,
          exportByPaydate: params.exportByPaydate,
          includeEnshrined: params.includeEnshrined,
          includeExportedDocuments: params.includeExportedDocuments,
          includeDocumentXml: params.includeDocumentXml,
        },
      }),
  },

  get_export_progress: {
    description:
      "Check the progress of an export job (current / total). Pass the job ID returned by start_datev_csv_export / start_datev_xml_export.",
    inputSchema: z.object({ jobId: z.string().describe("The export job ID") }),
    handler: async (client: SevdeskClient, params: { jobId: string }) => {
      const hash = await client.request<{ objects?: string }>("/Progress/generateDownloadHash", {
        query: { jobId: params.jobId },
      });
      if (!hash.objects) throw new Error(`No progress hash returned: ${JSON.stringify(hash)}`);
      return client.request("/Progress/getProgress", { query: { hash: hash.objects } });
    },
  },

  get_export_download_info: {
    description: "Get the file name and download link of a finished export job",
    inputSchema: z.object({ jobId: z.string().describe("The export job ID") }),
    handler: async (client: SevdeskClient, params: { jobId: string }) =>
      client.request("/ExportJob/jobDownloadInfo", { query: { jobId: params.jobId } }),
  },

  export_invoices_csv: {
    description: "Export invoices as CSV (returned as file content). Read-only.",
    inputSchema: z.object({
      ...dateRange,
      ...amountRange,
      invoiceType: invoiceTypes,
      contactId: z.number().optional().describe("Only invoices of this contact"),
      limit: limitField,
    }),
    handler: async (
      client: SevdeskClient,
      params: RangeParams & { invoiceType?: string[]; contactId?: number; limit?: number }
    ) =>
      runExport(
        client,
        "/Export/invoiceCsv",
        buildSevQuery("Invoice", params.limit, {
          invoiceType: params.invoiceType,
          startDate: params.startDate,
          endDate: params.endDate,
          startAmount: params.startAmount,
          endAmount: params.endAmount,
          contact: params.contactId !== undefined ? contactRef(params.contactId) : undefined,
        })
      ),
  },

  export_credit_notes_csv: {
    description: "Export credit notes as CSV (returned as file content). Read-only.",
    inputSchema: z.object({
      ...dateRange,
      ...amountRange,
      contactId: z.number().optional().describe("Only credit notes of this contact"),
      limit: limitField,
    }),
    handler: async (
      client: SevdeskClient,
      params: RangeParams & { contactId?: number; limit?: number }
    ) =>
      runExport(
        client,
        "/Export/creditNoteCsv",
        buildSevQuery("CreditNote", params.limit, {
          startDate: params.startDate,
          endDate: params.endDate,
          startAmount: params.startAmount,
          endAmount: params.endAmount,
          contact: params.contactId !== undefined ? contactRef(params.contactId) : undefined,
        })
      ),
  },

  export_vouchers_csv: {
    description: "Export vouchers (receipts) as CSV (returned as file content). Read-only.",
    inputSchema: z.object({
      ...dateRange,
      ...amountRange,
      startPayDate: z.string().optional().describe("Only vouchers paid from this date on, ISO 8601"),
      endPayDate: z.string().optional().describe("Only vouchers paid up to this date, ISO 8601"),
      contactId: z.number().optional().describe("Only vouchers of this supplier"),
      limit: limitField,
    }),
    handler: async (
      client: SevdeskClient,
      params: RangeParams & {
        startPayDate?: string;
        endPayDate?: string;
        contactId?: number;
        limit?: number;
      }
    ) =>
      runExport(
        client,
        "/Export/voucherListCsv",
        buildSevQuery("Voucher", params.limit, {
          startDate: params.startDate,
          endDate: params.endDate,
          startPayDate: params.startPayDate,
          endPayDate: params.endPayDate,
          startAmount: params.startAmount,
          endAmount: params.endAmount,
          contact: params.contactId !== undefined ? contactRef(params.contactId) : undefined,
        })
      ),
  },

  export_transactions_csv: {
    description: "Export bank transactions as CSV (returned as file content). Read-only.",
    inputSchema: z.object({
      ...dateRange,
      ...amountRange,
      checkAccountId: z.number().optional().describe("Only transactions of this bank account"),
      paymtPurpose: z.string().optional().describe("Filter by payment purpose"),
      name: z.string().optional().describe("Filter by payee / payer name"),
      limit: limitField,
    }),
    handler: async (
      client: SevdeskClient,
      params: RangeParams & {
        checkAccountId?: number;
        paymtPurpose?: string;
        name?: string;
        limit?: number;
      }
    ) =>
      runExport(
        client,
        "/Export/transactionsCsv",
        buildSevQuery("CheckAccountTransaction", params.limit, {
          startDate: params.startDate,
          endDate: params.endDate,
          startAmount: params.startAmount,
          endAmount: params.endAmount,
          paymtPurpose: params.paymtPurpose,
          name: params.name,
          checkAccount:
            params.checkAccountId !== undefined
              ? { id: params.checkAccountId, objectName: "CheckAccount" }
              : undefined,
        })
      ),
  },

  export_contacts_csv: {
    description: "Export contacts as CSV (returned as file content). Read-only.",
    inputSchema: z.object({
      zip: z.number().optional().describe("Filter by zip code"),
      city: z.string().optional().describe("Filter by city"),
      countryId: z.number().optional().describe("Filter by country ID (see list_countries)"),
      onlyOrganisations: z.boolean().optional().describe("Export only organisations"),
      onlyPeople: z.boolean().optional().describe("Export only people"),
      limit: limitField,
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
      runExport(
        client,
        "/Export/contactListCsv",
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
