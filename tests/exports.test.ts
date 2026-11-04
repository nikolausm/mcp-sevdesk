import { describe, it, expect, beforeAll } from "vitest";
import { getClient, hasApiToken } from "./setup.js";
import { exportTools, flattenQuery, buildSevQuery } from "../src/tools/exports.js";
import { reportTools } from "../src/tools/reports.js";
import { bookkeepingTools } from "../src/tools/bookkeeping.js";
import type { SevdeskClient } from "../src/client.js";

/** Records the request instead of calling sevdesk. */
function fakeClient() {
  const calls: { method: string; path: string; options: any }[] = [];
  const client = {
    request: async (path: string, options: any) => {
      calls.push({ method: options?.method ?? "GET", path, options });
      return { objects: "x" };
    },
    requestFile: async (path: string, options: any) => {
      calls.push({ method: "GET", path, options });
      return { contentType: "text/csv", encoding: "text", content: "x" };
    },
    PUT: async (path: string, options: any) => {
      calls.push({ method: "PUT", path, options });
      return { data: { objects: {} }, error: undefined };
    },
  } as unknown as SevdeskClient;
  return { client, calls };
}

describe("sevQuery flattening", () => {
  it("nutzt Klammer-Notation für verschachtelte Objekte und Arrays", () => {
    expect(
      flattenQuery("sevQuery", { filter: { contact: { id: 5 }, invoiceType: ["Re", "SR"] }, limit: undefined })
    ).toEqual({
      "sevQuery[filter][contact][id]": "5",
      "sevQuery[filter][invoiceType][0]": "Re",
      "sevQuery[filter][invoiceType][1]": "SR",
    });
  });

  it("setzt modelName und objectName", () => {
    expect(buildSevQuery("Invoice", 10, {})).toMatchObject({
      "sevQuery[modelName]": "Invoice",
      "sevQuery[objectName]": "SevQuery",
      "sevQuery[limit]": "10",
    });
  });
});

describe("Export tools (request shape)", () => {
  it("DATEV-CSV-Export schreibt niemals Belege fest", async () => {
    const { client, calls } = fakeClient();
    await exportTools.start_datev_csv_export.handler(client, {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      scope: "EXTCD",
    });

    expect(calls[0].path).toBe("/Export/createDatevCsvZipExportJob");
    expect(calls[0].options.query.enshrineDocuments).toBe(false);
    expect(typeof calls[0].options.query.startDate).toBe("number");
    expect(exportTools.start_datev_csv_export.inputSchema.shape).not.toHaveProperty("enshrineDocuments");
  });

  it("Rechnungs-Export übergibt Filter als sevQuery", async () => {
    const { client, calls } = fakeClient();
    await exportTools.export_invoices_csv.handler(client, {
      startDate: "2026-01-01",
      contactId: 7,
      limit: 5,
    });

    expect(calls[0].path).toBe("/Export/invoiceCsv");
    expect(calls[0].options.query).toMatchObject({
      "sevQuery[modelName]": "Invoice",
      "sevQuery[filter][startDate]": "2026-01-01",
      "sevQuery[filter][contact][id]": "7",
      "sevQuery[filter][contact][objectName]": "Contact",
    });
  });

  it("Bericht verwendet die Ansicht 'all' als Standard", async () => {
    const { client, calls } = fakeClient();
    await reportTools.report_invoices.handler(client, {});
    expect(calls[0].path).toBe("/Report/invoicelist");
    expect(calls[0].options.query.view).toBe("all");
  });

  it("update_voucher ändert keinen Status und baut Referenzen", async () => {
    const { client, calls } = fakeClient();
    await bookkeepingTools.update_voucher.handler(client, {
      voucherId: 3,
      supplierId: 9,
      description: "RE-1",
    });

    expect(calls[0].options.params.path).toEqual({ voucherId: 3 });
    expect(calls[0].options.body).toEqual({
      description: "RE-1",
      supplier: { id: 9, objectName: "Contact" },
    });
    expect(bookkeepingTools.update_voucher.inputSchema.shape).not.toHaveProperty("status");
  });
});

describe("Exports & reports (lesend)", () => {
  let client: SevdeskClient;

  beforeAll(() => {
    if (hasApiToken) client = getClient();
  });

  it.skipIf(!hasApiToken)("sollte einen Kontakt-CSV-Export mit Limit liefern", async () => {
    const result: any = await exportTools.export_contacts_csv.handler(client, { limit: 1 });
    expect(result.encoding).toBe("text");
    expect(result.content.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasApiToken)("sollte einen Rechnungsbericht liefern", async () => {
    const result: any = await reportTools.report_invoices.handler(client, { limit: 1 });
    expect(result.contentType).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  });
});
