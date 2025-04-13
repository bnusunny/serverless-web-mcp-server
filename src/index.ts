#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
  const app = express();
  const port = process.env.PORT || 3000;
  
  // Set up the HTTP endpoint
  app.use("/mcp", express.json(), (req, res) => {
    // Use any available method to handle the request
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
    
    handleMethod.call(server, req.body).then((response: any) => {
      res.json(response);
    }).catch((error: any) => {
      console.error("Error handling request:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Internal server error"
        },
        id: req.body.id || null
      });
    });
  });
  
  app.listen(port, () => {
    console.log(`Serverless Web MCP Server listening on port ${port}`);
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
  });
} else {
  // Use stdio transport - this is the mode that Roo Code uses
  console.log("Serverless Web MCP Server started in stdio mode");
  
  // For Roo Code compatibility, we need to listen for complete JSON objects
  let buffer = "";
  
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    
    try {
      // Try to parse the buffer as JSON
      const request = JSON.parse(buffer);
      buffer = ""; // Clear buffer on successful parse
      
      // Use any available method to handle the request
      const handleMethod = (server as any).handle || (server as any).handleRequest;
      
      if (typeof handleMethod !== 'function') {
        console.error("Error: MCP server does not have a handle or handleRequest method");
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Internal server error: MCP server implementation error"
          },
          id: request.id || null
        }) + "\n");
        return;
      }
      
      // Process the request
      handleMethod.call(server, request)
        .then((response: any) => {
          process.stdout.write(JSON.stringify(response) + "\n");
        })
        .catch((error: any) => {
          console.error("Error handling request:", error);
          process.stdout.write(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Internal server error"
            },
            id: request.id || null
          }) + "\n");
        });
    } catch (e) {
      // If we can't parse the buffer as JSON yet, just wait for more data
      if (!(e instanceof SyntaxError)) {
        console.error("Unexpected error:", e);
      }
    }
  });
  
  process.stdin.on('end', () => {
    process.exit(0);
  });
}
