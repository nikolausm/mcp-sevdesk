import { describe, it, expect, beforeAll } from "vitest";
import { getClient, hasApiToken } from "./setup.js";
import { communicationTools } from "../src/tools/communication.js";
import type { SevdeskClient } from "../src/client.js";

describe("Communication / contact master data API", () => {
  let client: SevdeskClient;

  beforeAll(() => {
    if (hasApiToken) {
      client = getClient();
    }
  });

  it.skipIf(!hasApiToken)("sollte Kommunikationswege auflisten können", async () => {
    const result = await communicationTools.list_communication_ways.handler(client, {});
    expect(result).toHaveProperty("objects");
  });

  it.skipIf(!hasApiToken)("sollte Kommunikations-Schlüssel auflisten können", async () => {
    const result = await communicationTools.list_communication_way_keys.handler(client);
    expect(result).toHaveProperty("objects");
  });

  it.skipIf(!hasApiToken)("sollte die nächste Kundennummer liefern", async () => {
    const result = await communicationTools.get_next_customer_number.handler(client);
    expect(result).toHaveProperty("objects");
  });

  it.skipIf(!hasApiToken)("sollte benutzerdefinierte Kontaktfelder auflisten können", async () => {
    const result = await communicationTools.list_contact_custom_field_settings.handler(client);
    expect(result).toHaveProperty("objects");
  });

  it.skipIf(!hasApiToken)("sollte Buchhaltungskontakte auflisten können", async () => {
    const result = await communicationTools.list_accounting_contacts.handler(client, {});
    expect(result).toHaveProperty("objects");
  });

  it("validiert die Eingabe für create_communication_way", () => {
    const schema = communicationTools.create_communication_way.inputSchema;
    expect(schema.safeParse({ contactId: 1, type: "EMAIL", value: "a@b.lu", keyId: 2 }).success).toBe(true);
    expect(schema.safeParse({ contactId: 1, type: "FAX", value: "x", keyId: 2 }).success).toBe(false);
  });
});
