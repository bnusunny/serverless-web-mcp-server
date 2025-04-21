/**
 * Test for Logger
 */

import { logger } from '../../../src/utils/logger';
import winston from 'winston';

// Mock winston
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn().mockReturnThis(),
    timestamp: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    colorize: jest.fn().mockReturnThis(),
    printf: jest.fn().mockReturnThis()
  };
  
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    add: jest.fn()
  };
  
  return {
    format: mockFormat,
    createLogger: jest.fn().mockReturnValue(mockLogger),
    transports: {
      File: jest.fn(),
      Console: jest.fn()
    }
  };
});

// Mock fs and path
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/mock/path/to/log')
}));

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should create a logger with file transport', () => {
    // Re-import to trigger the module code
    jest.resetModules();
    const { logger } = require('../../../src/utils/logger');
    
    expect(winston.createLogger).toHaveBeenCalled();
    expect(winston.transports.File).toHaveBeenCalled();
  });
  
  test('should set debug level when DEBUG=true', () => {
    // Set DEBUG environment variable
    process.env.DEBUG = 'true';
    
    // Re-import to trigger the module code
    jest.resetModules();
    const { logger } = require('../../../src/utils/logger');
    
    expect(winston.createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug'
      })
    );
    
    // Clean up
    delete process.env.DEBUG;
  });
  
  test('should add console transport for HTTP mode', () => {
    // Set MCP_TRANSPORT environment variable
    process.env.MCP_TRANSPORT = 'http';
    
    // Re-import to trigger the module code
    jest.resetModules();
    const { logger } = require('../../../src/utils/logger');
    
    expect(winston.transports.Console).toHaveBeenCalled();
    expect(logger.add).toHaveBeenCalled();
    
    // Clean up
    delete process.env.MCP_TRANSPORT;
  });
  
  test('should not add console transport for stdio mode', () => {
    // Set MCP_TRANSPORT environment variable
    process.env.MCP_TRANSPORT = 'stdio';
    
    // Re-import to trigger the module code
    jest.resetModules();
    const { logger } = require('../../../src/utils/logger');
    
    expect(winston.transports.Console).not.toHaveBeenCalled();
    expect(logger.add).not.toHaveBeenCalled();
    
    // Clean up
    delete process.env.MCP_TRANSPORT;
  });
  
  test('should create log directory if it does not exist', () => {
    const fs = require('fs');
    fs.existsSync.mockReturnValueOnce(false);
    
    // Re-import to trigger the module code
    jest.resetModules();
    const { logger } = require('../../../src/utils/logger');
    
    expect(fs.mkdirSync).toHaveBeenCalled();
  });
});
