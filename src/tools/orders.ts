import { z } from "zod";
import type { SevdeskClient } from "../client.js";
import {
  buildDocumentCommon,
  buildPosition,
  documentFields,
  embedField,
  type DocumentInput,
} from "./schemas.js";

export const orderTools = {
  list_orders: {
    description: "List orders (quotes, order confirmations, delivery notes) from sevdesk",
    inputSchema: z.object({
      status: z
        .enum(["100", "200", "300", "500", "750", "1000"])
        .optional()
        .describe("Order status, 100 = draft"),
      orderNumber: z.string().optional().describe("Filter by order number"),
      contactId: z.number().optional().describe("Only orders of this contact"),
      limit: z.number().optional(),
      offset: z.number().optional(),
      embed: embedField,
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        status?: string;
        orderNumber?: string;
        contactId?: number;
        limit?: number;
        offset?: number;
        embed?: string;
      }
    ) => {
      const { data, error } = await client.GET("/Order", {
        params: {
          query: {
            status: params.status ? Number(params.status) : undefined,
            orderNumber: params.orderNumber,
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

  get_order: {
    description: "Get a specific order by ID",
    inputSchema: z.object({ orderId: z.number().describe("The ID of the order") }),
    handler: async (client: SevdeskClient, params: { orderId: number }) => {
      const { data, error } = await client.GET("/Order/{orderId}", {
        params: { path: { orderId: params.orderId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_order_positions: {
    description: "Get the positions (line items) of an order",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order"),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    handler: async (
      client: SevdeskClient,
      params: { orderId: number; limit?: number; offset?: number }
    ) => {
      const { data, error } = await client.GET("/Order/{orderId}/getPositions", {
        params: {
          path: { orderId: params.orderId },
          query: { limit: params.limit, offset: params.offset } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_order_pdf: {
    description: "Get the PDF of an order as base64 encoded string",
    inputSchema: z.object({ orderId: z.number().describe("The ID of the order") }),
    handler: async (client: SevdeskClient, params: { orderId: number }) => {
      const { data, error } = await client.GET("/Order/{orderId}/getPdf", {
        params: { path: { orderId: params.orderId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_order: {
    description:
      "Create a DRAFT order (status 100): a quote (AN), order confirmation (AB) or delivery note (LI). It is not sent. Convert it later with create_invoice_from_order.",
    inputSchema: z.object({
      ...documentFields,
      orderNumber: z.string().describe("Order number (must be unique)"),
      orderType: z
        .enum(["AN", "AB", "LI"])
        .optional()
        .describe("AN = quote (default), AB = order confirmation, LI = delivery note"),
      deliveryTerms: z.string().optional().describe("Delivery terms"),
      paymentTerms: z.string().optional().describe("Payment terms"),
    }),
    handler: async (
      client: SevdeskClient,
      params: DocumentInput & {
        orderNumber: string;
        orderType?: "AN" | "AB" | "LI";
        deliveryTerms?: string;
        paymentTerms?: string;
      }
    ) => {
      const common = buildDocumentCommon(params);
      const { data, error } = await client.POST("/Order/Factory/saveOrder", {
        body: {
          order: {
            ...common,
            header: common.header ?? "Angebot",
            objectName: "Order",
            orderNumber: params.orderNumber,
            orderDate: params.date,
            orderType: params.orderType ?? "AN",
            deliveryTerms: params.deliveryTerms ?? null,
            paymentTerms: params.paymentTerms ?? null,
            version: 0,
            sendType: null,
            status: 100,
          },
          orderPosSave: params.positions.map((pos, i) => buildPosition(pos, "OrderPos", i)),
          orderPosDelete: null,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },
};
