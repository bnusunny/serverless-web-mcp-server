/**
 * Process Mocks Helper
 * 
 * Provides utilities for mocking child processes in tests
 */

import { EventEmitter } from 'events';

/**
 * Create a mock child process with configurable behavior
 * @param options Additional options to merge into the mock
 * @returns A mock child process object with helper methods
 */
export function createMockChildProcess(options = {}) {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const childProcess = new EventEmitter();
  
  return {
    stdout,
    stderr,
    ...childProcess,
    // Helper to simulate process completion with success
    simulateSuccess: (output = 'Success') => {
      stdout.emit('data', output);
      childProcess.emit('close', 0);
    },
    // Helper to simulate process failure
    simulateError: (error = 'Error') => {
      stderr.emit('data', error);
      childProcess.emit('close', 1);
    },
    ...options
  };
}
