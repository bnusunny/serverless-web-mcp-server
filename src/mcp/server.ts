import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import tools, { McpTool } from "./tools/index.js";
import resources, { McpResource } from "./resources/index.js";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from "../utils/logger.js";

// Define the directory where deployment status files will be stored
const DEPLOYMENT_STATUS_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-deployments');

// Ensure the directory exists
if (!fs.existsSync(DEPLOYMENT_STATUS_DIR)) {
  fs.mkdirSync(DEPLOYMENT_STATUS_DIR, { recursive: true });
}

/**
 * Creates and configures the MCP server
 * @returns The configured MCP server instance
 */
export function createMcpServer(): McpServer {
  // Create MCP server
  const server = new McpServer({
    name: "serverless-web-mcp",
    version: "0.1.3",
    description: "Serverless Web MCP Server for deploying web applications to AWS serverless infrastructure"
  });

  // Register tools
  tools.forEach((tool: McpTool) => {
    const originalHandler = tool.handler;
    
    // Wrap the tool handler with logging
    const wrappedHandler = async (params: any) => {
      logger.debug(`[TOOL INVOKED] ${tool.name}`, { params });
      try {
        const result = await originalHandler(params);
        logger.debug(`[TOOL RESULT] ${tool.name}`, { result });
        return result;
      } catch (error) {
        logger.error(`[TOOL ERROR] ${tool.name}`, { error });
        throw error;
      }
    };
    
    server.tool(
      tool.name, 
      tool.description, 
      tool.parameters, 
      wrappedHandler
    );
  });

  // Register resources
  resources.forEach((resource: McpResource) => {
    const originalHandler = resource.handler;
    
    // Wrap the resource handler with logging
    const wrappedHandler = async (params: any) => {
      logger.debug(`[RESOURCE ACCESSED] ${resource.name}`, { params });
      try {
        const result = await originalHandler(params);
        logger.debug(`[RESOURCE RESULT] ${resource.name}`, { result });
        return result;
      } catch (error) {
        logger.error(`[RESOURCE ERROR] ${resource.name}`, { error });
        throw error;
      }
    };
    
    if (typeof resource.uri === 'string') {
      // Static resource with a fixed URI
      server.resource(resource.name, resource.uri, wrappedHandler);
    } else {
      // Dynamic resource with a template URI
      server.resource(resource.name, resource.uri, wrappedHandler);
    }
  });

  return server;
}

/**
 * Starts the MCP server with stdio transport
 */
export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  
  logger.info("Starting MCP server with stdio transport");
  logger.info(`Log file location: ${(logger as any).getLogFilePath()}`);
  
  try {
    await server.connect(transport);
    logger.info("MCP server connected to stdio transport");
  } catch (error) {
    logger.error("Error connecting MCP server to stdio transport:", error);
    process.exit(1);
  }
}
