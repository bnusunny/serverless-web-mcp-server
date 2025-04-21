#!/usr/bin/env node

/**
 * Serverless Web MCP Server
 * 
 * Main entry point for the MCP server that enables LLM coding agents
 * to deploy web applications to AWS serverless infrastructure.
 */

import { parseCliOptions, printHelp } from './cli/cli-options.js';
import { startStdioServer } from './mcp/server.js';
import { logger } from './utils/logger.js';
import tools from './mcp/tools/index.js';
import resources from './mcp/resources/index.js';

// Export tools and resources for external use
export { tools, resources };

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
    
    // Set debug mode if requested
    if (options.debug) {
      // Set the log level to debug using the new method
      (logger as any).setLogLevel('debug');
      
      // Log that debug mode is enabled
      logger.info('Debug mode enabled');
      
      // Test debug logging
      logger.debug('This is a debug message to verify debug logging is working');
    }
    
    if (options.templates) {
      process.env.TEMPLATES_PATH = options.templates;
      logger.info(`Templates path set to: ${options.templates}`);
    }
    
    // Log startup information
    logger.info('Starting Serverless Web MCP Server');
    logger.debug('Debug logging is active');
    logger.info(`Node.js version: ${process.version}`);
    logger.info(`Platform: ${process.platform}`);
    logger.info(`Current working directory: ${process.cwd()}`);
    logger.info(`User home directory: ${process.env.HOME}`);
    
    // Start the MCP server with stdio transport
    await startStdioServer();
    
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
