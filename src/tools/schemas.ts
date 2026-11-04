import { z } from "zod";

export const ref = (id: number, objectName: string) => ({ id, objectName });

/** Line item shared by invoices, orders and credit notes. */
export const positionSchema = z.object({
  name: z.string().optional().describe("Position title (use this or partId)"),
  text: z.string().optional().describe("Longer description of the position"),
  partId: z.number().optional().describe("ID of an existing article (see list_parts)"),
  quantity: z.number().describe("Quantity"),
  price: z.number().describe("Net price per unit"),
  taxRate: z.number().describe("Tax rate in percent, e.g. 17 or 0"),
  unityId: z.number().optional().describe("ID of the unit (default 1 = piece)"),
  discount: z.number().optional().describe("Position discount in percent"),
  positionNumber: z.number().optional().describe("Order of the position, starting at 0"),
});

export type PositionInput = z.infer<typeof positionSchema>;

export function buildPosition(pos: PositionInput, objectName: string, index: number) {
  return {
    objectName,
    mapAll: true,
    quantity: pos.quantity,
    price: pos.price,
    taxRate: pos.taxRate,
    name: pos.name,
    text: pos.text,
    discount: pos.discount,
    positionNumber: pos.positionNumber ?? index,
    unity: ref(pos.unityId ?? 1, "Unity"),
    ...(pos.partId !== undefined ? { part: ref(pos.partId, "Part") } : {}),
  };
}

const taxRuleIds = ["1", "2", "3", "4", "5", "11", "17", "18", "19", "20", "21"] as const;

/** Fields every document (invoice, order, credit note) needs to be created. */
export const documentFields = {
  contactId: z.number().describe("ID of the customer contact (see list_contacts)"),
  contactPersonId: z
    .number()
    .describe("ID of the sevdesk user who is the contact person (required by the API)"),
  date: z.string().describe("Document date, ISO 8601 e.g. 2026-11-04"),
  positions: z.array(positionSchema).min(1).describe("Line items"),
  taxRuleId: z
    .enum(taxRuleIds)
    .optional()
    .describe(
      "Tax rule (default 1 = taxable revenue; 2-5 cover exports, intra-EU supply, tax-free and reverse charge - check the sevdesk docs for the rest)"
    ),
  taxRate: z.number().optional().describe("Document level tax rate (default 0, positions carry their own)"),
  taxText: z.string().optional().describe("Tax text (default 'Umsatzsteuer ausweisen')"),
  currency: z.string().optional().describe("ISO 4217 currency code (default EUR)"),
  addressCountryId: z.number().optional().describe("Country ID for the address (see list_countries)"),
  address: z.string().optional().describe("Address block printed on the document"),
  header: z.string().optional().describe("Document title / header"),
  headText: z.string().optional().describe("Text above the positions"),
  footText: z.string().optional().describe("Text below the positions"),
  customerInternalNote: z.string().optional().describe("Internal note, not shown to the customer"),
  showNet: z.boolean().optional().describe("Show net amounts (default true)"),
};

export type DocumentInput = {
  contactId: number;
  contactPersonId: number;
  date: string;
  positions: PositionInput[];
  taxRuleId?: (typeof taxRuleIds)[number];
  taxRate?: number;
  taxText?: string;
  currency?: string;
  addressCountryId?: number;
  address?: string;
  header?: string;
  headText?: string;
  footText?: string;
  customerInternalNote?: string;
  showNet?: boolean;
};

/** Properties common to the invoice / order / credit note models. */
export function buildDocumentCommon(p: DocumentInput) {
  return {
    mapAll: true,
    contact: ref(p.contactId, "Contact"),
    contactPerson: ref(p.contactPersonId, "SevUser"),
    taxRule: ref(Number(p.taxRuleId ?? "1"), "TaxRule"),
    taxRate: p.taxRate ?? 0,
    taxText: p.taxText ?? "Umsatzsteuer ausweisen",
    currency: p.currency ?? "EUR",
    header: p.header,
    headText: p.headText ?? null,
    footText: p.footText ?? null,
    address: p.address ?? null,
    customerInternalNote: p.customerInternalNote ?? null,
    showNet: p.showNet ?? true,
    ...(p.addressCountryId !== undefined
      ? { addressCountry: ref(p.addressCountryId, "StaticCountry") }
      : {}),
  };
}

export const embedField = z
  .string()
  .optional()
  .describe("Comma separated nested resources to embed, e.g. 'contact,positions'");
