/**
 * Jest setup file
 * 
 * This file is executed before each test file.
 */

// Silence console output during tests
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console methods to silence output during tests
  console.debug = jest.fn();
  console.info = jest.fn();
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

// Mock process.env for consistent test environment
process.env.NODE_ENV = 'test';
