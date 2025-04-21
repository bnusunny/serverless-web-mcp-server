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

// Set initial log level based on DEBUG environment variable
let currentLogLevel = process.env.DEBUG === 'true' ? 'debug' : 'info';

// Define structured JSON format for file logs
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create file transport
const fileTransport = new winston.transports.File({ 
  filename: LOG_FILE,
  format: structuredFormat,
  level: currentLogLevel
});

// Create logger with file transport using structured format
const logger = winston.createLogger({
  level: currentLogLevel,
  format: structuredFormat,
  defaultMeta: { 
    transport: process.env.MCP_TRANSPORT || 'stdio',
    pid: process.pid,
    hostname: os.hostname()
  },
  transports: [
    // Write to log file (always enabled)
    fileTransport
  ]
});

// Create console transport for HTTP mode
let consoleTransport: winston.transport | null = null;
if (process.env.MCP_TRANSPORT === 'http') {
  consoleTransport = new winston.transports.Console({
    level: currentLogLevel,
    format: winston.format.combine(
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
    )
  });
  logger.add(consoleTransport);
} 

// Create stderr transport for stdio mode
let stderrTransport: winston.transport | null = null;
if (process.env.MCP_TRANSPORT !== 'http') {
  stderrTransport = new winston.transports.Stream({
    stream: process.stderr,
    level: currentLogLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf((info: any) => {
        const { timestamp, level, message, ...rest } = info;
        // Only include metadata if it exists and isn't empty
        const meta = Object.keys(rest).length && 
                    !(Object.keys(rest).length === 1 && Object.keys(rest)[0] === 'splat') 
                    ? ` ${JSON.stringify(rest)}` : '';
        return `${timestamp} ${level}: ${message}${meta}`;
      })
    )
  });
  logger.add(stderrTransport);
}

// Log the current log level to help with debugging
console.error(`Logger initialized with level: ${currentLogLevel}`);

/**
 * Set the log level for all transports
 * @param level The new log level ('debug', 'info', 'warn', 'error')
 */
function setLogLevel(level: string): void {
  currentLogLevel = level;
  
  // Update logger level
  logger.level = level;
  
  // Update all transports
  fileTransport.level = level;
  
  if (consoleTransport) {
    consoleTransport.level = level;
  }
  
  if (stderrTransport) {
    stderrTransport.level = level;
  }
  
  console.error(`Logger level changed to: ${level}`);
}

// Add methods to the logger object
(logger as any).getLogFilePath = () => LOG_FILE;
(logger as any).setLogLevel = setLogLevel;

// Export logger
export { logger };
