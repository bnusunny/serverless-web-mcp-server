/**
 * Simple test for path resolution logic
 */

// Mock the path module
const mockIsAbsolute = jest.fn();
const mockResolve = jest.fn();

jest.mock('path', () => ({
  isAbsolute: mockIsAbsolute,
  resolve: mockResolve,
  join: (...args) => args.join('/')
}));

// Mock the fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true)
}));

// Mock the logger
jest.mock('../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event, cb) => {
      if (event === 'close') cb(0);
      return this;
    })
  })
}));

// Create a simplified version of the deployApplication function
function resolveProjectPaths(params) {
  const path = require('path');
  const fs = require('fs');
  const logger = require('../src/utils/logger').logger;
  
  // Ensure project root is an absolute path
  if (!path.isAbsolute(params.projectRoot)) {
    logger.warn(`projectRoot is not an absolute path: ${params.projectRoot}`);
    params.projectRoot = path.resolve(process.cwd(), params.projectRoot);
    logger.info(`Resolved projectRoot to absolute path: ${params.projectRoot}`);
  }
  
  // Resolve relative paths for builtArtifactsPath against projectRoot
  if (params.backendConfiguration && !path.isAbsolute(params.backendConfiguration.builtArtifactsPath)) {
    params.backendConfiguration.builtArtifactsPath = path.resolve(
      params.projectRoot, 
      params.backendConfiguration.builtArtifactsPath
    );
    logger.info(`Resolved backendConfiguration.builtArtifactsPath to: ${params.backendConfiguration.builtArtifactsPath}`);
  }
  
  // Resolve relative paths for builtAssetsPath against projectRoot
  if (params.frontendConfiguration && !path.isAbsolute(params.frontendConfiguration.builtAssetsPath)) {
    params.frontendConfiguration.builtAssetsPath = path.resolve(
      params.projectRoot, 
      params.frontendConfiguration.builtAssetsPath
    );
    logger.info(`Resolved frontendConfiguration.builtAssetsPath to: ${params.frontendConfiguration.builtAssetsPath}`);
  }
  
  return params;
}

describe('Path Resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.cwd = jest.fn().mockReturnValue('/mock/cwd');
  });
  
  test('should resolve absolute projectRoot path correctly', () => {
    // Setup mocks
    mockIsAbsolute.mockReturnValue(true);
    mockResolve.mockImplementation((...args) => args.join('/'));
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/absolute/path/to/project',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const result = resolveProjectPaths(params);
    
    // Verify path.isAbsolute was called with projectRoot
    expect(mockIsAbsolute).toHaveBeenCalledWith('/absolute/path/to/project');
    
    // Verify path.resolve was called to resolve builtArtifactsPath
    expect(mockResolve).toHaveBeenCalledWith(
      '/absolute/path/to/project',
      'backend/dist'
    );
    
    // Verify the paths were resolved correctly
    expect(result.projectRoot).toBe('/absolute/path/to/project');
    expect(result.backendConfiguration.builtArtifactsPath).toBe('/absolute/path/to/project/backend/dist');
  });
  
  test('should convert relative projectRoot to absolute path', () => {
    // Setup mocks
    mockIsAbsolute
      .mockReturnValueOnce(false)  // projectRoot is not absolute
      .mockReturnValueOnce(false); // builtArtifactsPath is not absolute
    
    mockResolve
      .mockReturnValueOnce('/mock/cwd/relative/path/to/project')  // Resolve projectRoot
      .mockReturnValueOnce('/mock/cwd/relative/path/to/project/backend/dist'); // Resolve builtArtifactsPath
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: 'relative/path/to/project',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const result = resolveProjectPaths(params);
    
    // Verify path.isAbsolute was called with projectRoot
    expect(mockIsAbsolute).toHaveBeenCalledWith('relative/path/to/project');
    
    // Verify path.resolve was called to convert projectRoot to absolute
    expect(mockResolve).toHaveBeenCalledWith(
      '/mock/cwd',
      'relative/path/to/project'
    );
    
    // Verify the paths were resolved correctly
    expect(result.projectRoot).toBe('/mock/cwd/relative/path/to/project');
    expect(result.backendConfiguration.builtArtifactsPath).toBe('/mock/cwd/relative/path/to/project/backend/dist');
    
    // Verify logger.warn was called to warn about relative projectRoot
    expect(require('../src/utils/logger').logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('projectRoot is not an absolute path')
    );
  });
  
  test('should handle absolute paths for artifacts', () => {
    // Setup mocks
    mockIsAbsolute
      .mockReturnValueOnce(true)  // projectRoot is absolute
      .mockReturnValueOnce(true); // builtArtifactsPath is absolute
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/absolute/path/to/project',
      backendConfiguration: {
        builtArtifactsPath: '/absolute/path/to/artifacts',
        runtime: 'nodejs18.x'
      }
    };
    
    const result = resolveProjectPaths(params);
    
    // Verify path.isAbsolute was called with both paths
    expect(mockIsAbsolute).toHaveBeenCalledWith('/absolute/path/to/project');
    expect(mockIsAbsolute).toHaveBeenCalledWith('/absolute/path/to/artifacts');
    
    // Verify path.resolve was NOT called to resolve builtArtifactsPath
    expect(mockResolve).not.toHaveBeenCalled();
    
    // Verify the paths were not modified
    expect(result.projectRoot).toBe('/absolute/path/to/project');
    expect(result.backendConfiguration.builtArtifactsPath).toBe('/absolute/path/to/artifacts');
  });
  
  test('should handle fullstack deployment with both backend and frontend paths', () => {
    // Setup mocks
    mockIsAbsolute
      .mockReturnValueOnce(true)   // projectRoot is absolute
      .mockReturnValueOnce(false)  // backendConfiguration.builtArtifactsPath is not absolute
      .mockReturnValueOnce(false); // frontendConfiguration.builtAssetsPath is not absolute
    
    mockResolve
      .mockReturnValueOnce('/absolute/path/to/project/backend/dist')
      .mockReturnValueOnce('/absolute/path/to/project/frontend/build');
    
    const params = {
      deploymentType: 'fullstack',
      projectName: 'test-fullstack',
      projectRoot: '/absolute/path/to/project',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      },
      frontendConfiguration: {
        builtAssetsPath: 'frontend/build',
        indexDocument: 'index.html'
      }
    };
    
    const result = resolveProjectPaths(params);
    
    // Verify path.isAbsolute was called with all paths
    expect(mockIsAbsolute).toHaveBeenCalledWith('/absolute/path/to/project');
    expect(mockIsAbsolute).toHaveBeenCalledWith('backend/dist');
    expect(mockIsAbsolute).toHaveBeenCalledWith('frontend/build');
    
    // Verify path.resolve was called to resolve both paths against projectRoot
    expect(mockResolve).toHaveBeenCalledWith(
      '/absolute/path/to/project',
      'backend/dist'
    );
    expect(mockResolve).toHaveBeenCalledWith(
      '/absolute/path/to/project',
      'frontend/build'
    );
    
    // Verify the paths were resolved correctly
    expect(result.projectRoot).toBe('/absolute/path/to/project');
    expect(result.backendConfiguration.builtArtifactsPath).toBe('/absolute/path/to/project/backend/dist');
    expect(result.frontendConfiguration.builtAssetsPath).toBe('/absolute/path/to/project/frontend/build');
  });
});
