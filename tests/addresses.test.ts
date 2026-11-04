import { describe, it, expect, beforeAll } from "vitest";
import { getClient, hasApiToken } from "./setup.js";
import { addressTools } from "../src/tools/addresses.js";
import { contactTools } from "../src/tools/contacts.js";
import type { SevdeskClient } from "../src/client.js";

describe("ContactAddress API (lesend)", () => {
  let client: SevdeskClient;

  beforeAll(() => {
    if (hasApiToken) {
      client = getClient();
    }
  });

  describe("list_contact_addresses", () => {
    it.skipIf(!hasApiToken)("sollte Adressen auflisten können", async () => {
      const result = await addressTools.list_contact_addresses.handler(client, {
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("objects");
      expect(Array.isArray(result!.objects)).toBe(true);
    });

    it.skipIf(!hasApiToken)("sollte nach Kontakt filtern können", async () => {
      const contacts = await contactTools.list_contacts.handler(client, { limit: 1 });
      if (!contacts.objects?.length) return;

      const contactId = Number(contacts.objects[0].id);
      const result = await addressTools.list_contact_addresses.handler(client, {
        contactId,
      });

      expect(result).toHaveProperty("objects");
      for (const address of result!.objects ?? []) {
        expect(Number(address.contact.id)).toBe(contactId);
      }
    });
  });

  describe("get_contact_address", () => {
    it.skipIf(!hasApiToken)("sollte eine einzelne Adresse abrufen können", async () => {
      const list = await addressTools.list_contact_addresses.handler(client, { limit: 1 });
      if (!list!.objects?.length) return;

      const contactAddressId = Number(list!.objects[0].id);
      const result = await addressTools.get_contact_address.handler(client, {
        contactAddressId,
      });

      expect(result).toHaveProperty("objects");
    });
  });

  describe("Nachschlage-Tools", () => {
    it.skipIf(!hasApiToken)("sollte Länder auflisten können", async () => {
      const result = (await addressTools.list_countries.handler(client, {
        limit: 5,
      })) as { objects?: unknown[] };

      expect(result).toHaveProperty("objects");
      expect(Array.isArray(result.objects)).toBe(true);
    });

    it.skipIf(!hasApiToken)("sollte Adress-Kategorien auflisten können", async () => {
      const result = (await addressTools.list_address_categories.handler(client)) as {
        objects?: { objectName?: string }[];
      };

      expect(result).toHaveProperty("objects");
      expect(Array.isArray(result.objects)).toBe(true);
    });
  });
});
