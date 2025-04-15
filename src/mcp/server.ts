import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import tools, {McpTool} from "./tools/index.js";
import resources, { McpResource } from "./resources/index.js";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from "../utils/logger.js";
import { z } from 'zod';

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

  // Register tools with their proper Zod schemas
  tools.forEach((tool: McpTool) => {
    server.tool(tool.name, tool.description, tool.parameters, tool.handler);
  });

  // Register resources
  resources.forEach((resource: McpResource) => {
    server.resource(resource.name, resource.uri, resource.handler);
  });

  return server;
}

/**
 * Starts the MCP server with stdio transport
 * @param server The MCP server instance
 */
export async function startStdioServer(server: McpServer): Promise<void> {
  logger.info("Serverless Web MCP Server started in stdio mode");
  
  try {
    // Create the StdioServerTransport
    const stdioTransport = new StdioServerTransport();
    
    // Connect the server to the transport
    // Note: connect() automatically starts the transport
    await server.connect(stdioTransport);
    
    logger.info("Server connected to transport and ready to receive requests");
    
    // Handle process termination
    process.on('SIGINT', async () => {
      logger.info("Received SIGINT. Exiting.");
      await server.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info("Received SIGTERM. Exiting.");
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error("Error setting up server:", error);
    process.exit(1);
  }
}

/**
 * Starts the MCP server with HTTP transport
 * @param server The MCP server instance
 * @param port The port to listen on
 */
export async function startHttpServer(server: McpServer, port: number): Promise<void> {
  // HTTP transport with SSE
  const app = express();
  
  // Enable CORS
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
  // Parse JSON bodies
  app.use(bodyParser.json({
    limit: '4mb'
  }));
  
  // Parse URL-encoded bodies
  app.use(bodyParser.urlencoded({
    extended: true,
    limit: '4mb'
  }));
  
  // Store active SSE transports by session ID
  const transports: { [sessionId: string]: SSEServerTransport } = {};
  
  // SSE endpoint for establishing connection
  app.get("/sse", async (req, res) => {
    logger.info("New SSE connection established");
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    
    // Create a new SSE transport
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    
    // Store the transport
    transports[sessionId] = transport;
    
    // Clean up when the connection closes
    res.on("close", () => {
      logger.info(`SSE connection closed for session ${sessionId}`);
      delete transports[sessionId];
    });
    
    // Connect the server to the transport
    try {
      // Connect the server to the transport (this will call transport.start() internally)
      await server.connect(transport);
      
      logger.info(`Server connected to transport for session ${sessionId}`);
      
    } catch (error) {
      logger.error("Error connecting server to transport:", error);
      res.status(500).end();
    }
  });
  
  // Message endpoint for receiving client messages
  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      logger.error("No sessionId provided in request");
      return res.status(400).json({ error: "No sessionId provided" });
    }
    
    const transport = transports[sessionId];
    
    if (!transport) {
      logger.error(`No transport found for sessionId: ${sessionId}`);
      return res.status(400).json({ error: "Invalid sessionId" });
    }
    
    try {
      if (process.env.DEBUG) {
        logger.debug(`Received request for session ${sessionId}:`, req.body);
        logger.debug(`Request headers:`, req.headers);
      }
      
      // Ensure we have a valid request body
      if (!req.body) {
        return res.status(400).json({ 
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Missing request body"
          }
        });
      }
      
      // Pass the parsed body directly to handlePostMessage
      await transport.handlePostMessage(req, res, req.body);
      
      if (process.env.DEBUG) {
        logger.debug(`Handled request for session ${sessionId}`);
      }
    } catch (error) {
      logger.error("Error handling message:", error);
      res.status(500).json({ 
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "Internal server error"
        }
      });
    }
  });
  
  // Add a health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  
  // Add an endpoint to get the log file path
  app.get("/logs", (req, res) => {
    res.status(200).json({ 
      logFile: logger.getLogFilePath(),
      message: "Use this path to view the server logs"
    });
  });
  
  return new Promise((resolve) => {
    app.listen(port, () => {
      logger.info(`Serverless Web MCP Server listening on port ${port}`);
      logger.info(`MCP SSE endpoint: http://localhost:${port}/sse`);
      logger.info(`MCP message endpoint: http://localhost:${port}/messages`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Logs endpoint: http://localhost:${port}/logs`);
      logger.info(`Server is ready to accept requests`);
      resolve();
    });
  });
}

/**
 * Start the MCP server with the appropriate transport
 */
export async function startServer(): Promise<void> {
  // Create the MCP server
  const server = createMcpServer();
  
  // Determine which transport to use
  const transport = process.env.MCP_TRANSPORT || 'stdio';
  
  if (transport === 'http') {
    const port = parseInt(process.env.PORT || '3000', 10);
    await startHttpServer(server, port);
  } else {
    await startStdioServer(server);
  }
}
