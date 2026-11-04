import { describe, it, expect, beforeAll } from "vitest";
import { getClient, hasApiToken } from "./setup.js";
import { invoiceDraftTools } from "../src/tools/invoice-drafts.js";
import { orderTools } from "../src/tools/orders.js";
import { creditNoteTools } from "../src/tools/creditnotes.js";
import type { SevdeskClient } from "../src/client.js";

/** Records the request instead of creating real documents in sevdesk. */
function fakeClient() {
  const calls: { method: string; path: string; options: any }[] = [];
  const record = (method: string) => async (path: string, options: any) => {
    calls.push({ method, path, options });
    return { data: { objects: {} }, error: undefined };
  };
  const client = { GET: record("GET"), POST: record("POST"), PUT: record("PUT") } as unknown as SevdeskClient;
  return { client, calls };
}

const base = {
  contactId: 10,
  contactPersonId: 20,
  date: "2026-11-04",
  positions: [{ name: "Consulting", quantity: 2, price: 100, taxRate: 17 }],
};

describe("Draft document creation (request bodies)", () => {
  it("create_invoice sendet immer einen Entwurf (Status 100)", async () => {
    const { client, calls } = fakeClient();
    await invoiceDraftTools.create_invoice.handler(client, { ...base, deliveryDate: "2026-11-04" });

    expect(calls[0].path).toBe("/Invoice/Factory/saveInvoice");
    const body = calls[0].options.body;
    expect(body.invoice.status).toBe("100");
    expect(body.invoice.invoiceType).toBe("RE");
    expect(body.invoice.contact).toEqual({ id: 10, objectName: "Contact" });
    expect(body.invoice.taxRule).toEqual({ id: 1, objectName: "TaxRule" });
    expect(body.invoicePosSave).toHaveLength(1);
    expect(body.invoicePosSave[0]).toMatchObject({
      objectName: "InvoicePos",
      quantity: 2,
      price: 100,
      taxRate: 17,
      unity: { id: 1, objectName: "Unity" },
    });
  });

  it("create_order sendet einen Entwurf vom Typ Angebot", async () => {
    const { client, calls } = fakeClient();
    await orderTools.create_order.handler(client, { ...base, orderNumber: "AN-1" });

    expect(calls[0].path).toBe("/Order/Factory/saveOrder");
    const body = calls[0].options.body;
    expect(body.order.status).toBe(100);
    expect(body.order.orderType).toBe("AN");
    expect(body.orderPosSave[0].objectName).toBe("OrderPos");
  });

  it("create_credit_note sendet einen Entwurf", async () => {
    const { client, calls } = fakeClient();
    await creditNoteTools.create_credit_note.handler(client, { ...base, creditNoteNumber: "GS-1" });

    expect(calls[0].path).toBe("/CreditNote/Factory/saveCreditNote");
    const body = calls[0].options.body;
    expect(body.creditNote.status).toBe("100");
    expect(body.creditNote.bookingCategory).toBe("UNDERACHIEVEMENT");
    expect(body.creditNotePosSave[0].objectName).toBe("CreditNotePos");
  });

  it("verlangt mindestens eine Position", () => {
    const schema = invoiceDraftTools.create_invoice.inputSchema;
    expect(schema.safeParse({ ...base, deliveryDate: "2026-11-04", positions: [] }).success).toBe(false);
  });
});

describe("Invoicing read tools", () => {
  let client: SevdeskClient;

  beforeAll(() => {
    if (hasApiToken) client = getClient();
  });

  it.skipIf(!hasApiToken)("sollte Angebote/Bestellungen auflisten können", async () => {
    const result = await orderTools.list_orders.handler(client, { limit: 5 });
    expect(result).toHaveProperty("objects");
  });

  it.skipIf(!hasApiToken)("sollte Gutschriften auflisten können", async () => {
    const result = await creditNoteTools.list_credit_notes.handler(client, { limit: 5 });
    expect(result).toHaveProperty("objects");
  });

  it.skipIf(!hasApiToken)("sollte Rechnungspositionen auflisten können", async () => {
    const result = await invoiceDraftTools.list_invoice_positions.handler(client, { limit: 5 });
    expect(result).toHaveProperty("objects");
  });
});
