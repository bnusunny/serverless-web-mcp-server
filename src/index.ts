#!/usr/bin/env node

/**
 * Serverless Web MCP Server
 * 
 * Main entry point for the MCP server that enables LLM coding agents
 * to deploy web applications to AWS serverless infrastructure.
 */

import { parseCliOptions, printHelp } from './cli/cli-options.js';
import { startServer } from './mcp/server.js';
import { logger } from './utils/logger.js';

/**
 * Main function to start the MCP server
 */
async function main() {
  try {
    // Parse command line options
    const options = parseCliOptions();
    
    // Show help and exit if requested
    if (options.help) {
      printHelp();
      process.exit(0);
    }
    
    // Set environment variables based on CLI options
    if (options.debug) {
      process.env.DEBUG = 'true';
      logger.info('Debug mode enabled');
    }
    
    if (options.templates) {
      process.env.TEMPLATES_PATH = options.templates;
      logger.info(`Templates path set to: ${options.templates}`);
    }
    
    if (options.transport) {
      process.env.MCP_TRANSPORT = options.transport;
      logger.info(`Transport mode set to: ${options.transport}`);
    }
    
    if (options.port) {
      process.env.PORT = options.port;
      logger.info(`HTTP port set to: ${options.port}`);
    }
    
    // Log startup information
    logger.info('Starting Serverless Web MCP Server');
    logger.info(`Node.js version: ${process.version}`);
    logger.info(`Platform: ${process.platform}`);
    
    // Start the MCP server
    await startServer();
    
  } catch (error) {
    // Log any errors that occur during startup
    logger.error('Failed to start MCP server', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  logger.error('Unhandled exception', error);
  process.exit(1);
});
