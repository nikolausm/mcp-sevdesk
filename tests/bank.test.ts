import { describe, it, expect, beforeAll } from "vitest";
import { getClient, hasApiToken } from "./setup.js";
import { accountTools } from "../src/tools/accounts.js";
import { invoiceTools } from "../src/tools/invoices.js";
import { voucherTools } from "../src/tools/vouchers.js";
import type { SevdeskClient } from "../src/client.js";

/** Records the request instead of changing real data in sevdesk. */
function fakeClient() {
  const calls: { method: string; path: string; options: any }[] = [];
  const record = (method: string) => async (path: string, options: any) => {
    calls.push({ method, path, options });
    return { data: { objects: {} }, error: undefined };
  };
  const client = {
    GET: record("GET"),
    POST: record("POST"),
    PUT: record("PUT"),
    DELETE: record("DELETE"),
  } as unknown as SevdeskClient;
  return { client, calls };
}

describe("Bank tools (request bodies)", () => {
  it("update_transaction sendet nur geänderte Felder und keinen Status", async () => {
    const { client, calls } = fakeClient();
    await accountTools.update_transaction.handler(client, {
      transactionId: 5,
      paymtPurpose: "Rechnung 1",
    });

    expect(calls[0].method).toBe("PUT");
    expect(calls[0].options.params.path).toEqual({ checkAccountTransactionId: 5 });
    expect(calls[0].options.body).toEqual({ paymtPurpose: "Rechnung 1" });
    expect(accountTools.update_transaction.inputSchema.shape).not.toHaveProperty("status");
  });

  it("update_check_account wandelt defaultAccount in 0/1 um", async () => {
    const { client, calls } = fakeClient();
    await accountTools.update_check_account.handler(client, {
      checkAccountId: 3,
      defaultAccount: true,
      name: "Hauptkonto",
    });

    expect(calls[0].path).toBe("/CheckAccount/{checkAccountId}");
    expect(calls[0].options.body).toEqual({ name: "Hauptkonto", defaultAccount: 1 });
  });

  it("create_private_transaction_rule verlangt Zweck oder Gegenseite", () => {
    const schema = accountTools.create_private_transaction_rule.inputSchema;
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ counterpartName: "Netflix" }).success).toBe(true);
  });

  it("create_check_account_file_import erlaubt nur CSV oder MT940", () => {
    const schema = accountTools.create_check_account_file_import.inputSchema;
    expect(schema.safeParse({ name: "Bank", importType: "CSV" }).success).toBe(true);
    expect(schema.safeParse({ name: "Bank", importType: "XLS" }).success).toBe(false);
  });

  it("book_invoice und book_voucher geben die Banktransaktion weiter", async () => {
    const { client, calls } = fakeClient();
    await invoiceTools.book_invoice.handler(client, {
      invoiceId: 1,
      amount: 10,
      date: "2026-11-04",
      type: "N",
      checkAccountId: 2,
      checkAccountTransactionId: 99,
    } as any);
    await voucherTools.book_voucher.handler(client, {
      voucherId: 1,
      amount: 10,
      date: "2026-11-04",
      type: "N",
      checkAccountId: 2,
      checkAccountTransactionId: 99,
    } as any);

    for (const call of calls) {
      expect(call.options.body.checkAccountTransaction).toEqual({
        id: 99,
        objectName: "CheckAccountTransaction",
      });
    }
  });
});

describe("Bank tools (lesend)", () => {
  let client: SevdeskClient;

  beforeAll(() => {
    if (hasApiToken) client = getClient();
  });

  it.skipIf(!hasApiToken)("sollte private Transaktionsregeln auflisten können", async () => {
    const result = await accountTools.list_private_transaction_rules.handler(client);
    expect(result).toHaveProperty("objects");
  });
});
