import { z } from "zod";
import type { SevdeskClient } from "../client.js";

type ContactExtras = {
  parentId?: number;
  titel?: string;
  academicTitle?: string;
  gender?: string;
  vatNumber?: string;
};

// Optional person/organization fields shared by create_contact and update_contact.
const contactExtraShape = {
  parentId: z.number().optional().describe("ID of the organization this person belongs to (links a contact person to a company)"),
  titel: z.string().optional().describe("Position or job title of a contact person"),
  academicTitle: z.string().optional().describe("Academic title of a contact person"),
  gender: z.string().optional().describe("Gender of a contact person (m, w or a custom value)"),
  vatNumber: z.string().optional().describe("VAT identification number"),
};

function contactExtras(params: ContactExtras) {
  return {
    parent: params.parentId === undefined ? undefined : { id: params.parentId, objectName: "Contact" },
    titel: params.titel,
    academicTitle: params.academicTitle,
    gender: params.gender,
    vatNumber: params.vatNumber,
  };
}

const contactRef = (contactId: number) => ({ id: contactId, objectName: "Contact" });

export const contactTools = {
  list_contacts: {
    description: "List all contacts from sevdesk. Supports filtering by various parameters.",
    inputSchema: z.object({
      depth: z.number().optional().describe("Defines depth of sub-objects returned"),
      customerNumber: z.string().optional().describe("Filter by customer number"),
      name: z.string().optional().describe("Filter by contact name"),
      limit: z.number().optional().describe("Limit the number of results (max 1000)"),
      offset: z.number().optional().describe("Skip a number of results"),
    }),
    handler: async (client: SevdeskClient, params: {
      depth?: number;
      customerNumber?: string;
      name?: string;
      limit?: number;
      offset?: number;
    }) => {
      const { data, error } = await client.GET("/Contact", {
        params: {
          query: {
            depth: params.depth as "0" | "1" | undefined,
            customerNumber: params.customerNumber,
            name: params.name,
            limit: params.limit,
            offset: params.offset,
          },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_contact: {
    description: "Get a specific contact by ID from sevdesk",
    inputSchema: z.object({
      contactId: z.number().describe("The ID of the contact to retrieve"),
    }),
    handler: async (client: SevdeskClient, params: { contactId: number }) => {
      const { data, error } = await client.GET("/Contact/{contactId}", {
        params: {
          path: { contactId: params.contactId },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_contact: {
    description: "Create a new contact in sevdesk",
    inputSchema: z.object({
      name: z.string().optional().describe("The name of the contact (for organizations)"),
      surename: z.string().optional().describe("The surname of the contact person"),
      familyname: z.string().optional().describe("The family name of the contact person"),
      customerNumber: z.string().optional().describe("Customer number"),
      description: z.string().optional().describe("Description of the contact"),
      categoryId: z.number().describe("Category ID (3 = customer, 4 = supplier, 28 = partner)"),
      ...contactExtraShape,
    }),
    handler: async (client: SevdeskClient, params: {
      name?: string;
      surename?: string;
      familyname?: string;
      customerNumber?: string;
      description?: string;
      categoryId: number;
    } & ContactExtras) => {
      const { data, error } = await client.POST("/Contact", {
        body: {
          name: params.name,
          surename: params.surename,
          familyname: params.familyname,
          customerNumber: params.customerNumber,
          description: params.description,
          category: {
            id: params.categoryId,
            objectName: "Category",
          },
          ...contactExtras(params),
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_contact: {
    description: "Update an existing contact in sevdesk",
    inputSchema: z.object({
      contactId: z.number().describe("The ID of the contact to update"),
      name: z.string().optional().describe("The name of the contact"),
      surename: z.string().optional().describe("The surname"),
      familyname: z.string().optional().describe("The family name"),
      customerNumber: z.string().optional().describe("Customer number"),
      description: z.string().optional().describe("Description"),
      ...contactExtraShape,
    }),
    handler: async (client: SevdeskClient, params: {
      contactId: number;
      name?: string;
      surename?: string;
      familyname?: string;
      customerNumber?: string;
      description?: string;
    } & ContactExtras) => {
      const { contactId, parentId, titel, academicTitle, gender, vatNumber, ...updateData } = params;
      const { data, error } = await client.PUT("/Contact/{contactId}", {
        params: {
          path: { contactId },
        },
        body: {
          ...updateData,
          ...contactExtras({ parentId, titel, academicTitle, gender, vatNumber }),
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  delete_contact: {
    description: "Delete a contact from sevdesk",
    inputSchema: z.object({
      contactId: z.number().describe("The ID of the contact to delete"),
    }),
    handler: async (client: SevdeskClient, params: { contactId: number }) => {
      const { data, error } = await client.DELETE("/Contact/{contactId}", {
        params: {
          path: { contactId: params.contactId },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data ?? { success: true };
    },
  },

  list_contact_addresses: {
    description: "List the postal addresses of a contact",
    inputSchema: z.object({
      contactId: z.number().describe("The ID of the contact"),
    }),
    handler: async (client: SevdeskClient, params: { contactId: number }) => {
      const { data, error } = await client.GET("/ContactAddress", {
        params: {
          query: {
            "contact[id]": params.contactId,
            "contact[objectName]": "Contact",
          },
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_contact_address: {
    description: "Add a postal address to a contact",
    inputSchema: z.object({
      contactId: z.number().describe("The ID of the contact the address belongs to"),
      street: z.string().optional().describe("Street and house number"),
      zip: z.string().optional().describe("Postal code"),
      city: z.string().optional().describe("City"),
      countryId: z.number().optional().describe("StaticCountry ID (default 1 = Germany)"),
      categoryId: z.number().optional().describe("Address category ID (default 47 = work; 43 = invoice address, 48 = private)"),
      name: z.string().optional().describe("Name line in the address, if it differs from the contact name"),
      name2: z.string().optional().describe("Second name line in the address"),
    }),
    handler: async (client: SevdeskClient, params: {
      contactId: number;
      street?: string;
      zip?: string;
      city?: string;
      countryId?: number;
      categoryId?: number;
      name?: string;
      name2?: string;
    }) => {
      const { data, error } = await client.POST("/ContactAddress", {
        body: {
          contact: contactRef(params.contactId),
          street: params.street,
          zip: params.zip,
          city: params.city,
          country: { id: params.countryId ?? 1, objectName: "StaticCountry" },
          category: { id: params.categoryId ?? 47, objectName: "Category" },
          name: params.name,
          name2: params.name2,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_contact_address: {
    description: "Update a postal address of a contact",
    inputSchema: z.object({
      contactAddressId: z.number().describe("The ID of the address to update"),
      street: z.string().optional().describe("Street and house number"),
      zip: z.string().optional().describe("Postal code"),
      city: z.string().optional().describe("City"),
      countryId: z.number().optional().describe("StaticCountry ID (1 = Germany)"),
      categoryId: z.number().optional().describe("Address category ID (47 = work, 43 = invoice address, 48 = private)"),
      name: z.string().optional().describe("Name line in the address"),
      name2: z.string().optional().describe("Second name line in the address"),
    }),
    handler: async (client: SevdeskClient, params: {
      contactAddressId: number;
      street?: string;
      zip?: string;
      city?: string;
      countryId?: number;
      categoryId?: number;
      name?: string;
      name2?: string;
    }) => {
      const { data, error } = await client.PUT("/ContactAddress/{contactAddressId}", {
        params: {
          path: { contactAddressId: params.contactAddressId },
        },
        body: {
          street: params.street,
          zip: params.zip,
          city: params.city,
          country: params.countryId === undefined ? undefined : { id: params.countryId, objectName: "StaticCountry" },
          category: params.categoryId === undefined ? undefined : { id: params.categoryId, objectName: "Category" },
          name: params.name,
          name2: params.name2,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_communication_ways: {
    description: "List the communication ways (email, phone, mobile, website) of a contact",
    inputSchema: z.object({
      contactId: z.number().describe("The ID of the contact"),
      type: z.enum(["EMAIL", "PHONE", "WEB", "MOBILE"]).optional().describe("Only return communication ways of this type"),
    }),
    handler: async (client: SevdeskClient, params: {
      contactId: number;
      type?: "EMAIL" | "PHONE" | "WEB" | "MOBILE";
    }) => {
      const { data, error } = await client.GET("/CommunicationWay", {
        params: {
          query: {
            "contact[id]": String(params.contactId),
            "contact[objectName]": "Contact",
            type: params.type,
          },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_communication_way: {
    description: "Add an email address, phone number, mobile number or website to a contact",
    inputSchema: z.object({
      contactId: z.number().describe("The ID of the contact"),
      type: z.enum(["EMAIL", "PHONE", "WEB", "MOBILE"]).describe("Type of the communication way"),
      value: z.string().describe("The email address, phone number or URL"),
      keyId: z.number().optional().describe("CommunicationWayKey ID (default 2 = work; 1 = private, 3 = fax, 4 = mobile, 8 = invoice address)"),
      main: z.boolean().optional().describe("Whether this is the contact's main communication way of its type"),
    }),
    handler: async (client: SevdeskClient, params: {
      contactId: number;
      type: "EMAIL" | "PHONE" | "WEB" | "MOBILE";
      value: string;
      keyId?: number;
      main?: boolean;
    }) => {
      const { data, error } = await client.POST("/CommunicationWay", {
        body: {
          contact: contactRef(params.contactId),
          type: params.type,
          value: params.value,
          key: { id: params.keyId ?? 2, objectName: "CommunicationWayKey" },
          main: params.main,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_communication_way: {
    description: "Update a communication way (email, phone, mobile, website) of a contact",
    inputSchema: z.object({
      communicationWayId: z.number().describe("The ID of the communication way to update"),
      type: z.enum(["EMAIL", "PHONE", "WEB", "MOBILE"]).optional().describe("Type of the communication way"),
      value: z.string().optional().describe("The email address, phone number or URL"),
      keyId: z.number().optional().describe("CommunicationWayKey ID (1 = private, 2 = work, 3 = fax, 4 = mobile, 8 = invoice address)"),
      main: z.boolean().optional().describe("Whether this is the contact's main communication way of its type"),
    }),
    handler: async (client: SevdeskClient, params: {
      communicationWayId: number;
      type?: "EMAIL" | "PHONE" | "WEB" | "MOBILE";
      value?: string;
      keyId?: number;
      main?: boolean;
    }) => {
      const { data, error } = await client.PUT("/CommunicationWay/{communicationWayId}", {
        params: {
          path: { communicationWayId: params.communicationWayId },
        },
        body: {
          type: params.type,
          value: params.value,
          key: params.keyId === undefined ? undefined : { id: params.keyId, objectName: "CommunicationWayKey" },
          main: params.main,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },
};
