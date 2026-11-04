import { z } from "zod";
import type { SevdeskClient } from "../client.js";

export const invoiceTools = {
  list_invoices: {
    description: "List all invoices from sevdesk. Supports filtering and pagination.",
    inputSchema: z.object({
      status: z.enum(["100", "200", "1000"]).optional().describe("Invoice status: 100=Draft, 200=Open, 1000=Paid"),
      invoiceNumber: z.string().optional().describe("Filter by invoice number"),
      startDate: z.string().optional().describe("Filter by start date (Unix timestamp)"),
      endDate: z.string().optional().describe("Filter by end date (Unix timestamp)"),
      limit: z.number().optional().describe("Limit the number of results"),
      offset: z.number().optional().describe("Skip a number of results"),
    }),
    handler: async (client: SevdeskClient, params: {
      status?: "100" | "200" | "1000";
      invoiceNumber?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const { data, error } = await client.GET("/Invoice", {
        params: {
          query: {
            status: params.status ? Number(params.status) : undefined,
            invoiceNumber: params.invoiceNumber,
            startDate: params.startDate ? Number(params.startDate) : undefined,
            endDate: params.endDate ? Number(params.endDate) : undefined,
            limit: params.limit,
            offset: params.offset,
          } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_invoice: {
    description: "Get a specific invoice by ID from sevdesk",
    inputSchema: z.object({
      invoiceId: z.number().describe("The ID of the invoice to retrieve"),
    }),
    handler: async (client: SevdeskClient, params: { invoiceId: number }) => {
      const { data, error } = await client.GET("/Invoice/{invoiceId}", {
        params: {
          path: { invoiceId: params.invoiceId },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_invoice_pdf: {
    description: "Get the PDF of an invoice as base64 encoded string",
    inputSchema: z.object({
      invoiceId: z.number().describe("The ID of the invoice"),
      download: z.boolean().optional().describe("Whether to download the PDF"),
      preventSendBy: z.boolean().optional().describe("Prevent setting sendBy date"),
    }),
    handler: async (client: SevdeskClient, params: {
      invoiceId: number;
      download?: boolean;
      preventSendBy?: boolean;
    }) => {
      const { data, error } = await client.GET("/Invoice/{invoiceId}/getPdf", {
        params: {
          path: { invoiceId: params.invoiceId },
          query: {
            download: params.download,
            preventSendBy: params.preventSendBy,
          },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  send_invoice_by_email: {
    description: "Send an invoice via email",
    inputSchema: z.object({
      invoiceId: z.number().describe("The ID of the invoice to send"),
      toEmail: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject"),
      text: z.string().describe("Email body text"),
      copy: z.boolean().optional().describe("Send a copy to your own email"),
      additionalAttachments: z.string().optional().describe("Additional attachment IDs, comma-separated"),
      ccEmail: z.string().optional().describe("CC email address"),
      bccEmail: z.string().optional().describe("BCC email address"),
    }),
    handler: async (client: SevdeskClient, params: {
      invoiceId: number;
      toEmail: string;
      subject: string;
      text: string;
      copy?: boolean;
      additionalAttachments?: string;
      ccEmail?: string;
      bccEmail?: string;
    }) => {
      const { data, error } = await client.POST("/Invoice/{invoiceId}/sendViaEmail", {
        params: {
          path: { invoiceId: params.invoiceId },
        },
        body: {
          toEmail: params.toEmail,
          subject: params.subject,
          text: params.text,
          copy: params.copy,
          additionalAttachments: params.additionalAttachments,
          ccEmail: params.ccEmail,
          bccEmail: params.bccEmail,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  mark_invoice_as_sent: {
    description: "Mark an invoice as sent",
    inputSchema: z.object({
      invoiceId: z.number().describe("The ID of the invoice"),
      sendType: z.enum(["VPR", "VPDF", "VM", "VP"]).optional().describe("Send type: VPR=Print, VPDF=PDF, VM=Email, VP=Post"),
      sendDraft: z.boolean().optional().describe("Send draft invoice"),
    }),
    handler: async (client: SevdeskClient, params: {
      invoiceId: number;
      sendType?: "VPR" | "VPDF" | "VM" | "VP";
      sendDraft?: boolean;
    }) => {
      const { data, error } = await client.PUT("/Invoice/{invoiceId}/sendBy", {
        params: {
          path: { invoiceId: params.invoiceId },
          query: {
            sendType: params.sendType ?? "VM",
            sendDraft: params.sendDraft,
          } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  book_invoice: {
    description: "Book an invoice (mark it as paid)",
    inputSchema: z.object({
      invoiceId: z.number().describe("The ID of the invoice to book"),
      amount: z.number().describe("Amount to book"),
      date: z.string().describe("Booking date (Unix timestamp)"),
      type: z
        .enum(["FULL_PAYMENT", "N", "CB", "CF", "O", "OF", "MTC"])
        .describe(
          "Booking type: FULL_PAYMENT=normal full booking, N=partial booking, CB=reduced by discount (Skonto), CF=currency fluctuation (deprecated), O=reduced/higher for other reasons, OF=higher due to reminder charges, MTC=reduced by monetary traffic costs"
        ),
      checkAccountId: z.number().describe("ID of the check account"),
      checkAccountTransactionId: z.number().optional().describe("ID of an existing transaction to link"),
      createFeed: z.boolean().optional().describe("Create a feed entry"),
    }),
    handler: async (client: SevdeskClient, params: {
      invoiceId: number;
      amount: number;
      date: string;
      type: "FULL_PAYMENT" | "N" | "CB" | "CF" | "O" | "OF" | "MTC";
      checkAccountId: number;
      checkAccountTransactionId?: number;
      createFeed?: boolean;
    }) => {
      const { data, error } = await client.PUT("/Invoice/{invoiceId}/bookAmount", {
        params: {
          path: { invoiceId: params.invoiceId },
        },
        body: {
          amount: params.amount,
          date: params.date,
          type: params.type,
          checkAccount: {
            id: params.checkAccountId,
            objectName: "CheckAccount",
          },
          checkAccountTransaction: params.checkAccountTransactionId
            ? {
                id: params.checkAccountTransactionId,
                objectName: "CheckAccountTransaction",
              }
            : undefined,
          createFeed: params.createFeed,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  cancel_invoice: {
    description: "Cancel an invoice (creates a cancellation invoice)",
    inputSchema: z.object({
      invoiceId: z.number().describe("The ID of the invoice to cancel"),
    }),
    handler: async (client: SevdeskClient, params: { invoiceId: number }) => {
      const { data, error } = await client.POST("/Invoice/{invoiceId}/cancelInvoice", {
        params: {
          path: { invoiceId: params.invoiceId },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },
};
