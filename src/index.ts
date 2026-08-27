#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createSevdeskClient, type SevdeskClient } from "./client.js";
import {
  contactTools,
  addressTools,
  invoiceTools,
  voucherTools,
  accountTools,
  partTools,
  tagTools,
} from "./tools/index.js";

// Combine all tools
const allTools = {
  ...contactTools,
  ...addressTools,
  ...invoiceTools,
  ...voucherTools,
  ...accountTools,
  ...partTools,
  ...tagTools,
};

type ToolName = keyof typeof allTools;

// Get API token from environment
const API_TOKEN = process.env.SEVDESK_API_TOKEN;

if (!API_TOKEN) {
  console.error("Error: SEVDESK_API_TOKEN environment variable is required");
  console.error("Please set it to your sevdesk API token");
  process.exit(1);
}

// Create sevdesk client
const sevdeskClient: SevdeskClient = createSevdeskClient(API_TOKEN);

// Create MCP server
const server = new Server(
  {
    name: "mcp-sevdesk",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * MCP requires the input schema to be a plain JSON Schema object.
 * `$refStrategy: "none"` inlines everything, since not every MCP client
 * resolves `$ref`/`definitions`.
 */
function toInputSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return { type: "object", properties: {}, ...jsonSchema };
}

// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Object.entries(allTools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: toInputSchema(tool.inputSchema),
  }));

  return { tools };
});

// Handler for calling tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!(name in allTools)) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }

  const tool = allTools[name as ToolName];

  try {
    // Validate input
    const validatedArgs = tool.inputSchema.parse(args);

    // Execute the tool
    const result = await (tool.handler as any)(sevdeskClient, validatedArgs);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("sevdesk MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
