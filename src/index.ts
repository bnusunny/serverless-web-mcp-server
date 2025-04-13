#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerDeploymentTools } from "./mcp/tools.js";
import { registerDeploymentResources } from "./mcp/resources.js";
import express from "express";
import minimist from "minimist";
import fs from "fs";
import path from "path";
import cors from "cors";

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ["templates"],
  boolean: ["debug", "help"],
  alias: {
    d: "debug",
    t: "templates",
    h: "help"
  }
});

// Show help if requested
if (argv.help) {
  console.log(`
Usage:
  serverless-web-mcp [options]

Options:
  --debug, -d                 Enable debug logging
  --templates, -t <path>      Specify templates directory path
  --help, -h                  Show this help message
  
Environment Variables:
  MCP_TRANSPORT               Transport method (stdio or http, default: stdio)
  PORT                        HTTP server port (default: 3000)
  TEMPLATES_PATH              Path to templates directory
  `);
  process.exit(0);
}

// Enable debug logging if requested
if (argv.debug) {
  process.env.DEBUG = "true";
}

// Set templates path from command line, environment variable, or default
const templatesPath = argv.templates || process.env.TEMPLATES_PATH || "./templates";

// Check if templates directory exists
if (!fs.existsSync(templatesPath)) {
  console.error(`Templates directory not found: ${templatesPath}`);
  console.error("Please specify a valid templates directory using --templates option or TEMPLATES_PATH environment variable");
  process.exit(1);
}

// Set transport method from environment variable or default
const transport = process.env.MCP_TRANSPORT || "stdio";

// Create MCP server
const server = new McpServer({
  name: "serverless-web-mcp",
  version: "0.1.3",
  description: "Serverless Web MCP Server for deploying web applications to AWS serverless infrastructure"
});

// Register tools and resources
registerDeploymentTools(server);
registerDeploymentResources(server);

// Start the server with the appropriate transport
if (transport === "http") {
  // HTTP transport with SSE
  const app = express();
  const port = process.env.PORT || 3000;
  
  // Enable CORS
  app.use(cors());
  app.use(express.json());
  
  // Store active SSE transports by session ID
  const transports: { [sessionId: string]: SSEServerTransport } = {};
  
  // SSE endpoint for establishing connection
  app.get("/mcp/sse", async (req, res) => {
    console.log("New SSE connection established");
    
    // Create a new SSE transport
    const transport = new SSEServerTransport('/mcp/messages', res);
    const sessionId = transport.sessionId;
    
    // Store the transport
    transports[sessionId] = transport;
    
    // Clean up when the connection closes
    res.on("close", () => {
      console.log(`SSE connection closed for session ${sessionId}`);
      delete transports[sessionId];
    });
    
    // Connect the server to the transport
    try {
      await server.connect(transport);
      console.log(`Server connected to transport for session ${sessionId}`);
    } catch (error) {
      console.error("Error connecting server to transport:", error);
      res.status(500).end();
    }
  });
  
  // Message endpoint for receiving client messages
  app.post("/mcp/messages", async (req, res) => {
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
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Error handling message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Add a health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  
  // Add a simple HTML page to test the SSE connection
  app.get("/", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Serverless Web MCP Server</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow: auto; }
          .container { margin-top: 20px; }
          button { padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #45a049; }
          #output { margin-top: 20px; border: 1px solid #ddd; padding: 10px; height: 300px; overflow: auto; }
        </style>
      </head>
      <body>
        <h1>Serverless Web MCP Server</h1>
        <p>This is a Model Context Protocol (MCP) server for deploying web applications to AWS serverless infrastructure.</p>
        
        <div class="container">
          <h2>Test MCP Resources</h2>
          <button id="listResources">List Resources</button>
          <button id="getMcpResources">Get mcp:resources</button>
          <pre id="output"></pre>
        </div>
        
        <script>
          const output = document.getElementById('output');
          let sessionId = null;
          let eventSource = null;
          
          function log(message) {
            output.textContent += message + '\\n';
            output.scrollTop = output.scrollHeight;
          }
          
          function connectSSE() {
            eventSource = new EventSource('/mcp/sse');
            
            eventSource.onopen = () => {
              log('SSE connection established');
            };
            
            eventSource.onmessage = (event) => {
              const data = JSON.parse(event.data);
              log('Received: ' + JSON.stringify(data, null, 2));
              
              // Extract session ID from the first message
              if (data.method === 'connection/init' && data.params && data.params.sessionId) {
                sessionId = data.params.sessionId;
                log('Session ID: ' + sessionId);
              }
            };
            
            eventSource.onerror = (error) => {
              log('SSE Error: ' + JSON.stringify(error));
              eventSource.close();
            };
          }
          
          async function sendRequest(method, params) {
            if (!sessionId) {
              log('No session ID available. Establish connection first.');
              return;
            }
            
            const request = {
              jsonrpc: '2.0',
              id: Date.now(),
              method,
              params
            };
            
            log('Sending: ' + JSON.stringify(request, null, 2));
            
            try {
              const response = await fetch(\`/mcp/messages?sessionId=\${sessionId}\`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
              });
              
              if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
              }
              
              const data = await response.json();
              log('Response: ' + JSON.stringify(data, null, 2));
            } catch (error) {
              log('Error: ' + error.message);
            }
          }
          
          document.getElementById('listResources').addEventListener('click', () => {
            sendRequest('resource/list', {});
          });
          
          document.getElementById('getMcpResources').addEventListener('click', () => {
            sendRequest('resource/get', { uri: 'mcp:resources' });
          });
          
          // Connect when the page loads
          connectSSE();
        </script>
      </body>
      </html>
    `);
  });
  
  app.listen(port, () => {
    console.log(`Serverless Web MCP Server listening on port ${port}`);
    console.log(`MCP SSE endpoint: http://localhost:${port}/mcp/sse`);
    console.log(`MCP message endpoint: http://localhost:${port}/mcp/messages`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Test page: http://localhost:${port}/`);
    console.log(`Server is ready to accept requests`);
  });
} else {
  // Stdio transport - this is the mode that Roo Code uses
  console.log("Serverless Web MCP Server started in stdio mode");
  
  try {
    // Create the StdioServerTransport
    const stdioTransport = new StdioServerTransport();
    
    // Connect the server to the transport
    // Note: connect() automatically starts the transport
    server.connect(stdioTransport);
    
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
