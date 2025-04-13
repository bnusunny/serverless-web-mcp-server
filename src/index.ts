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
      // Get the handle method from the server
      const handleMethod = (server as any).handle || (server as any).handleRequest;
      
      if (typeof handleMethod !== 'function') {
        console.error("Error: MCP server does not have a handle or handleRequest method");
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Internal server error: MCP server implementation error"
          },
          id: req.body.id || null
        });
        return;
      }
      
      const response = await handleMethod.call(server, req.body);
      res.json(response);
    } catch (error) {
      console.error("Error handling request:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Internal server error"
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
  
  // Create the StdioServerTransport
  const stdioTransport = new StdioServerTransport();
  
  // Set up message handler
  stdioTransport.onmessage = async (message) => {
    try {
      // Get the handle method from the server
      const handleMethod = (server as any).handle || (server as any).handleRequest;
      
      if (typeof handleMethod !== 'function') {
        console.error("Error: MCP server does not have a handle or handleRequest method");
        await stdioTransport.send({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Internal server error: MCP server implementation error"
          },
          id: (message as any).id || null
        });
        return;
      }
      
      // Process the request
      const response = await handleMethod.call(server, message);
      await stdioTransport.send(response);
    } catch (error) {
      console.error("Error handling request:", error);
      await stdioTransport.send({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Internal server error"
        },
        id: (message as any).id || null
      });
    }
  };
  
  // Set up error handler
  stdioTransport.onerror = (error) => {
    console.error("Transport error:", error);
  };
  
  // Set up close handler
  stdioTransport.onclose = () => {
    console.log("Transport closed. Exiting.");
    process.exit(0);
  };
  
  // Start the transport
  stdioTransport.start().catch(error => {
    console.error("Failed to start transport:", error);
    process.exit(1);
  });
  
  // Handle process termination
  process.on('SIGINT', async () => {
    console.log("Received SIGINT. Exiting.");
    await stdioTransport.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log("Received SIGTERM. Exiting.");
    await stdioTransport.close();
    process.exit(0);
  });
}
