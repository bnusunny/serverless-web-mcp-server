// test/helpers/setup.js
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(30000);

// Silence console logs during tests unless DEBUG is enabled
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: console.error // Keep error logging
  };
}
