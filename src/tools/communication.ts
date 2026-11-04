import { z } from "zod";
import type { SevdeskClient } from "../client.js";

const contactRef = (id: number) => ({ id, objectName: "Contact" });

export const communicationTools = {
  list_communication_ways: {
    description:
      "List communication ways (email addresses, phone numbers, websites) of contacts. Pass contactId to get those of one contact.",
    inputSchema: z.object({
      contactId: z.number().optional().describe("Only return communication ways of this contact"),
      type: z.enum(["EMAIL", "PHONE", "WEB", "MOBILE"]).optional().describe("Filter by type"),
      main: z.boolean().optional().describe("Only return the main communication way"),
    }),
    handler: async (
      client: SevdeskClient,
      params: { contactId?: number; type?: "EMAIL" | "PHONE" | "WEB" | "MOBILE"; main?: boolean }
    ) => {
      const { data, error } = await client.GET("/CommunicationWay", {
        params: {
          query: {
            ...(params.contactId !== undefined
              ? { "contact[id]": String(params.contactId), "contact[objectName]": "Contact" }
              : {}),
            type: params.type,
            main: params.main === undefined ? undefined : params.main ? "1" : "0",
          } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_communication_way: {
    description: "Get a specific communication way by ID",
    inputSchema: z.object({
      communicationWayId: z.number().describe("The ID of the communication way"),
    }),
    handler: async (client: SevdeskClient, params: { communicationWayId: number }) => {
      const { data, error } = await client.GET("/CommunicationWay/{communicationWayId}", {
        params: { path: { communicationWayId: params.communicationWayId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_communication_way_keys: {
    description:
      "List the communication way keys (e.g. work, private, mobile). Use the returned IDs as keyId when creating a communication way.",
    inputSchema: z.object({}),
    handler: async (client: SevdeskClient) => {
      const { data, error } = await client.GET("/CommunicationWayKey", {});
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_communication_way: {
    description:
      "Add an email address, phone number or website to a contact. Use list_communication_way_keys to look up keyId.",
    inputSchema: z.object({
      contactId: z.number().describe("The contact this communication way belongs to"),
      type: z.enum(["EMAIL", "PHONE", "WEB", "MOBILE"]).describe("Type of the communication way"),
      value: z.string().describe("The email address, phone number or URL"),
      keyId: z.number().describe("ID of the communication way key (see list_communication_way_keys)"),
      main: z.boolean().optional().describe("Mark as the main communication way of its type"),
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        contactId: number;
        type: "EMAIL" | "PHONE" | "WEB" | "MOBILE";
        value: string;
        keyId: number;
        main?: boolean;
      }
    ) => {
      const { data, error } = await client.POST("/CommunicationWay", {
        body: {
          contact: contactRef(params.contactId),
          type: params.type,
          value: params.value,
          key: { id: params.keyId, objectName: "CommunicationWayKey" },
          main: params.main,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_communication_way: {
    description: "Update a communication way. Only the fields you pass are changed.",
    inputSchema: z.object({
      communicationWayId: z.number().describe("The ID of the communication way to update"),
      type: z.enum(["EMAIL", "PHONE", "WEB", "MOBILE"]).optional(),
      value: z.string().optional().describe("The email address, phone number or URL"),
      keyId: z.number().optional().describe("ID of the communication way key"),
      main: z.boolean().optional().describe("Mark as the main communication way of its type"),
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        communicationWayId: number;
        type?: "EMAIL" | "PHONE" | "WEB" | "MOBILE";
        value?: string;
        keyId?: number;
        main?: boolean;
      }
    ) => {
      const body: Record<string, unknown> = {};
      if (params.type !== undefined) body.type = params.type;
      if (params.value !== undefined) body.value = params.value;
      if (params.keyId !== undefined) {
        body.key = { id: params.keyId, objectName: "CommunicationWayKey" };
      }
      if (params.main !== undefined) body.main = params.main;
      const { data, error } = await client.PUT("/CommunicationWay/{communicationWayId}", {
        params: { path: { communicationWayId: params.communicationWayId } },
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_next_customer_number: {
    description: "Get the next available customer number",
    inputSchema: z.object({}),
    handler: async (client: SevdeskClient) => {
      const { data, error } = await client.GET("/Contact/Factory/getNextCustomerNumber", {});
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  check_customer_number_availability: {
    description: "Check whether a customer number is still available",
    inputSchema: z.object({
      customerNumber: z.string().describe("The customer number to check"),
    }),
    handler: async (client: SevdeskClient, params: { customerNumber: string }) => {
      const { data, error } = await client.GET("/Contact/Mapper/checkCustomerNumberAvailability", {
        params: { query: { customerNumber: params.customerNumber } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  find_contacts_by_custom_field_value: {
    description: "Find contacts that have a given value in a custom field",
    inputSchema: z.object({
      value: z.string().describe("The value to search for"),
      customFieldName: z.string().describe("Name of the custom field setting"),
      customFieldSettingId: z
        .number()
        .optional()
        .describe("ID of the custom field setting (alternative to the name)"),
    }),
    handler: async (
      client: SevdeskClient,
      params: { value: string; customFieldName: string; customFieldSettingId?: number }
    ) => {
      const { data, error } = await client.GET("/Contact/Factory/findContactsByCustomFieldValue", {
        params: {
          query: {
            value: params.value,
            customFieldName: params.customFieldName,
            ...(params.customFieldSettingId !== undefined
              ? {
                  "customFieldSetting[id]": String(params.customFieldSettingId),
                  "customFieldSetting[objectName]": "ContactCustomFieldSetting",
                }
              : {}),
          } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_contact_custom_field_settings: {
    description: "List the defined contact custom fields (name and description)",
    inputSchema: z.object({}),
    handler: async (client: SevdeskClient) => {
      const { data, error } = await client.GET("/ContactCustomFieldSetting", {});
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_contact_custom_field_setting: {
    description: "Define a new contact custom field",
    inputSchema: z.object({
      name: z.string().describe("Name of the custom field"),
      description: z.string().optional().describe("Description of the custom field"),
    }),
    handler: async (client: SevdeskClient, params: { name: string; description?: string }) => {
      const { data, error } = await client.POST("/ContactCustomFieldSetting", {
        body: params as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_contact_custom_field_setting: {
    description: "Rename or re-describe a contact custom field definition",
    inputSchema: z.object({
      contactCustomFieldSettingId: z.number().describe("ID of the custom field setting"),
      name: z.string().optional(),
      description: z.string().optional(),
    }),
    handler: async (
      client: SevdeskClient,
      params: { contactCustomFieldSettingId: number; name?: string; description?: string }
    ) => {
      const { contactCustomFieldSettingId, ...body } = params;
      const { data, error } = await client.PUT(
        "/ContactCustomFieldSetting/{contactCustomFieldSettingId}",
        { params: { path: { contactCustomFieldSettingId } }, body: body as any }
      );
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_contact_custom_fields: {
    description: "List custom field values of contacts. Pass contactId to get those of one contact.",
    inputSchema: z.object({
      contactId: z.number().optional().describe("Only return custom fields of this contact"),
    }),
    handler: async (client: SevdeskClient, params: { contactId?: number }) => {
      const { data, error } = await client.GET("/ContactCustomField", {
        params: {
          query: (params.contactId !== undefined
            ? { "contact[id]": String(params.contactId), "contact[objectName]": "Contact" }
            : {}) as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  set_contact_custom_field: {
    description:
      "Create a custom field value on a contact. For an existing value use update_contact_custom_field.",
    inputSchema: z.object({
      contactId: z.number().describe("The contact"),
      contactCustomFieldSettingId: z
        .number()
        .describe("ID of the custom field definition (see list_contact_custom_field_settings)"),
      value: z.string().describe("The value"),
    }),
    handler: async (
      client: SevdeskClient,
      params: { contactId: number; contactCustomFieldSettingId: number; value: string }
    ) => {
      const { data, error } = await client.POST("/ContactCustomField", {
        body: {
          contact: contactRef(params.contactId),
          contactCustomFieldSetting: {
            id: params.contactCustomFieldSettingId,
            objectName: "ContactCustomFieldSetting",
          },
          value: params.value,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_contact_custom_field: {
    description: "Change the value of an existing contact custom field",
    inputSchema: z.object({
      contactCustomFieldId: z.number().describe("ID of the custom field value"),
      value: z.string().describe("The new value"),
    }),
    handler: async (
      client: SevdeskClient,
      params: { contactCustomFieldId: number; value: string }
    ) => {
      const { data, error } = await client.PUT("/ContactCustomField/{contactCustomFieldId}", {
        params: { path: { contactCustomFieldId: params.contactCustomFieldId } },
        body: { value: params.value } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  list_accounting_contacts: {
    description:
      "List accounting contacts (debitor / creditor numbers). Pass contactId to get the one of a contact.",
    inputSchema: z.object({
      contactId: z.number().optional().describe("Only return the accounting contact of this contact"),
    }),
    handler: async (client: SevdeskClient, params: { contactId?: number }) => {
      const { data, error } = await client.GET("/AccountingContact", {
        params: {
          query: (params.contactId !== undefined
            ? { "contact[id]": String(params.contactId), "contact[objectName]": "Contact" }
            : {}) as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_accounting_contact: {
    description: "Assign a debitor and/or creditor number to a contact",
    inputSchema: z.object({
      contactId: z.number().describe("The contact"),
      debitorNumber: z.number().optional().describe("Debitor number"),
      creditorNumber: z.number().optional().describe("Creditor number"),
    }),
    handler: async (
      client: SevdeskClient,
      params: { contactId: number; debitorNumber?: number; creditorNumber?: number }
    ) => {
      const { data, error } = await client.POST("/AccountingContact", {
        body: {
          contact: contactRef(params.contactId),
          debitorNumber: params.debitorNumber,
          creditorNumber: params.creditorNumber,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_accounting_contact: {
    description: "Change the debitor / creditor number of an accounting contact",
    inputSchema: z.object({
      accountingContactId: z.number().describe("ID of the accounting contact"),
      debitorNumber: z.number().nullable().optional().describe("Debitor number"),
      creditorNumber: z.number().nullable().optional().describe("Creditor number"),
    }),
    handler: async (
      client: SevdeskClient,
      params: {
        accountingContactId: number;
        debitorNumber?: number | null;
        creditorNumber?: number | null;
      }
    ) => {
      const { accountingContactId, ...body } = params;
      const { data, error } = await client.PUT("/AccountingContact/{accountingContactId}", {
        params: { path: { accountingContactId } },
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },
};
