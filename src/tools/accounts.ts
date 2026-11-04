import { z } from "zod";
import type { SevdeskClient } from "../client.js";

export const accountTools = {
  list_check_accounts: {
    description: "List all check accounts (bank accounts) from sevdesk",
    inputSchema: z.object({
      limit: z.number().optional().describe("Limit the number of results"),
      offset: z.number().optional().describe("Skip a number of results"),
    }),
    handler: async (client: SevdeskClient, params: {
      limit?: number;
      offset?: number;
    }) => {
      const { data, error } = await client.GET("/CheckAccount", {});
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_check_account: {
    description: "Get a specific check account by ID",
    inputSchema: z.object({
      checkAccountId: z.number().describe("The ID of the check account"),
    }),
    handler: async (client: SevdeskClient, params: { checkAccountId: number }) => {
      const { data, error } = await client.GET("/CheckAccount/{checkAccountId}", {
        params: {
          path: { checkAccountId: params.checkAccountId },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_check_account_balance: {
    description: "Get the current balance of a check account",
    inputSchema: z.object({
      checkAccountId: z.number().describe("The ID of the check account"),
      date: z.string().optional().describe("Date for the balance (Unix timestamp). Default: now"),
    }),
    handler: async (client: SevdeskClient, params: {
      checkAccountId: number;
      date?: string;
    }) => {
      const { data, error } = await client.GET("/CheckAccount/{checkAccountId}/getBalanceAtDate", {
        params: {
          path: { checkAccountId: params.checkAccountId },
          query: {
            date: params.date ?? new Date().toISOString().split('T')[0],
          },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_transactions: {
    description: "List all transactions of a check account",
    inputSchema: z.object({
      checkAccountId: z.number().describe("The ID of the check account"),
      startDate: z.string().optional().describe("Filter by start date (Unix timestamp)"),
      endDate: z.string().optional().describe("Filter by end date (Unix timestamp)"),
      paymtPurpose: z.string().optional().describe("Filter by payment purpose"),
      isBooked: z.boolean().optional().describe("Filter by booked status"),
      limit: z.number().optional().describe("Limit the number of results"),
      offset: z.number().optional().describe("Skip a number of results"),
    }),
    handler: async (client: SevdeskClient, params: {
      checkAccountId: number;
      startDate?: string;
      endDate?: string;
      paymtPurpose?: string;
      isBooked?: boolean;
      limit?: number;
      offset?: number;
    }) => {
      const { data, error } = await client.GET("/CheckAccountTransaction", {
        params: {
          query: {
            "checkAccount[id]": params.checkAccountId,
            "checkAccount[objectName]": "CheckAccount",
            startDate: params.startDate ? Number(params.startDate) : undefined,
            endDate: params.endDate ? Number(params.endDate) : undefined,
            paymtPurpose: params.paymtPurpose,
            isBooked: params.isBooked,
            limit: params.limit,
            offset: params.offset,
          } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_transaction: {
    description: "Get a specific transaction by ID",
    inputSchema: z.object({
      transactionId: z.number().describe("The ID of the transaction"),
    }),
    handler: async (client: SevdeskClient, params: { transactionId: number }) => {
      const { data, error } = await client.GET("/CheckAccountTransaction/{checkAccountTransactionId}", {
        params: {
          path: { checkAccountTransactionId: params.transactionId },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_transaction: {
    description: "Create a new transaction in a check account",
    inputSchema: z.object({
      checkAccountId: z.number().describe("The ID of the check account"),
      amount: z.number().describe("Transaction amount (positive for credit, negative for debit)"),
      valueDate: z.string().describe("Value date (ISO date string YYYY-MM-DD)"),
      entryDate: z.string().optional().describe("Entry date (ISO date string YYYY-MM-DD)"),
      paymtPurpose: z.string().optional().describe("Payment purpose/description"),
      payeePayerName: z.string().optional().describe("Name of payee or payer"),
      payeePayerAcctNo: z.string().optional().describe("Account number of payee/payer"),
      payeePayerBankCode: z.string().optional().describe("Bank code of payee/payer"),
    }),
    handler: async (client: SevdeskClient, params: {
      checkAccountId: number;
      amount: number;
      valueDate: string;
      entryDate?: string;
      paymtPurpose?: string;
      payeePayerName?: string;
      payeePayerAcctNo?: string;
      payeePayerBankCode?: string;
    }) => {
      const { data, error } = await client.POST("/CheckAccountTransaction", {
        body: {
          checkAccount: {
            id: params.checkAccountId,
            objectName: "CheckAccount",
          },
          amount: params.amount,
          valueDate: params.valueDate,
          entryDate: params.entryDate,
          paymtPurpose: params.paymtPurpose,
          payeePayerName: params.payeePayerName,
          payeePayerAcctNo: params.payeePayerAcctNo,
          payeePayerBankCode: params.payeePayerBankCode,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_transaction: {
    description:
      "Update an existing, not yet enshrined bank transaction (e.g. correct the payment purpose or payer name). Booking and status changes are not possible here - link a transaction with book_invoice / book_voucher instead.",
    inputSchema: z.object({
      transactionId: z.number().describe("The ID of the transaction"),
      valueDate: z.string().optional().describe("Value date (ISO date string YYYY-MM-DD)"),
      entryDate: z.string().nullable().optional().describe("Entry date (ISO date string YYYY-MM-DD)"),
      amount: z.number().optional().describe("Amount (positive for credit, negative for debit)"),
      paymtPurpose: z.string().optional().describe("Payment purpose/description"),
      payeePayerName: z.string().nullable().optional().describe("Name of payee or payer"),
    }),
    handler: async (client: SevdeskClient, params: {
      transactionId: number;
      valueDate?: string;
      entryDate?: string | null;
      amount?: number;
      paymtPurpose?: string;
      payeePayerName?: string | null;
    }) => {
      const { transactionId, ...body } = params;
      const { data, error } = await client.PUT("/CheckAccountTransaction/{checkAccountTransactionId}", {
        params: { path: { checkAccountTransactionId: transactionId } },
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_check_account_file_import: {
    description:
      "Create a bank account that receives transactions through file import (CSV or MT940). Use create_transaction or the sevdesk import to fill it afterwards.",
    inputSchema: z.object({
      name: z.string().describe("Name of the bank account"),
      importType: z.enum(["CSV", "MT940"]).describe("Import type"),
      iban: z.string().optional().describe("IBAN without spaces"),
      accountingNumber: z
        .number()
        .optional()
        .describe("Booking account (e.g. 1200 in SKR03, 1800 in SKR04). Must be unique; omit for a default."),
    }),
    handler: async (client: SevdeskClient, params: {
      name: string;
      importType: "CSV" | "MT940";
      iban?: string;
      accountingNumber?: number;
    }) => {
      const { data, error } = await client.POST("/CheckAccount/Factory/fileImportAccount", {
        body: params as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_check_account_clearing: {
    description:
      "Create a clearing account (Verrechnungskonto, e.g. for coupons or payment providers). Ask your tax consultant which booking account to use.",
    inputSchema: z.object({
      name: z.string().describe("Name of the clearing account"),
      accountingNumber: z
        .number()
        .optional()
        .describe("Booking account (e.g. 1723 in SKR03, 3320 in SKR04). Must be unique."),
    }),
    handler: async (client: SevdeskClient, params: { name: string; accountingNumber?: number }) => {
      const { data, error } = await client.POST("/CheckAccount/Factory/clearingAccount", {
        body: params as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_check_account: {
    description: "Update a check account. Only the fields you pass are changed.",
    inputSchema: z.object({
      checkAccountId: z.number().describe("The ID of the check account"),
      name: z.string().optional().describe("Name of the account"),
      iban: z.string().optional().describe("IBAN without spaces"),
      bic: z.string().optional().describe("BIC"),
      accountingNumber: z.string().optional().describe("Booking account number"),
      defaultAccount: z.boolean().optional().describe("Use as default account"),
    }),
    handler: async (client: SevdeskClient, params: {
      checkAccountId: number;
      name?: string;
      iban?: string;
      bic?: string;
      accountingNumber?: string;
      defaultAccount?: boolean;
    }) => {
      const { checkAccountId, defaultAccount, ...rest } = params;
      const { data, error } = await client.PUT("/CheckAccount/{checkAccountId}", {
        params: { path: { checkAccountId } },
        body: {
          ...rest,
          ...(defaultAccount === undefined ? {} : { defaultAccount: defaultAccount ? 1 : 0 }),
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_private_transaction_rules: {
    description:
      "List the rules that mark matching bank transactions as private (by payment purpose or counterpart name)",
    inputSchema: z.object({}),
    handler: async (client: SevdeskClient) => {
      const { data, error } = await client.GET("/PrivateTransactionRule", {});
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_private_transaction_rule: {
    description:
      "Create a rule that marks future matching bank transactions as private. Pass paymentPurpose, counterpartName or both.",
    inputSchema: z
      .object({
        paymentPurpose: z.string().optional().describe("Payment purpose to match"),
        counterpartName: z.string().optional().describe("Counterpart name to match"),
      })
      .refine((v) => v.paymentPurpose || v.counterpartName, {
        message: "Provide paymentPurpose or counterpartName",
      }),
    handler: async (client: SevdeskClient, params: {
      paymentPurpose?: string;
      counterpartName?: string;
    }) => {
      const { data, error } = await client.POST("/PrivateTransactionRule", {
        body: { objectName: "PrivateTransactionRule", ...params } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },
};
