import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";
import type { SevdeskClient } from "../client.js";

/**
 * Inlining a file as base64 into tool arguments means the caller generates the
 * whole blob token by token, which is orders of magnitude slower than letting
 * the server read the file from disk. Cap it so large uploads fail fast with a
 * pointer to `filePath` instead of crawling.
 */
const MAX_BASE64_KB = 256;
const MAX_BASE64_BYTES = MAX_BASE64_KB * 1024;

/**
 * macOS gates ~/Downloads, ~/Desktop and ~/Documents behind TCC. A stdio server
 * spawned by a GUI app inherits that app's permissions and cannot show the
 * consent prompt, so the read fails with a bare EPERM that looks like a bug in
 * the server. Say what actually happened instead.
 */
async function readFileOrExplain(filePath: string): Promise<Buffer> {
  try {
    return await readFile(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EACCES") {
      throw new Error(
        `No permission to read ${filePath}. On macOS, Downloads/Desktop/Documents are protected: ` +
          "grant the app running this server access under System Settings > Privacy & Security > " +
          "Files and Folders (then fully restart it), or move the file to an unprotected folder such as ~/sevdesk-inbox."
      );
    }
    if (code === "ENOENT") {
      throw new Error(
        `${filePath} does not exist on the machine running this server. ` +
          "Note that this is not necessarily the machine you run shell commands on."
      );
    }
    throw error;
  }
}

