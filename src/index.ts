#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDeploymentTools } from "./mcp/tools.js";
import { registerDeploymentResources } from "./mcp/resources.js";
import express from "express";
import minimist from "minimist";
import fs from "fs";
import path from "path";

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
  // HTTP transport
  const app = express();
  const port = process.env.PORT || 3000;
  
  // Set up the HTTP endpoint
  app.use("/mcp", express.json(), async (req, res) => {
    try {
      // Process the request based on its method
      const { method } = req.body;
      let response;
      
      if (method === "resource/get") {
        // Handle resource request
        const { params } = req.body;
        const uri = params?.uri;
        
        if (!uri) {
          throw new Error("Missing resource URI");
        }
        
        // Find the appropriate resource handler
        const resourceHandlers = (server as any)._resourceHandlers;
        const handler = resourceHandlers?.get(uri);
        
        if (!handler) {
          throw new Error(`Resource not found: ${uri}`);
        }
        
        response = {
          jsonrpc: "2.0",
          id: req.body.id,
          result: await handler(params)
        };
      } else if (method === "tool/invoke") {
        // Handle tool request
        const { params } = req.body;
        const name = params?.name;
        
        if (!name) {
          throw new Error("Missing tool name");
        }
        
        // Find the appropriate tool handler
        const toolHandlers = (server as any)._toolHandlers;
        const handler = toolHandlers?.get(name);
        
        if (!handler) {
          throw new Error(`Tool not found: ${name}`);
        }
        
        response = {
          jsonrpc: "2.0",
          id: req.body.id,
          result: await handler(params.parameters)
        };
      } else {
        throw new Error(`Unsupported method: ${method}`);
      }
      
      res.json(response);
    } catch (error) {
      console.error("Error handling request:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "Internal server error"
        },
        id: req.body.id || null
      });
    }
  });
  
  // Add a health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  
  app.listen(port, () => {
    console.log(`Serverless Web MCP Server listening on port ${port}`);
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
    console.log(`Health check: http://localhost:${port}/health`);
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
