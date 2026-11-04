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
import { createSevdeskClient, type SevdeskClient } from "./client.js";
import {
  contactTools,
  invoiceTools,
  voucherTools,
  accountTools,
  partTools,
  tagTools,
} from "./tools/index.js";

// Combine all tools
const allTools = {
  ...contactTools,
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

// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Object.entries(allTools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema),
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
        `Invalid parameters: ${error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
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

// Convert Zod schema to JSON Schema
function zodToJsonSchema(schema: z.ZodType): object {
  const jsonSchema: Record<string, any> = {
    type: "object",
    properties: {},
    required: [],
  };

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodType;
      const propertySchema = zodTypeToJsonSchema(zodValue);
      jsonSchema.properties[key] = propertySchema;

      // Check if required
      if (!(zodValue instanceof z.ZodOptional)) {
        jsonSchema.required.push(key);
      }
    }
  }

  if (jsonSchema.required.length === 0) {
    delete jsonSchema.required;
  }

  return jsonSchema;
}

function zodTypeToJsonSchema(zodType: unknown): object {
  // Handle optional types
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }

  // Handle string
  if (zodType instanceof z.ZodString) {
    const schema: Record<string, any> = { type: "string" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }

  // Handle number
  if (zodType instanceof z.ZodNumber) {
    const schema: Record<string, any> = { type: "number" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }

  // Handle boolean
  if (zodType instanceof z.ZodBoolean) {
    const schema: Record<string, any> = { type: "boolean" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }

  // Handle enum
  if (zodType instanceof z.ZodEnum) {
    const schema: Record<string, any> = {
      type: "string",
      enum: zodType.options,
    };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }

  // Handle array
  if (zodType instanceof z.ZodArray) {
    const schema: Record<string, any> = {
      type: "array",
      items: zodTypeToJsonSchema(zodType.element),
    };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }

  // Default fallback
  return { type: "string" };
}

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
