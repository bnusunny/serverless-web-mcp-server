import { parseArgs } from 'node:util';
import { logger } from '../utils/logger.js';

interface CliOptions {
  debug?: boolean;
  templates?: string;
  transport?: string;
  port?: string;
  help?: boolean;
}

/**
 * Parse command line arguments
 */
export function parseCliOptions(): CliOptions {
  try {
    const { values } = parseArgs({
      options: {
        debug: { type: 'boolean', short: 'd' },
        templates: { type: 'string', short: 't' },
        transport: { type: 'string', short: 'm' },
        port: { type: 'string', short: 'p' },
        help: { type: 'boolean', short: 'h' }
      },
      allowPositionals: true
    });
    
    return values as CliOptions;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error parsing command line arguments: ${errorMessage}`);
    return {};
  }
}

/**
 * Print help message
 */
export function printHelp(): void {
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
}
