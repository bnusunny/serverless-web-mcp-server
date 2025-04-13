import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerDeploymentTools } from "./tools.js";
import { registerDeploymentResources } from "./resources.js";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

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

  // Register tools and resources
  registerDeploymentTools(server);
  registerDeploymentResources(server);

  return server;
}

/**
 * Starts the MCP server with stdio transport
 * @param server The MCP server instance
 */
export async function startStdioServer(server: McpServer): Promise<void> {
  console.log("Serverless Web MCP Server started in stdio mode");
  
  try {
    // Create the StdioServerTransport
    const stdioTransport = new StdioServerTransport();
    
    // Connect the server to the transport
    // Note: connect() automatically starts the transport
    await server.connect(stdioTransport);
    
    console.log("Server connected to transport and ready to receive requests");
    
    // Handle process termination
    process.on('SIGINT', async () => {
      console.log("Received SIGINT. Exiting.");
      await server.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log("Received SIGTERM. Exiting.");
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("Error setting up server:", error);
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
    console.log("New SSE connection established");
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    
    // Create a new SSE transport
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    
    // Store the transport
    transports[sessionId] = transport;
    
    // Track if connection/init was sent
    let connectionInitSent = false;
    
    // Clean up when the connection closes
    res.on("close", () => {
      console.log(`SSE connection closed for session ${sessionId}`);
      delete transports[sessionId];
    });
    
    // Connect the server to the transport
    try {
      // Connect the server to the transport (this will call transport.start() internally)
      await server.connect(transport);
      
      console.log(`Server connected to transport for session ${sessionId}`);
      
      // Manually send a connection/init message if the SDK doesn't
      // This ensures the client gets the session ID
      if (process.env.DEBUG) {
        console.log("Checking if connection/init was sent...");
      }
      
      // Give the SDK a moment to send its own connection/init
      setTimeout(() => {
        // Check if we need to manually send a connection/init message
        if (!connectionInitSent) {
          console.log("Manually sending connection/init message");
          transport.send({
            jsonrpc: "2.0",
            method: "connection/init",
            params: {
              sessionId: sessionId,
              serverInfo: {
                name: "serverless-web-mcp",
                version: "0.1.3"
              }
            }
          });
          connectionInitSent = true;
        }
      }, 500);
      
      // Monkey patch the send method to track if connection/init was sent
      const originalSend = transport.send;
      transport.send = async (message: any) => {
        if (message.method === "connection/init") {
          connectionInitSent = true;
          if (process.env.DEBUG) {
            console.log("SDK sent connection/init message");
          }
        }
        return originalSend.call(transport, message);
      };
    } catch (error) {
      console.error("Error connecting server to transport:", error);
      res.status(500).end();
    }
  });
  
  // Message endpoint for receiving client messages
  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      console.error("No sessionId provided in request");
      return res.status(400).json({ error: "No sessionId provided" });
    }
    
    const transport = transports[sessionId];
    
    if (!transport) {
      console.error(`No transport found for sessionId: ${sessionId}`);
      return res.status(400).json({ error: "Invalid sessionId" });
    }
    
    try {
      if (process.env.DEBUG) {
        console.log(`Received request for session ${sessionId}:`, req.body);
        console.log(`Request headers:`, req.headers);
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
        console.log(`Handled request for session ${sessionId}`);
      }
    } catch (error) {
      console.error("Error handling message:", error);
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
  
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Serverless Web MCP Server listening on port ${port}`);
      console.log(`MCP SSE endpoint: http://localhost:${port}/sse`);
      console.log(`MCP message endpoint: http://localhost:${port}/messages`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Server is ready to accept requests`);
      resolve();
    });
  });
}
