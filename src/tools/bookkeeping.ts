import { z } from "zod";
import type { SevdeskClient } from "../client.js";

export const bookkeepingTools = {
  update_voucher: {
    description:
      "Update the header data of a draft voucher (date, supplier, description, deadlines, tax rule). Only the fields you pass are changed. It cannot change the status and does not touch positions - sevdesk rejects changes to enshrined vouchers.",
    inputSchema: z.object({
      voucherId: z.number().describe("The ID of the voucher"),
      voucherDate: z.string().optional().describe("Voucher date, ISO 8601"),
      supplierId: z.number().optional().describe("ID of the supplier contact"),
      supplierName: z.string().nullable().optional().describe("Supplier name if there is no contact"),
      description: z.string().nullable().optional().describe("Voucher number / description"),
      payDate: z.string().nullable().optional().describe("Pay date, ISO 8601"),
      paymentDeadline: z.string().nullable().optional().describe("Payment deadline, ISO 8601"),
      deliveryDate: z.string().optional().describe("Delivery date, ISO 8601"),
      currency: z.string().nullable().optional().describe("ISO 4217 currency code"),
      taxRuleId: z.number().optional().describe("Tax rule ID (bookkeeping version 2.0)"),
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        voucherId: number;
        voucherDate?: string;
        supplierId?: number;
        supplierName?: string | null;
        description?: string | null;
        payDate?: string | null;
        paymentDeadline?: string | null;
        deliveryDate?: string;
        currency?: string | null;
        taxRuleId?: number;
      }
    ) => {
      const { voucherId, supplierId, taxRuleId, ...rest } = params;
      const body: Record<string, unknown> = { ...rest };
      if (supplierId !== undefined) body.supplier = { id: supplierId, objectName: "Contact" };
      if (taxRuleId !== undefined) body.taxRule = { id: taxRuleId, objectName: "TaxRule" };
      const { data, error } = await client.PUT("/Voucher/{voucherId}", {
        params: { path: { voucherId } },
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_receipt_guidance_for_account_number: {
    description:
      "Get the receipt guidance for a booking account number: which tax rules and settings are allowed for it. Use it to pick valid voucher position values.",
    inputSchema: z.object({
      accountNumber: z.number().describe("The booking account number, e.g. 6300"),
    }),
    handler: async (client: SevdeskClient, params: { accountNumber: number }) =>
      client.request("/ReceiptGuidance/forAccountNumber", {
        query: { accountNumber: params.accountNumber },
      }),
  },

  get_receipt_guidance_for_tax_rule: {
    description:
      "Get the receipt guidance for a tax rule: which booking accounts can be used with it.",
    inputSchema: z.object({
      taxRule: z.string().describe("The tax rule, as returned by list_booking_accounts"),
    }),
    handler: async (client: SevdeskClient, params: { taxRule: string }) =>
      client.request("/ReceiptGuidance/forTaxRule", { query: { taxRule: params.taxRule } }),
  },
};
