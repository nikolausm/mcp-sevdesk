import { z } from "zod";
import type { SevdeskClient } from "../client.js";
import {
  buildDocumentCommon,
  buildPosition,
  documentFields,
  embedField,
  ref,
  type DocumentInput,
} from "./schemas.js";

export const creditNoteTools = {
  list_credit_notes: {
    description: "List credit notes from sevdesk",
    inputSchema: z.object({
      status: z.enum(["100", "200", "300", "500", "750", "1000"]).optional().describe("100 = draft"),
      creditNoteNumber: z.string().optional().describe("Filter by credit note number"),
      contactId: z.number().optional().describe("Only credit notes of this contact"),
      limit: z.number().optional(),
      offset: z.number().optional(),
      embed: embedField,
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        status?: string;
        creditNoteNumber?: string;
        contactId?: number;
        limit?: number;
        offset?: number;
        embed?: string;
      }
    ) => {
      const { data, error } = await client.GET("/CreditNote", {
        params: {
          query: {
            status: params.status ? Number(params.status) : undefined,
            creditNoteNumber: params.creditNoteNumber,
            ...(params.contactId !== undefined
              ? { "contact[id]": params.contactId, "contact[objectName]": "Contact" }
              : {}),
            limit: params.limit,
            offset: params.offset,
            embed: params.embed,
          } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_credit_note: {
    description: "Get a specific credit note by ID",
    inputSchema: z.object({ creditNoteId: z.number().describe("The ID of the credit note") }),
    handler: async (client: SevdeskClient, params: { creditNoteId: number }) => {
      const { data, error } = await client.GET("/CreditNote/{creditNoteId}", {
        params: { path: { creditNoteId: params.creditNoteId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_credit_note_pdf: {
    description: "Get the PDF of a credit note as base64 encoded string",
    inputSchema: z.object({ creditNoteId: z.number().describe("The ID of the credit note") }),
    handler: async (client: SevdeskClient, params: { creditNoteId: number }) => {
      const { data, error } = await client.GET("/CreditNote/{creditNoteId}/getPdf", {
        params: { path: { creditNoteId: params.creditNoteId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_credit_note_positions: {
    description: "List credit note positions. Pass creditNoteId to restrict to one credit note.",
    inputSchema: z.object({
      creditNoteId: z.number().optional().describe("Only positions of this credit note"),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    handler: async (
      client: SevdeskClient,
      params: { creditNoteId?: number; limit?: number; offset?: number }
    ) => {
      const { data, error } = await client.GET("/CreditNotePos", {
        params: {
          query: {
            ...(params.creditNoteId !== undefined
              ? { "creditNote[id]": params.creditNoteId, "creditNote[objectName]": "CreditNote" }
              : {}),
            limit: params.limit,
            offset: params.offset,
          } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_credit_note: {
    description:
      "Create a DRAFT credit note (status 100). It is not enshrined, sent or booked.",
    inputSchema: z.object({
      ...documentFields,
      creditNoteNumber: z.string().describe("Credit note number (must be unique)"),
      bookingCategory: z
        .enum(["PROVISION", "ROYALTY_ASSIGNED", "ROYALTY_UNASSIGNED", "UNDERACHIEVEMENT", "ACCOUNTING_TYPE"])
        .optional()
        .describe("Booking category (default UNDERACHIEVEMENT, i.e. a revenue reduction)"),
    }),
    handler: async (
      client: SevdeskClient,
      params: DocumentInput & {
        creditNoteNumber: string;
        bookingCategory?:
          | "PROVISION"
          | "ROYALTY_ASSIGNED"
          | "ROYALTY_UNASSIGNED"
          | "UNDERACHIEVEMENT"
          | "ACCOUNTING_TYPE";
      }
    ) => {
      const common = buildDocumentCommon(params);
      const { data, error } = await client.POST("/CreditNote/Factory/saveCreditNote", {
        body: {
          creditNote: {
            ...common,
            header: common.header ?? "Gutschrift",
            objectName: "CreditNote",
            creditNoteNumber: params.creditNoteNumber,
            creditNoteDate: params.date,
            bookingCategory: params.bookingCategory ?? "UNDERACHIEVEMENT",
            status: "100",
          },
          creditNotePosSave: params.positions.map((pos, i) =>
            buildPosition(pos, "CreditNotePos", i)
          ),
          creditNotePosDelete: null,
          discountSave: null,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_credit_note_from_invoice: {
    description: "Create a draft credit note that reverses an existing invoice",
    inputSchema: z.object({ invoiceId: z.number().describe("The ID of the invoice to credit") }),
    handler: async (client: SevdeskClient, params: { invoiceId: number }) => {
      const { data, error } = await client.POST("/CreditNote/Factory/createFromInvoice", {
        body: { invoice: ref(params.invoiceId, "Invoice") } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },
};
