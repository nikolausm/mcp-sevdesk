import { z } from "zod";
import type { SevdeskClient } from "../client.js";
import {
  buildDocumentCommon,
  buildPosition,
  documentFields,
  ref,
  type DocumentInput,
} from "./schemas.js";

/**
 * Draft-only invoice tools. Nothing here enshrines, sends or books a document:
 * invoices are always created with status 100 (draft).
 */
export const invoiceDraftTools = {
  create_invoice: {
    description:
      "Create a DRAFT invoice (status 100). The invoice is not enshrined, sent or booked - review it in sevdesk first. The invoice number is assigned by sevdesk when left empty.",
    inputSchema: z.object({
      ...documentFields,
      invoiceNumber: z.string().optional().describe("Invoice number (assigned by sevdesk if omitted)"),
      deliveryDate: z.string().describe("Delivery / service date, ISO 8601"),
      deliveryDateUntil: z.string().optional().describe("End of the delivery period, ISO 8601"),
      timeToPay: z.number().optional().describe("Payment term in days"),
      discount: z.number().optional().describe("Early payment discount in percent (default 0)"),
      smallSettlement: z.boolean().optional().describe("Small business settlement (Kleinunternehmer)"),
    }),
    handler: async (
      client: SevdeskClient,
      params: DocumentInput & {
        invoiceNumber?: string;
        deliveryDate: string;
        deliveryDateUntil?: string;
        timeToPay?: number;
        discount?: number;
        smallSettlement?: boolean;
      }
    ) => {
      const { data, error } = await client.POST("/Invoice/Factory/saveInvoice", {
        body: {
          invoice: {
            ...buildDocumentCommon(params),
            objectName: "Invoice",
            invoiceNumber: params.invoiceNumber,
            invoiceDate: params.date,
            deliveryDate: params.deliveryDate,
            deliveryDateUntil: params.deliveryDateUntil,
            timeToPay: params.timeToPay,
            discount: params.discount ?? 0,
            smallSettlement: params.smallSettlement,
            invoiceType: "RE",
            status: "100",
          },
          invoicePosSave: params.positions.map((pos, i) => buildPosition(pos, "InvoicePos", i)),
          invoicePosDelete: null,
          discountDelete: null,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_invoice_positions: {
    description: "Get the positions (line items) of an invoice",
    inputSchema: z.object({
      invoiceId: z.number().describe("The ID of the invoice"),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    handler: async (
      client: SevdeskClient,
      params: { invoiceId: number; limit?: number; offset?: number }
    ) => {
      const { data, error } = await client.GET("/Invoice/{invoiceId}/getPositions", {
        params: {
          path: { invoiceId: params.invoiceId },
          query: { limit: params.limit, offset: params.offset } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_invoice_positions: {
    description: "List invoice positions across invoices. Pass invoiceId to restrict to one invoice.",
    inputSchema: z.object({
      invoiceId: z.number().optional().describe("Only positions of this invoice"),
      partId: z.number().optional().describe("Only positions that use this article"),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    handler: async (
      client: SevdeskClient,
      params: { invoiceId?: number; partId?: number; limit?: number; offset?: number }
    ) => {
      const { data, error } = await client.GET("/InvoicePos", {
        params: {
          query: {
            ...(params.invoiceId !== undefined
              ? { "invoice[id]": params.invoiceId, "invoice[objectName]": "Invoice" }
              : {}),
            ...(params.partId !== undefined
              ? { "part[id]": params.partId, "part[objectName]": "Part" }
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

  get_invoice_xml: {
    description: "Get the e-invoice XML of an invoice",
    inputSchema: z.object({ invoiceId: z.number().describe("The ID of the invoice") }),
    handler: async (client: SevdeskClient, params: { invoiceId: number }) => {
      const { data, error } = await client.GET("/Invoice/{invoiceId}/getXml", {
        params: { path: { invoiceId: params.invoiceId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_invoice_partially_paid: {
    description: "Check whether an invoice has been paid partially",
    inputSchema: z.object({ invoiceId: z.number().describe("The ID of the invoice") }),
    handler: async (client: SevdeskClient, params: { invoiceId: number }) => {
      const { data, error } = await client.GET("/Invoice/{invoiceId}/getIsPartiallyPaid", {
        params: { path: { invoiceId: params.invoiceId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_invoice_reminder: {
    description:
      "Create a DRAFT reminder (dunning letter) for an overdue invoice. It is only created, not sent.",
    inputSchema: z.object({ invoiceId: z.number().describe("The ID of the overdue invoice") }),
    handler: async (client: SevdeskClient, params: { invoiceId: number }) => {
      const { data, error } = await client.POST("/Invoice/Factory/createInvoiceReminder", {
        params: {
          query: { "invoice[id]": params.invoiceId, "invoice[objectName]": "Invoice" },
        },
        body: { invoice: ref(params.invoiceId, "Invoice") } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_invoice_from_order: {
    description:
      "Create a draft invoice from an existing order (quote / confirmation). Supports partial and advance invoices.",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order"),
      partialType: z
        .enum(["RE", "TR", "AR"])
        .optional()
        .describe("RE = final invoice, TR = partial invoice, AR = advance invoice"),
      type: z.enum(["percentage", "net", "gross"]).optional().describe("How `amount` is interpreted"),
      amount: z.number().optional().describe("Amount already invoiced / to invoice (see `type`)"),
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        orderId: number;
        partialType?: "RE" | "TR" | "AR";
        type?: "percentage" | "net" | "gross";
        amount?: number;
      }
    ) => {
      const { data, error } = await client.POST("/Invoice/Factory/createInvoiceFromOrder", {
        body: {
          order: ref(params.orderId, "Order"),
          partialType: params.partialType,
          type: params.type,
          amount: params.amount,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_letterpapers: {
    description: "List the available letterpapers (with thumbnails) for documents",
    inputSchema: z.object({}),
    handler: async (client: SevdeskClient) => {
      const { data, error } = await client.GET("/DocServer/getLetterpapersWithThumb", {} as any);
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_document_templates: {
    description: "List the available document templates (with thumbnails)",
    inputSchema: z.object({
      type: z.string().optional().describe("Document type, e.g. 'Invoice', 'Order', 'CreditNote'"),
    }),
    handler: async (client: SevdeskClient, params: { type?: string }) => {
      const { data, error } = await client.GET("/DocServer/getTemplatesWithThumb", {
        params: { query: { type: params.type } as any },
      } as any);
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },
};
