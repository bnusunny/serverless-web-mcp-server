// test/unit/deployment/run-deployment-process.test.ts
import { runDeploymentProcess, DeploymentParams, getDeploymentStatus } from '../../../src/deployment/deploy-service';

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

describe('Run Deployment Process Function', () => {
  // Store original process.chdir
  const originalChdir = process.chdir;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock process.chdir
    process.chdir = jest.fn();
    
    // Mock fs.existsSync
    fs.existsSync.mockImplementation((path) => {
      if (path.includes('nonexistent')) {
        return false;
      }
      return true;
    });
    
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
    // Restore original process.chdir
    process.chdir = originalChdir;
  });

  test('should handle backend artifacts validation', async () => {
    // Test parameters
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'nonexistent/backend',
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap'
      }
    };
    
    const deploymentId = 'deploy-1234567890';
    const stackName = 'test-project-123456';
    
    // Mock fs.existsSync to return false for backend artifacts path
    fs.existsSync.mockImplementation((path) => {
      if (path.includes('nonexistent')) {
        return false;
      }
      return true;
    });
    
    // Start the deployment process
    await runDeploymentProcess(params, deploymentId, stackName);
    
    // Verify logger was called with error
    expect(logger.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Deployment failed for test-project'),
      expect.any(Object)
    );
  });
});
