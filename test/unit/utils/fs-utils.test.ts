/**
 * Test for FS Utils
 */
import { copyDirectory, ensureDirectoryExists, isExecutable } from '../../../src/utils/fs-utils';
import fs from 'fs';
import path from 'path';

// Mock fs and path modules
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  copyFileSync: jest.fn(),
  accessSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(p => p.split('/').slice(0, -1).join('/'))
}));

describe('FS Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('copyDirectory', () => {
    test('should copy directory recursively', () => {
      // Mock fs.existsSync to return true for source and false for destination
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        if (path === '/source') {
          return true;
        }
        return false;
      });
      
      // Mock fs.statSync to indicate directories and files
      (fs.statSync as jest.Mock).mockImplementation((path) => {
        if (path === '/source' || path === '/source/subdir') {
          return {
            isDirectory: () => true,
            isFile: () => false
          };
        }
        return {
          isDirectory: () => false,
          isFile: () => true
        };
      });
      
      // Mock fs.readdirSync to return directory contents
      (fs.readdirSync as jest.Mock).mockImplementation((dir) => {
        if (dir === '/source') {
          return ['file1.txt', 'file2.txt', 'subdir'];
        }
        if (dir === '/source/subdir') {
          return ['file3.txt'];
        }
        return [];
      });
      
      copyDirectory('/source', '/destination');
      
      // Verify destination directory was created
      expect(fs.mkdirSync).toHaveBeenCalledWith('/destination', { recursive: true });
      
      // Verify subdirectory was created
      expect(fs.mkdirSync).toHaveBeenCalledWith('/destination/subdir', { recursive: true });
      
      // Verify files were copied
      expect(fs.copyFileSync).toHaveBeenCalledWith('/source/file1.txt', '/destination/file1.txt');
      expect(fs.copyFileSync).toHaveBeenCalledWith('/source/file2.txt', '/destination/file2.txt');
      expect(fs.copyFileSync).toHaveBeenCalledWith('/source/subdir/file3.txt', '/destination/subdir/file3.txt');
    });
    
    test('should throw error if source directory does not exist', () => {
      // Mock fs.existsSync to return false for source
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      expect(() => copyDirectory('/source', '/destination')).toThrow('Source directory does not exist');
    });
  });
  
  describe('ensureDirectoryExists', () => {
    test('should create directory if it does not exist', () => {
      // Mock fs.existsSync to return false
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      ensureDirectoryExists('/path/to/directory');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to/directory', { recursive: true });
    });
    
    test('should not create directory if it already exists', () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      ensureDirectoryExists('/path/to/directory');
      
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
    
    test('should create parent directory for file path', () => {
      // Mock fs.existsSync to return false
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      ensureDirectoryExists('/path/to/file.txt', true);
      
      expect(path.dirname).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to', { recursive: true });
    });
  });
  
  describe('isExecutable', () => {
    test('should return true for executable file', () => {
      // Mock fs.statSync to return file with executable permissions
      (fs.statSync as jest.Mock).mockReturnValue({
        mode: 0o755 // rwxr-xr-x
      });
      
      const result = isExecutable('/path/to/executable');
      
      expect(result).toBe(true);
    });
    
    test('should return false for non-executable file', () => {
      // Mock fs.statSync to return file without executable permissions
      (fs.statSync as jest.Mock).mockReturnValue({
        mode: 0o644 // rw-r--r--
      });
      
      const result = isExecutable('/path/to/file');
      
      expect(result).toBe(false);
    });
    
    test('should handle errors and return false', () => {
      // Mock fs.statSync to throw an error
      (fs.statSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const result = isExecutable('/path/to/nonexistent');
      
      expect(result).toBe(false);
    });
  });
});
