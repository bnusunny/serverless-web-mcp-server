// test/unit/deployment/deploy-service.test.ts
import { deployApplication, getDeploymentStatus } from '../../../src/deployment/deploy-service';

// We need to mock these modules before importing the module under test
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  copyFileSync: jest.fn()
}));

jest.mock('path', () => ({
  resolve: jest.fn(p => p),
  join: jest.fn((...args) => args.join('/'))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

jest.mock('../../../src/template/renderer.js', () => ({
  renderTemplate: jest.fn().mockResolvedValue('mock SAM template')
}));

jest.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Import the mocked modules
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const templateRenderer = require('../../../src/template/renderer.js');
const logger = require('../../../src/utils/logger.js');

describe('Deployment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs.existsSync
    fs.existsSync.mockImplementation((path) => {
      if (path === '/nonexistent/path' || 
          path === '/path/to/nonexistent/backend' ||
          path === '/path/to/nonexistent/frontend') {
        return false;
      }
      return true;
    });
    
    // Mock Date.now for predictable IDs
    jest.spyOn(Date, 'now').mockImplementation(() => 1650456789012);
    
    // Mock child_process.spawn
    const mockSpawnOn = jest.fn().mockImplementation(function(event, callback) {
      if (event === 'close') {
        setTimeout(() => callback(0), 10);
      }
      return this;
    });
    
    const mockSpawn = {
      on: mockSpawnOn,
      stdout: {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(JSON.stringify([
              { OutputKey: 'ApiEndpoint', OutputValue: 'https://api.example.com' },
              { OutputKey: 'FunctionName', OutputValue: 'test-function' },
              { OutputKey: 'WebsiteBucket', OutputValue: 'test-bucket' },
              { OutputKey: 'CloudFrontDistributionId', OutputValue: 'test-distribution' },
              { OutputKey: 'CloudFrontURL', OutputValue: 'https://d123.cloudfront.net' }
            ])), 10);
          }
        })
      }
    };
    
    childProcess.spawn.mockReturnValue(mockSpawn);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getDeploymentStatus', () => {
    test('should return null when deployment does not exist', () => {
      // Call the function with a project name that doesn't exist
      const result = getDeploymentStatus('nonexistent-project');
      
      // Verify the result
      expect(result).toBeNull();
    });
  });

  describe('deployApplication', () => {
    test('should initiate deployment and return immediate acknowledgment', async () => {
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'test-project',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap'
        }
      };
      
      // Call the function
      const result = await deployApplication(params);
      
      // Verify the result
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('status', 'INITIATED');
      expect(result).toHaveProperty('stackName', 'test-project-789012');
      expect(result).toHaveProperty('deploymentId', 'deploy-1650456789012');
      expect(result.outputs).toHaveProperty('message');
      expect(result.outputs.message).toContain('Deployment initiated');
      
      // Verify path.resolve was called to ensure absolute path
      expect(path.resolve).toHaveBeenCalledWith('/path/to/project');
      
      // Verify fs.existsSync was called to check if project root exists
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/project');
      
      // Verify logger was called
      expect(logger.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initiating deployment of test-project')
      );
    });

    test('should return error when project root does not exist', async () => {
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'test-project',
        projectRoot: '/nonexistent/path',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap'
        }
      };
      
      // Call the function
      const result = await deployApplication(params);
      
      // Verify the result
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('status', 'FAILED');
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Project root directory does not exist');
      
      // Verify path.resolve was called to ensure absolute path
      expect(path.resolve).toHaveBeenCalledWith('/nonexistent/path');
      
      // Verify fs.existsSync was called to check if project root exists
      expect(fs.existsSync).toHaveBeenCalledWith('/nonexistent/path');
      
      // Verify logger was called
      expect(logger.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initiate deployment'),
        expect.any(Object)
      );
    });

    test('should handle unexpected errors during deployment initiation', async () => {
      // Mock path.resolve to throw an error
      path.resolve.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });
      
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'test-project',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap'
        }
      };
      
      // Call the function
      const result = await deployApplication(params);
      
      // Verify the result
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('status', 'FAILED');
      expect(result).toHaveProperty('error', 'Unexpected error');
      
      // Verify logger was called
      expect(logger.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initiate deployment'),
        expect.any(Object)
      );
    });

    test('should initiate fullstack deployment', async () => {
      // Test parameters
      const params = {
        deploymentType: 'fullstack',
        projectName: 'fullstack-app',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'nodejs18.x',
          entryPoint: 'app.js',
          generateStartupScript: true
        },
        frontendConfiguration: {
          builtAssetsPath: 'frontend/build',
          indexDocument: 'index.html'
        }
      };
      
      // Call the function
      const result = await deployApplication(params);
      
      // Verify the result
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('status', 'INITIATED');
      expect(result).toHaveProperty('stackName', 'fullstack-app-789012');
      expect(result).toHaveProperty('deploymentId', 'deploy-1650456789012');
      expect(result.outputs).toHaveProperty('message');
      expect(result.outputs.message).toContain('Deployment initiated');
      
      // Verify path.resolve was called to ensure absolute path
      expect(path.resolve).toHaveBeenCalledWith('/path/to/project');
      
      // Verify fs.existsSync was called to check if project root exists
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/project');
    });

    test('should initiate frontend deployment', async () => {
      // Test parameters
      const params = {
        deploymentType: 'frontend',
        projectName: 'frontend-app',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        frontendConfiguration: {
          builtAssetsPath: 'frontend/build',
          indexDocument: 'index.html'
        }
      };
      
      // Call the function
      const result = await deployApplication(params);
      
      // Verify the result
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('status', 'INITIATED');
      expect(result).toHaveProperty('stackName', 'frontend-app-789012');
      expect(result).toHaveProperty('deploymentId', 'deploy-1650456789012');
      expect(result.outputs).toHaveProperty('message');
      expect(result.outputs.message).toContain('Deployment initiated');
      
      // Verify path.resolve was called to ensure absolute path
      expect(path.resolve).toHaveBeenCalledWith('/path/to/project');
      
      // Verify fs.existsSync was called to check if project root exists
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/project');
    });

    test('should handle database configuration in backend deployment', async () => {
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'api-with-db',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap',
          databaseConfiguration: {
            tableName: 'Users',
            attributeDefinitions: [
              { name: 'id', type: 'S' }
            ],
            keySchema: [
              { name: 'id', type: 'HASH' }
            ]
          }
        }
      };
      
      // Call the function
      const result = await deployApplication(params);
      
      // Verify the result
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('status', 'INITIATED');
      expect(result).toHaveProperty('stackName', 'api-with-db-789012');
      expect(result).toHaveProperty('deploymentId', 'deploy-1650456789012');
      expect(result.outputs).toHaveProperty('message');
      expect(result.outputs.message).toContain('Deployment initiated');
      
      // Verify path.resolve was called to ensure absolute path
      expect(path.resolve).toHaveBeenCalledWith('/path/to/project');
      
      // Verify fs.existsSync was called to check if project root exists
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/project');
    });
  });
});
