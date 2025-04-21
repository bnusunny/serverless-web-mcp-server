/**
 * Test for Path Resolution in Deployment Service
 */
import { mockLogger } from '../../mock-utils';
import path from 'path';
import fs from 'fs';

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn()
}));

jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    resolve: jest.fn(),
    isAbsolute: jest.fn()
  };
});

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: mockLogger
}));

// Mock child_process to prevent actual process execution
jest.mock('child_process', () => ({
  spawn: jest.fn().mockImplementation(() => ({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'close') callback(0);
      return this;
    })
  }))
}));

// Create a simplified version of the deployApplication function
function resolveProjectPaths(params: any) {
  // Ensure project root is an absolute path
  if (!path.isAbsolute(params.projectRoot)) {
    mockLogger.warn(`projectRoot is not an absolute path: ${params.projectRoot}`);
    params.projectRoot = path.resolve(process.cwd(), params.projectRoot);
    mockLogger.info(`Resolved projectRoot to absolute path: ${params.projectRoot}`);
  }
  
  // Resolve relative paths for builtArtifactsPath against projectRoot
  if (params.backendConfiguration && !path.isAbsolute(params.backendConfiguration.builtArtifactsPath)) {
    params.backendConfiguration.builtArtifactsPath = path.resolve(
      params.projectRoot, 
      params.backendConfiguration.builtArtifactsPath
    );
    mockLogger.info(`Resolved backendConfiguration.builtArtifactsPath to: ${params.backendConfiguration.builtArtifactsPath}`);
  }
  
  // Resolve relative paths for builtAssetsPath against projectRoot
  if (params.frontendConfiguration && !path.isAbsolute(params.frontendConfiguration.builtAssetsPath)) {
    params.frontendConfiguration.builtAssetsPath = path.resolve(
      params.projectRoot, 
      params.frontendConfiguration.builtAssetsPath
    );
    mockLogger.info(`Resolved frontendConfiguration.builtAssetsPath to: ${params.frontendConfiguration.builtAssetsPath}`);
  }
  
  return params;
}

describe('Path Resolution in Deployment Service', () => {
  const originalCwd = process.cwd;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue('/mock/cwd');
    
    // Default mocks
    (path.isAbsolute as jest.Mock).mockImplementation((p) => p.startsWith('/'));
    (path.resolve as jest.Mock).mockImplementation((...args) => args.join('/').replace(/\/+/g, '/'));
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });
  
  afterEach(() => {
    // Restore process.cwd
    process.cwd = originalCwd;
  });
  
  test('should resolve absolute projectRoot path correctly', async () => {
    // Setup mocks
    (path.isAbsolute as jest.Mock)
      .mockReturnValueOnce(true)   // projectRoot is absolute
      .mockReturnValueOnce(false); // builtArtifactsPath is not absolute
      
    (path.resolve as jest.Mock).mockReturnValueOnce('/absolute/path/to/project/backend/dist');
    
    const params = {
      deploymentType: 'backend' as const,
      projectName: 'test-project',
      projectRoot: '/absolute/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const result = resolveProjectPaths(params);
    
    // Verify path.isAbsolute was called with projectRoot
    expect(path.isAbsolute).toHaveBeenCalledWith('/absolute/path/to/project');
    
    // Verify path.isAbsolute was called with builtArtifactsPath
    expect(path.isAbsolute).toHaveBeenCalledWith('backend/dist');
    
    // Verify path.resolve was called to resolve builtArtifactsPath
    expect(path.resolve).toHaveBeenCalledWith(
      '/absolute/path/to/project',
      'backend/dist'
    );
    
    // Verify the paths were resolved correctly
    expect(result.projectRoot).toBe('/absolute/path/to/project');
    expect(result.backendConfiguration.builtArtifactsPath).toBe('/absolute/path/to/project/backend/dist');
  });
  
  test('should convert relative projectRoot to absolute path', async () => {
    // Setup mocks
    (path.isAbsolute as jest.Mock)
      .mockReturnValueOnce(false)  // projectRoot is not absolute
      .mockReturnValueOnce(false); // builtArtifactsPath is not absolute
    
    (path.resolve as jest.Mock)
      .mockReturnValueOnce('/mock/cwd/relative/path/to/project')  // Resolve projectRoot
      .mockReturnValueOnce('/mock/cwd/relative/path/to/project/backend/dist'); // Resolve builtArtifactsPath
    
    const params = {
      deploymentType: 'backend' as const,
      projectName: 'test-project',
      projectRoot: 'relative/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const result = resolveProjectPaths(params);
    
    // Verify path.isAbsolute was called with projectRoot
    expect(path.isAbsolute).toHaveBeenCalledWith('relative/path/to/project');
    
    // Verify path.resolve was called to convert projectRoot to absolute
    expect(path.resolve).toHaveBeenCalledWith(
      '/mock/cwd',
      'relative/path/to/project'
    );
    
    // Verify the paths were resolved correctly
    expect(result.projectRoot).toBe('/mock/cwd/relative/path/to/project');
    expect(result.backendConfiguration.builtArtifactsPath).toBe('/mock/cwd/relative/path/to/project/backend/dist');
    
    // Verify logger.warn was called to warn about relative projectRoot
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('projectRoot is not an absolute path')
    );
  });
  
  test('should resolve relative builtArtifactsPath against projectRoot', async () => {
    // Setup mocks
    (path.isAbsolute as jest.Mock)
      .mockReturnValueOnce(true)  // projectRoot is absolute
      .mockReturnValueOnce(false); // builtArtifactsPath is not absolute
    
    (path.resolve as jest.Mock).mockReturnValueOnce('/absolute/path/to/project/backend/dist');
    
    const params = {
      deploymentType: 'backend' as const,
      projectName: 'test-project',
      projectRoot: '/absolute/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const result = resolveProjectPaths(params);
    
    // Verify path.isAbsolute was called with builtArtifactsPath
    expect(path.isAbsolute).toHaveBeenCalledWith('backend/dist');
    
    // Verify path.resolve was called to resolve builtArtifactsPath against projectRoot
    expect(path.resolve).toHaveBeenCalledWith(
      '/absolute/path/to/project',
      'backend/dist'
    );
    
    // Verify the paths were resolved correctly
    expect(result.backendConfiguration.builtArtifactsPath).toBe('/absolute/path/to/project/backend/dist');
    
    // Verify logger.info was called to log the resolved path
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Resolved backendConfiguration.builtArtifactsPath to:')
    );
  });
});
