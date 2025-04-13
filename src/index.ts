#!/usr/bin/env node

import { createMcpServer, startStdioServer, startHttpServer } from "./mcp/server.js";
import minimist from "minimist";
import fs from "fs";

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ["templates", "transport", "port"],
  boolean: ["debug", "help"],
  alias: {
    d: "debug",
    t: "templates",
    h: "help",
    m: "transport",
    p: "port"
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
  --transport, -m <mode>      Transport method (stdio or http, default: stdio)
  --port, -p <number>         HTTP server port (default: 3000, only used with http transport)
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

// Set transport method from command line, environment variable, or default
const transport = argv.transport || process.env.MCP_TRANSPORT || "stdio";

// Validate transport method
if (transport !== "stdio" && transport !== "http") {
  console.error(`Invalid transport method: ${transport}`);
  console.error("Transport method must be either 'stdio' or 'http'");
  process.exit(1);
}

// Create MCP server
const server = createMcpServer();

// Start the server with the appropriate transport
if (transport === "http") {
  // HTTP transport with SSE
  const port = parseInt(argv.port || process.env.PORT || "3000", 10);
  
  // Validate port number
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Invalid port number: ${argv.port}`);
    console.error("Port must be a number between 1 and 65535");
    process.exit(1);
  }
  
  console.log(`Starting server with HTTP transport on port ${port}`);
  startHttpServer(server, port).catch(error => {
    console.error("Error starting HTTP server:", error);
    process.exit(1);
  });
} else {
  // Stdio transport - this is the mode that Claude for Desktop uses
  console.log("Starting server with stdio transport");
  startStdioServer(server).catch(error => {
    console.error("Error starting stdio server:", error);
    process.exit(1);
  });
}
