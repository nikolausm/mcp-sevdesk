import { z } from "zod";
import type { SevdeskClient } from "../client.js";

const addressFields = {
  street: z.string().optional().describe("Street name and house number"),
  zip: z.string().optional().describe("Zip / postal code"),
  city: z.string().optional().describe("City name"),
  countryId: z
    .number()
    .optional()
    .describe("ID of the country (see list_countries, e.g. 1 = Germany)"),
  categoryId: z
    .number()
    .optional()
    .describe(
      "ID of the address category (see list_address_categories, e.g. 47 = invoice address, 48 = delivery address)"
    ),
  name: z.string().optional().describe("Name in address"),
  name2: z.string().optional().describe("Second name in address"),
  name3: z.string().optional().describe("Third name in address"),
  name4: z.string().optional().describe("Fourth name in address"),
};

type AddressFields = {
  street?: string;
  zip?: string;
  city?: string;
  countryId?: number;
  categoryId?: number;
  name?: string;
  name2?: string;
  name3?: string;
  name4?: string;
};

function buildAddressBody(params: AddressFields & { contactId?: number }) {
  const body: Record<string, unknown> = {};
  if (params.contactId !== undefined) {
    body.contact = { id: params.contactId, objectName: "Contact" };
  }
  if (params.street !== undefined) body.street = params.street;
  if (params.zip !== undefined) body.zip = params.zip;
  if (params.city !== undefined) body.city = params.city;
  if (params.countryId !== undefined) {
    body.country = { id: params.countryId, objectName: "StaticCountry" };
  }
  if (params.categoryId !== undefined) {
    body.category = { id: params.categoryId, objectName: "Category" };
  }
  if (params.name !== undefined) body.name = params.name;
  if (params.name2 !== undefined) body.name2 = params.name2;
  if (params.name3 !== undefined) body.name3 = params.name3;
  if (params.name4 !== undefined) body.name4 = params.name4;
  return body;
}

export const addressTools = {
  list_contact_addresses: {
    description:
      "List contact addresses from sevdesk. Pass contactId to get all addresses of one contact (client).",
    inputSchema: z.object({
      contactId: z.number().optional().describe("Only return addresses of this contact"),
      limit: z.number().optional().describe("Limit the number of results (max 1000)"),
      offset: z.number().optional().describe("Skip a number of results"),
      embed: z
        .string()
        .optional()
        .describe("Comma separated nested resources to embed, e.g. 'country,category,contact'"),
    }),
    handler: async (
      client: SevdeskClient,
      params: { contactId?: number; limit?: number; offset?: number; embed?: string }
    ) => {
      const { data, error } = await client.GET("/ContactAddress", {
        params: {
          query: {
            ...(params.contactId !== undefined
              ? {
                  "contact[id]": params.contactId,
                  "contact[objectName]": "Contact",
                }
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

  get_contact_address: {
    description: "Get a specific contact address by ID from sevdesk",
    inputSchema: z.object({
      contactAddressId: z.number().describe("The ID of the contact address to retrieve"),
      embed: z
        .string()
        .optional()
        .describe("Comma separated nested resources to embed, e.g. 'country,category,contact'"),
    }),
    handler: async (
      client: SevdeskClient,
      params: { contactAddressId: number; embed?: string }
    ) => {
      const { data, error } = await client.GET("/ContactAddress/{contactAddressId}", {
        params: {
          path: { contactAddressId: params.contactAddressId },
          query: { embed: params.embed } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_contact_address: {
    description:
      "Add a new address to a contact (client) in sevdesk. Country and category are required by the API - use list_countries and list_address_categories to look up their IDs.",
    inputSchema: z.object({
      contactId: z.number().describe("The ID of the contact this address belongs to"),
      countryId: z
        .number()
        .describe("ID of the country (see list_countries, e.g. 1 = Germany)"),
      categoryId: z
        .number()
        .describe(
          "ID of the address category (see list_address_categories, e.g. 47 = invoice address, 48 = delivery address)"
        ),
      street: addressFields.street,
      zip: addressFields.zip,
      city: addressFields.city,
      name: addressFields.name,
      name2: addressFields.name2,
      name3: addressFields.name3,
      name4: addressFields.name4,
    }),
    handler: async (
      client: SevdeskClient,
      params: AddressFields & { contactId: number; countryId: number; categoryId: number }
    ) => {
      const { data, error } = await client.POST("/ContactAddress", {
        body: buildAddressBody(params) as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_contact_address: {
    description:
      "Update an existing contact address in sevdesk. Only the fields you pass are changed.",
    inputSchema: z.object({
      contactAddressId: z.number().describe("The ID of the contact address to update"),
      contactId: z
        .number()
        .optional()
        .describe("Move the address to a different contact"),
      ...addressFields,
    }),
    handler: async (
      client: SevdeskClient,
      params: AddressFields & { contactAddressId: number; contactId?: number }
    ) => {
      const { contactAddressId, ...rest } = params;
      const { data, error } = await client.PUT("/ContactAddress/{contactAddressId}", {
        params: { path: { contactAddressId } },
        body: buildAddressBody(rest) as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  delete_contact_address: {
    description: "Delete a contact address from sevdesk",
    inputSchema: z.object({
      contactAddressId: z.number().describe("The ID of the contact address to delete"),
    }),
    handler: async (client: SevdeskClient, params: { contactAddressId: number }) => {
      const { data, error } = await client.DELETE("/ContactAddress/{contactAddressId}", {
        params: { path: { contactAddressId: params.contactAddressId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data ?? { success: true };
    },
  },

  list_countries: {
    description:
      "List the static countries known to sevdesk. Use the returned IDs as countryId when creating or updating an address.",
    inputSchema: z.object({
      code: z.string().optional().describe("Filter by ISO country code, e.g. 'DE' or 'LU'"),
      limit: z.number().optional().describe("Limit the number of results"),
      offset: z.number().optional().describe("Skip a number of results"),
    }),
    handler: async (
      client: SevdeskClient,
      params: { code?: string; limit?: number; offset?: number }
    ) => {
      return client.request("/StaticCountry", {
        query: { code: params.code, limit: params.limit, offset: params.offset },
      });
    },
  },

  list_address_categories: {
    description:
      "List the available contact address categories (invoice address, delivery address, ...). Use the returned IDs as categoryId when creating an address.",
    inputSchema: z.object({}),
    handler: async (client: SevdeskClient) => {
      return client.request("/Category", { query: { objectType: "ContactAddress" } });
    },
  },
};
