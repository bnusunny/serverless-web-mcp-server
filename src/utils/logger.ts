/**
 * Logger utility for the MCP server
 */

import winston from 'winston';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Define log directory
const LOG_DIR = process.env.LOG_DIR || path.join(os.tmpdir(), 'serverless-web-mcp-logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Define log file path
const LOG_FILE = path.join(LOG_DIR, 'serverless-web-mcp.log');

// Define structured JSON format for file logs
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Define human-readable format for console logs
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info: any) => {
    const { timestamp, level, message, ...rest } = info;
    // Only include metadata if it exists and isn't empty
    const meta = Object.keys(rest).length && 
                 !(Object.keys(rest).length === 1 && Object.keys(rest)[0] === 'splat') 
                 ? ` ${JSON.stringify(rest)}` : '';
    return `${timestamp} ${level}: ${message}${meta}`;
  })
);

// Create logger with file transport using structured format
const logger = winston.createLogger({
  level: process.env.DEBUG ? 'debug' : 'info',
  format: structuredFormat,
  defaultMeta: { 
    transport: process.env.MCP_TRANSPORT || 'stdio',
    pid: process.pid,
    hostname: os.hostname()
  },
  transports: [
    // Write to log file (always enabled)
    new winston.transports.File({ 
      filename: LOG_FILE,
      format: structuredFormat
    })
  ]
});

// Only add console transport for HTTP mode to avoid interfering with stdio transport
if (process.env.MCP_TRANSPORT === 'http') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Add method to get log file path
(logger as any).getLogFilePath = () => LOG_FILE;

// Export logger
export { logger };
