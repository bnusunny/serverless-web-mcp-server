import fs from 'fs';
import path from 'path';
import os from 'os';

// Determine if we're in stdio transport mode
const isStdioTransport = process.env.MCP_TRANSPORT === 'stdio' || 
                         !process.env.MCP_TRANSPORT;

// Create a log directory in the temp directory
const LOG_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-logs');
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (error) {
    // If we can't create the log directory, we'll fall back to no logging
  }
}

// Create a log file with timestamp
const LOG_FILE = path.join(LOG_DIR, `mcp-server-${new Date().toISOString().replace(/[:.]/g, '-')}.json.log`);

// Queue for log messages to avoid file system contention
const logQueue: string[] = [];
let isProcessingQueue = false;

/**
 * Process the log queue asynchronously
 */
async function processLogQueue() {
  if (isProcessingQueue || logQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  try {
    // Take all current messages from the queue
    const messages = [...logQueue];
    logQueue.length = 0;
    
    // Write all messages at once, one JSON object per line (NDJSON format)
    await fs.promises.appendFile(LOG_FILE, messages.join('\n') + '\n');
  } catch (error) {
    // If we can't write to the log file, there's not much we can do
    // We don't want to use console.log here as it might interfere with stdio transport
  } finally {
    isProcessingQueue = false;
    
    // If more messages were added while processing, process them too
    if (logQueue.length > 0) {
      processLogQueue();
    }
  }
}

/**
 * Add a message to the log queue and trigger processing
 */
function queueLogMessage(logObject: object) {
  logQueue.push(JSON.stringify(logObject));
  processLogQueue();
}

/**
 * Format error objects for JSON serialization
 */
function formatError(error: Error): object {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
}

/**
 * Process arguments for structured logging
 */
function processArgs(args: any[]): object {
  if (args.length === 0) {
    return {};
  }
  
  // If there's only one argument, use it directly
  if (args.length === 1) {
    const arg = args[0];
    
    // Special handling for Error objects
    if (arg instanceof Error) {
      return formatError(arg);
    }
    
    return arg;
  }
  
  // For multiple arguments, process each one
  return args.map(arg => {
    if (arg instanceof Error) {
      return formatError(arg);
    }
    return arg;
  });
}

/**
 * Create a structured log entry
 */
function createLogEntry(level: string, message: string, args: any[]): object {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: processArgs(args),
    context: {
      transport: isStdioTransport ? 'stdio' : 'http',
      pid: process.pid,
      hostname: os.hostname()
    }
  };
}

/**
 * Safe logger that doesn't interfere with stdio transport
 */
export const logger = {
  /**
   * Log info message
   */
  info: (message: string, ...args: any[]) => {
    const logObject = createLogEntry('INFO', message, args);
    
    // Always write to log file
    queueLogMessage(logObject);
    
    // Only write to console in HTTP mode
    if (!isStdioTransport) {
      console.log(message, ...args);
    }
  },

  /**
   * Log error message
   */
  error: (message: string, ...args: any[]) => {
    const logObject = createLogEntry('ERROR', message, args);
    
    // Always write to log file
    queueLogMessage(logObject);
    
    // Only write to console in HTTP mode
    if (!isStdioTransport) {
      console.error(message, ...args);
    }
  },

  /**
   * Log warning message
   */
  warn: (message: string, ...args: any[]) => {
    const logObject = createLogEntry('WARN', message, args);
    
    // Always write to log file
    queueLogMessage(logObject);
    
    // Only write to console in HTTP mode
    if (!isStdioTransport) {
      console.warn(message, ...args);
    }
  },

  /**
   * Log debug message (only if DEBUG env var is set)
   */
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      const logObject = createLogEntry('DEBUG', message, args);
      
      // Always write to log file
      queueLogMessage(logObject);
      
      // Only write to console in HTTP mode
      if (!isStdioTransport) {
        console.debug(message, ...args);
      }
    }
  },
  
  /**
   * Get the path to the current log file
   */
  getLogFilePath: () => LOG_FILE
};
