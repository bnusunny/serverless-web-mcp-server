/**
 * Test for Process Utils
 */
import { executeCommand } from '../../../src/utils/process';
import child_process from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn()
}));

describe('Process Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('executeCommand', () => {
    test('should execute command successfully', async () => {
      // Create mock child process
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: jest.fn()
      };
      
      (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);
      
      // Start the command execution
      const promise = executeCommand('echo', ['hello'], { cwd: '/test' });
      
      // Simulate successful command execution
      mockProcess.stdout.emit('data', 'hello world');
      mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      
      const result = await promise;
      
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('hello world');
      expect(result.stderr).toBe('');
      expect(child_process.spawn).toHaveBeenCalledWith('echo', ['hello'], { cwd: '/test' });
    });
    
    test('should handle command failure', async () => {
      // Create mock child process
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: jest.fn()
      };
      
      (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);
      
      // Start the command execution
      const promise = executeCommand('invalid-command', [], {});
      
      // Simulate command failure
      mockProcess.stderr.emit('data', 'command not found');
      mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1](1);
      
      const result = await promise;
      
      expect(result.success).toBe(false);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('command not found');
      expect(result.error).toBeDefined();
    });
    
    test('should handle both stdout and stderr output', async () => {
      // Create mock child process
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: jest.fn()
      };
      
      (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);
      
      // Start the command execution
      const promise = executeCommand('mixed-output', [], {});
      
      // Simulate mixed output
      mockProcess.stdout.emit('data', 'standard output');
      mockProcess.stderr.emit('data', 'error output');
      mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      
      const result = await promise;
      
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('standard output');
      expect(result.stderr).toBe('error output');
    });
    
    test('should handle multiple data events', async () => {
      // Create mock child process
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: jest.fn()
      };
      
      (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);
      
      // Start the command execution
      const promise = executeCommand('multi-output', [], {});
      
      // Simulate multiple output events
      mockProcess.stdout.emit('data', 'first ');
      mockProcess.stdout.emit('data', 'second ');
      mockProcess.stdout.emit('data', 'third');
      mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      
      const result = await promise;
      
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('first second third');
    });
    
    test('should handle spawn errors', async () => {
      // Mock spawn to throw an error
      (child_process.spawn as jest.Mock).mockImplementation(() => {
        throw new Error('Spawn error');
      });
      
      const result = await executeCommand('error-command', [], {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Spawn error');
    });
  });
});