export const voucherTools = {
  list_vouchers: {
    description: "List all vouchers (receipts/expenses) from sevdesk",
    inputSchema: z.object({
      status: z.enum(["50", "100", "1000"]).optional().describe("Voucher status: 50=Draft, 100=Unpaid, 1000=Paid"),
      creditDebit: z.enum(["C", "D"]).optional().describe("C=Credit (income), D=Debit (expense)"),
      descriptionLike: z.string().optional().describe("Filter by description (partial match)"),
      startDate: z.string().optional().describe("Filter by start date (Unix timestamp)"),
      endDate: z.string().optional().describe("Filter by end date (Unix timestamp)"),
      limit: z.number().optional().describe("Limit the number of results"),
      offset: z.number().optional().describe("Skip a number of results"),
    }),
    handler: async (client: SevdeskClient, params: {
      status?: "50" | "100" | "1000";
      creditDebit?: "C" | "D";
      descriptionLike?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const { data, error } = await client.GET("/Voucher", {
        params: {
          query: {
            status: params.status ? Number(params.status) : undefined,
            creditDebit: params.creditDebit,
            descriptionLike: params.descriptionLike,
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

  get_voucher: {
    description: "Get a specific voucher by ID from sevdesk",
    inputSchema: z.object({
      voucherId: z.number().describe("The ID of the voucher to retrieve"),
    }),
    handler: async (client: SevdeskClient, params: { voucherId: number }) => {
      const { data, error } = await client.GET("/Voucher/{voucherId}", {
        params: {
          path: { voucherId: params.voucherId },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  book_voucher: {
    description:
      "Book a voucher against a check account, optionally linking it to an existing bank transaction (this is how a receipt gets matched to a transaction). For online/bank check accounts a checkAccountTransactionId is required; for other account types leave it out and sevdesk creates the transaction itself.",
    inputSchema: z.object({
      voucherId: z.number().describe("The ID of the voucher to book"),
      amount: z.number().describe("Amount to book"),
      date: z.string().describe("Booking date (Unix timestamp)"),
      type: z
        .enum(["FULL_PAYMENT", "N", "CB", "CF", "O", "OF", "MTC"])
        .describe(
          "Booking type: FULL_PAYMENT=normal full booking, N=partial booking, CB=reduced by discount (Skonto), CF=currency fluctuation (deprecated), O=reduced/higher for other reasons, OF=higher due to reminder charges, MTC=reduced by monetary traffic costs"
        ),
      checkAccountId: z.number().describe("ID of the check account (see list_check_accounts)"),
      checkAccountTransactionId: z
        .number()
        .optional()
        .describe(
          "ID of an existing transaction to link the voucher to (see list_transactions). Required for online/bank check accounts."
        ),
      createFeed: z.boolean().optional().describe("Create a feed entry"),
    }),
    handler: async (client: SevdeskClient, params: {
      voucherId: number;
      amount: number;
      date: string;
      type: "FULL_PAYMENT" | "N" | "CB" | "CF" | "O" | "OF" | "MTC";
      checkAccountId: number;
      checkAccountTransactionId?: number;
      createFeed?: boolean;
    }) => {
      const { data, error } = await client.PUT("/Voucher/{voucherId}/bookAmount", {
        params: {
          path: { voucherId: params.voucherId },
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

  get_voucher_positions: {
    description: "Get all positions (line items) of a voucher",
    inputSchema: z.object({
      voucherId: z.number().describe("The ID of the voucher"),
    }),
    handler: async (client: SevdeskClient, params: { voucherId: number }) => {
      const { data, error } = await client.GET("/VoucherPos", {
        params: {
          query: {
            "voucher[id]": params.voucherId,
            "voucher[objectName]": "Voucher",
          } as any,
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  upload_voucher_file: {
    description:
      "Upload a receipt document (PDF/image) to sevdesk's temporary file store. This does NOT attach it to a voucher on its own - it returns a `filename` hash which you pass to create_voucher to attach the document. Pass `filePath` whenever the file exists on the machine running THIS server, which is not necessarily the machine you run shell commands on: for a local stdio server that is the user's own computer, so a path like /Users/<name>/Downloads/receipt.pdf is valid here even if your sandbox cannot see it. Pass the path through and let the upload fail with a clear error rather than assuming it is unreachable. `base64Content` is a last resort for files that genuinely exist nowhere the server can read - inlining base64 into these arguments means generating it token by token, which is slow and easily corrupted, so it is capped.",
    inputSchema: z
      .object({
        filePath: z
          .string()
          .optional()
          .describe(
            "Absolute path of a local file to upload. Strongly preferred - use this whenever the file is on disk, and write it to a temp file first if it is not."
          ),
        base64Content: z
          .string()
          .optional()
          .describe(
            `Base64 encoded file content. Last resort only, and rejected above ${MAX_BASE64_KB} KB - use filePath instead.`
          ),
        fileName: z
          .string()
          .optional()
          .describe("Name of the file. Derived from filePath if omitted."),
        mimeType: z
          .string()
          .optional()
          .describe("MIME type of the file, e.g. 'application/pdf'. Default: application/pdf"),
      })
      .refine(
        (params) => Boolean(params.filePath) !== Boolean(params.base64Content),
        { message: "Provide exactly one of filePath (preferred) or base64Content" }
      ),
    handler: async (client: SevdeskClient, params: {
      filePath?: string;
      base64Content?: string;
      fileName?: string;
      mimeType?: string;
    }) => {
      let content: Buffer;
      let name: string;

      if (params.filePath) {
        content = await readFileOrExplain(params.filePath);
        name = params.fileName ?? basename(params.filePath);
      } else if (params.base64Content) {
        if (params.base64Content.length > MAX_BASE64_BYTES) {
          throw new Error(
            `base64Content is ${Math.round(params.base64Content.length / 1024)} KB, over the ${MAX_BASE64_KB} KB limit. ` +
              "Write the file to disk and pass filePath instead - inlining a file this size into the tool arguments takes minutes."
          );
        }
        content = Buffer.from(params.base64Content, "base64");
        name = params.fileName ?? "upload.pdf";
      } else {
        throw new Error("Either filePath or base64Content must be provided");
      }

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(content)], { type: params.mimeType ?? "application/pdf" }),
        name
      );

      const result = await client.requestForm<{
        objects?: { filename?: string; pages?: number; mimeType?: string; content?: unknown };
      }>("/Voucher/Factory/uploadTempFile", form);

      // The response embeds a base64 preview image under `content` - drop it.
      const objects = result.objects ?? {};
      const { content: _preview, ...rest } = objects as Record<string, unknown>;
      return { objects: rest };
    },
  },

  get_bookkeeping_system_version: {
    description:
      "Get the sevdesk bookkeeping system version of the account (1.0 or 2.0). Version 1.0 uses taxType + accountingTypeId, version 2.0 uses taxRuleId + accountDatevId. Check this before creating a voucher.",
    inputSchema: z.object({}),
    handler: async (client: SevdeskClient) => {
      return client.request("/Tools/bookkeepingSystemVersion");
    },
  },

  list_accounting_types: {
    description:
      "List booking accounts (accounting types) usable as accountingTypeId in voucher positions. Only relevant for bookkeeping system version 1.0.",
    inputSchema: z.object({
      limit: z.number().optional().describe("Limit the number of results. Default: 100"),
      offset: z.number().optional().describe("Skip a number of results"),
    }),
    handler: async (client: SevdeskClient, params: { limit?: number; offset?: number }) => {
      const result = await client.request<{ objects?: Record<string, unknown>[] }>(
        "/AccountingType",
        { query: { limit: params.limit ?? 100, offset: params.offset } }
      );
      // Trim the very wide response down to the fields needed to pick an account.
      return {
        objects: (result.objects ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          skr03: a.skr03,
          skr04: a.skr04,
          type: a.type,
        })),
      };
    },
  },

  list_booking_accounts: {
    description:
      "List booking accounts with the tax rules allowed for each, via sevdesk's receipt guidance. Use this to pick a valid account for a voucher position. Returns accountDatevId (for bookkeeping version 2.0) and the account number/name.",
    inputSchema: z.object({
      direction: z
        .enum(["expense", "revenue", "all"])
        .optional()
        .describe("Which accounts to return. Default: expense"),
    }),
    handler: async (client: SevdeskClient, params: { direction?: "expense" | "revenue" | "all" }) => {
      const path =
        params.direction === "revenue"
          ? "/ReceiptGuidance/forRevenue"
          : params.direction === "all"
            ? "/ReceiptGuidance/forAllAccounts"
            : "/ReceiptGuidance/forExpense";
      return client.request(path);
    },
  },

  create_voucher: {
    description:
      "Create a new voucher (receipt / expense or income record) with its positions in sevdesk. Attach a previously uploaded document by passing the `filename` returned by upload_voucher_file. Use taxType + accountingTypeId for bookkeeping version 1.0, or taxRuleId + accountDatevId for version 2.0 (see get_bookkeeping_system_version). Create it as a draft (status 50) first if you want to review it in the UI before booking.",
    inputSchema: z.object({
      creditDebit: z
        .enum(["C", "D"])
        .describe("C = credit (income), D = debit (expense). An outgoing payment is 'D'."),
      voucherDate: z.string().describe("Voucher date as dd.mm.yyyy or a Unix timestamp"),
      status: z
        .enum(["50", "100"])
        .optional()
        .describe("50 = draft, 100 = open/unpaid. Default: 100. Only these two are valid here."),
      voucherType: z
        .enum(["VOU", "RV"])
        .optional()
        .describe("VOU = normal voucher, RV = recurring voucher. Default: VOU"),
      description: z
        .string()
        .optional()
        .describe("Description of the voucher - essentially the voucher number"),
      supplierId: z.number().optional().describe("ID of the supplier contact"),
      supplierName: z
        .string()
        .optional()
        .describe("Free-text supplier name, shown when no supplier contact is set"),
      taxType: z
        .enum(["default", "eu", "noteu", "custom", "ss"])
        .optional()
        .describe(
          "Bookkeeping version 1.0 only. default = with VAT, eu = intra-community supply, noteu = reverse charge outside EU, ss = not subject to VAT (Kleinunternehmer). Default: default"
        ),
      taxRuleId: z
        .enum(["1", "2", "3", "4", "5", "11"])
        .optional()
        .describe(
          "Bookkeeping version 2.0 only. 1 = taxable, 2 = exports, 3 = intra-community supply, 4 = tax-free per §4 UStG, 5 = reverse charge §13b, 11 = Kleinunternehmer §19"
        ),
      payDate: z.string().optional().describe("Payment date as dd.mm.yyyy or Unix timestamp"),
      deliveryDate: z.string().optional().describe("Delivery date as dd.mm.yyyy or Unix timestamp"),
      paymentDeadline: z.string().optional().describe("Payment deadline as dd.mm.yyyy or Unix timestamp"),
      currency: z.string().optional().describe("Currency code, e.g. 'EUR'"),
      filename: z
        .string()
        .optional()
        .describe("Filename hash returned by upload_voucher_file, to attach that document"),
      positions: z
        .array(
          z.object({
            sum: z.number().describe("Amount of this position"),
            net: z
              .boolean()
              .optional()
              .describe("true = `sum` is a net amount, false = gross. Default: false (gross)"),
            taxRate: z.number().describe("Tax rate in percent, e.g. 19 or 0"),
            accountingTypeId: z
              .number()
              .optional()
              .describe("Booking account ID for bookkeeping version 1.0 (see list_accounting_types)"),
            accountDatevId: z
              .number()
              .optional()
              .describe("Booking account ID for bookkeeping version 2.0 (see list_booking_accounts)"),
            comment: z.string().optional().describe("Comment for this position"),
          })
        )
        .min(1)
        .describe("The voucher positions (line items). At least one is required."),
    }),
    handler: async (client: SevdeskClient, params: {
      creditDebit: "C" | "D";
      voucherDate: string;
      status?: "50" | "100";
      voucherType?: "VOU" | "RV";
      description?: string;
      supplierId?: number;
      supplierName?: string;
      taxType?: "default" | "eu" | "noteu" | "custom" | "ss";
      taxRuleId?: "1" | "2" | "3" | "4" | "5" | "11";
      payDate?: string;
      deliveryDate?: string;
      paymentDeadline?: string;
      currency?: string;
      filename?: string;
      positions: {
        sum: number;
        net?: boolean;
        taxRate: number;
        accountingTypeId?: number;
        accountDatevId?: number;
        comment?: string;
      }[];
    }) => {
      const voucher: Record<string, unknown> = {
        objectName: "Voucher",
        mapAll: true,
        voucherDate: params.voucherDate,
        status: Number(params.status ?? "100"),
        creditDebit: params.creditDebit,
        voucherType: params.voucherType ?? "VOU",
        description: params.description,
        supplierName: params.supplierName,
        payDate: params.payDate,
        deliveryDate: params.deliveryDate,
        paymentDeadline: params.paymentDeadline,
        currency: params.currency,
      };
      if (params.supplierId !== undefined) {
        voucher.supplier = { id: params.supplierId, objectName: "Contact" };
      }
      if (params.taxRuleId !== undefined) {
        voucher.taxRule = { id: params.taxRuleId, objectName: "TaxRule" };
      } else {
        voucher.taxType = params.taxType ?? "default";
      }

      const voucherPosSave = params.positions.map((pos) => {
        const isNet = pos.net ?? false;
        const sumNet = isNet ? pos.sum : undefined;
        const sumGross = isNet ? undefined : pos.sum;
        const position: Record<string, unknown> = {
          objectName: "VoucherPos",
          mapAll: true,
          net: isNet,
          taxRate: pos.taxRate,
          sumNet,
          sumGross,
          comment: pos.comment,
        };
        if (pos.accountDatevId !== undefined) {
          position.accountDatev = { id: pos.accountDatevId, objectName: "AccountDatev" };
        }
        if (pos.accountingTypeId !== undefined) {
          position.accountingType = { id: pos.accountingTypeId, objectName: "AccountingType" };
        }
        return position;
      });

      const { data, error } = await client.POST("/Voucher/Factory/saveVoucher", {
        body: {
          voucher,
          voucherPosSave,
          voucherPosDelete: null,
          // sevdesk requires `filename` to be the last attribute of the payload.
          ...(params.filename ? { filename: params.filename } : {}),
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },
};
