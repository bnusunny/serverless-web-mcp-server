#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import express from "express";
import { registerDeploymentTools } from "./mcp/tools.js";
import { registerDeploymentResources } from "./mcp/resources.js";
import { loadConfig } from "./config.js";

// Debug logging flag
let DEBUG = false;

/**
 * Debug logger function that only logs when debug mode is enabled
 */
function debugLog(...args: any[]) {
  if (DEBUG) {
    console.error('[DEBUG]', ...args);
  }
}

/**
 * Print information about available tools and resources
 */
function printServerInfo(server: McpServer) {
  // Since we can't directly access server properties due to TypeScript limitations,
  // we'll print what we know about the server
  console.error('\n=== Serverless Web MCP Server Info ===');
  console.error('Name: serverless-web-mcp-server');
  console.error('Version: 1.0.0');
  
  // Print available tools
  console.error('\nAvailable Tools:');
  console.error('- deploy: Deploy web applications to AWS serverless infrastructure');
  console.error('- configure-domain: Set up custom domains and SSL certificates for deployed applications');
  console.error('- provision-database: Create and configure database resources for applications');
  console.error('- get-logs: Retrieve application logs from CloudWatch');
  console.error('- get-metrics: Fetch performance metrics for deployed applications');
  
  // Print available resources
  console.error('\nAvailable Resources:');
  console.error('- deployment: Information about deployed applications (deployment:project-name)');
  console.error('- template: Information about available deployment templates (template:list, template:name)');
  console.error('- resources: Information about AWS resources for deployed applications (resources:project-name, resources:list)');
  
  console.error('\n=======================================\n');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--debug' || arg === '-d') {
      DEBUG = true;
      console.error('[DEBUG] Debug mode enabled');
    } else if (arg === '--templates' || arg === '-t') {
      // Get the next argument as the templates path
      if (i + 1 < args.length) {
        process.env.TEMPLATES_PATH = args[i + 1];
        i++; // Skip the next argument
        console.error(`[INFO] Using templates from: ${process.env.TEMPLATES_PATH}`);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.error(`
Serverless Web MCP Server

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
  }
}

/**
 * Main entry point for the MCP server
 */
async function main() {
  try {
    // Parse command line arguments
    parseArgs();
    
    // Load configuration
    const config = loadConfig();
    debugLog('Loaded configuration:', config);
    
    // Create MCP server instance
    const server = new McpServer({
      name: "serverless-web-mcp-server",
      version: "1.0.0",
      capabilities: {
        resources: {},
        tools: {},
      },
    });
    
    debugLog('Created MCP server instance');

    // Register deployment tools and resources
    registerDeploymentTools(server);
    registerDeploymentResources(server);
    
    debugLog('Registered tools and resources');
    
    // Print server information
    printServerInfo(server);

    // Determine transport method based on environment
    // Default to stdio for local MCP server integration with LLM clients
    if (!process.env.MCP_TRANSPORT || process.env.MCP_TRANSPORT === "stdio") {
      debugLog('Using stdio transport');
      
      // Use stdio transport for direct integration with LLM clients
      const transport = new StdioServerTransport();
      
      // Connect to the transport
      await server.connect(transport);
      
      // Log to stderr so it doesn't interfere with the stdio transport
      console.error("Serverless Web MCP Server running on stdio transport");
    } else if (process.env.MCP_TRANSPORT === "http") {
      debugLog('Using HTTP transport');
      
      // Use HTTP transport for web-based integration
      const app = express();
      const port = config.port || 3000;
      
      // Set up HTTP transport with SSE
      // Temporarily disabled due to import issues
      // const transport = new HttpServerTransport({
      //   path: "/mcp",
      //   cors: true,
      // });
      
      // Connect transport to express app
      // transport.attach(app);
      // await server.connect(transport);
      
      // Start HTTP server
      app.listen(port, () => {
        console.log(`Serverless Web MCP Server running at http://localhost:${port}/mcp`);
      });
      
      console.log("HTTP transport is temporarily disabled due to import issues");
    } else {
      throw new Error(`Unsupported transport type: ${process.env.MCP_TRANSPORT}`);
    }
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

// Start the server
main();
