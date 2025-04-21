// test/unit/deployment/run-deployment-process.test.js

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

// Create a mock deployments Map
const mockDeployments = new Map();

// Mock the deploy-service module
jest.mock('../../../src/deployment/deploy-service', () => {
  const originalModule = jest.requireActual('../../../src/deployment/deploy-service');
  
  // Create a mock version that exposes the runDeploymentProcess function
  // but replaces the private deployments Map with our mockDeployments
  const mockModule = {
    ...originalModule,
    generateStartupScript: jest.fn().mockReturnValue('node app.js'),
    installDependencies: jest.fn().mockResolvedValue(undefined),
    // Mock getter for deployments map for testing
    __getMockDeployments: () => mockDeployments,
    // We need to wrap runDeploymentProcess to use our mockDeployments
    runDeploymentProcess: async (params, deploymentId, stackName) => {
      // Store the original deployments reference
      const originalDeployments = originalModule.deployments;
      
      // Replace it with our mock for the duration of the function call
      Object.defineProperty(originalModule, 'deployments', {
        value: mockDeployments,
        writable: true,
        configurable: true
      });
      
      try {
        // Call the original function
        await originalModule.runDeploymentProcess(params, deploymentId, stackName);
      } finally {
        // Restore the original deployments
        Object.defineProperty(originalModule, 'deployments', {
          value: originalDeployments,
          writable: true,
          configurable: true
        });
      }
    }
  };
  
  return mockModule;
});

// Import the mocked modules
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const templateRenderer = require('../../../src/template/renderer.js');
const logger = require('../../../src/utils/logger.js');
const deployService = require('../../../src/deployment/deploy-service');

describe('runDeploymentProcess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear the mock deployments Map
    mockDeployments.clear();
    
    // Mock fs.existsSync
    fs.existsSync.mockImplementation((path) => {
      if (path === '/nonexistent/path' || 
          path === '/path/to/nonexistent/backend' ||
          path === '/path/to/nonexistent/frontend') {
        return false;
      }
      return true;
    });
    
    // Mock child_process.spawn for successful commands
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
              { OutputKey: 'CloudFrontURL', OutputValue: 'https://d123.cloudfront.net' },
              { OutputKey: 'TableName', OutputValue: 'test-table' }
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

  test('should successfully deploy a backend application', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-backend',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x',
        entryPoint: 'app.js',
        generateStartupScript: true
      }
    };
    
    const deploymentId = 'deploy-123456';
    const stackName = 'test-backend-stack';
    
    await deployService.runDeploymentProcess(params, deploymentId, stackName);
    
    // Verify deployment status was updated
    const deploymentStatus = mockDeployments.get('test-backend');
    expect(deploymentStatus).toBeDefined();
    expect(deploymentStatus.success).toBe(true);
    expect(deploymentStatus.status).toBe('COMPLETE');
    expect(deploymentStatus.url).toBe('https://api.example.com');
    expect(deploymentStatus.resources.apiGateway).toBe('https://api.example.com');
    expect(deploymentStatus.resources.lambda).toBe('test-function');
    
    // Verify startup script was generated
    expect(deployService.generateStartupScript).toHaveBeenCalledWith(params);
    
    // Verify dependencies were installed
    expect(deployService.installDependencies).toHaveBeenCalledWith(params, '/path/to/project/backend/dist');
    
    // Verify template was rendered
    expect(templateRenderer.renderTemplate).toHaveBeenCalled();
    
    // Verify SAM template was written
    expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/project/template.yaml', 'mock SAM template');
    
    // Verify SAM build was called
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'sam',
      ['build', '--template-file', '/path/to/project/template.yaml', '--build-dir', '.aws-sam'],
      expect.objectContaining({ cwd: '/path/to/project' })
    );
    
    // Verify SAM deploy was called
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'sam',
      [
        'deploy',
        '--stack-name', stackName,
        '--region', 'us-east-1',
        '--capabilities', 'CAPABILITY_IAM',
        '--no-confirm-changeset'
      ],
      expect.objectContaining({ cwd: '/path/to/project' })
    );
    
    // Verify CloudFormation describe-stacks was called
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'aws',
      [
        'cloudformation',
        'describe-stacks',
        '--stack-name', stackName,
        '--region', 'us-east-1',
        '--query', 'Stacks[0].Outputs',
        '--output', 'json'
      ],
      expect.objectContaining({ cwd: '/path/to/project' })
    );
  });

  test('should successfully deploy a frontend application', async () => {
    const params = {
      deploymentType: 'frontend',
      projectName: 'test-frontend',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      frontendConfiguration: {
        builtAssetsPath: 'frontend/build',
        indexDocument: 'index.html'
      }
    };
    
    const deploymentId = 'deploy-123456';
    const stackName = 'test-frontend-stack';
    
    await deployService.runDeploymentProcess(params, deploymentId, stackName);
    
    // Verify deployment status was updated
    const deploymentStatus = mockDeployments.get('test-frontend');
    expect(deploymentStatus).toBeDefined();
    expect(deploymentStatus.success).toBe(true);
    expect(deploymentStatus.status).toBe('COMPLETE');
    expect(deploymentStatus.url).toBe('https://d123.cloudfront.net');
    expect(deploymentStatus.resources.s3Bucket).toBe('test-bucket');
    expect(deploymentStatus.resources.cloudFront).toBe('test-distribution');
    
    // Verify template was rendered
    expect(templateRenderer.renderTemplate).toHaveBeenCalled();
    
    // Verify SAM template was written
    expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/project/template.yaml', 'mock SAM template');
    
    // Verify SAM build was called
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'sam',
      ['build', '--template-file', '/path/to/project/template.yaml', '--build-dir', '.aws-sam'],
      expect.objectContaining({ cwd: '/path/to/project' })
    );
    
    // Verify SAM deploy was called
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'sam',
      [
        'deploy',
        '--stack-name', stackName,
        '--region', 'us-east-1',
        '--capabilities', 'CAPABILITY_IAM',
        '--no-confirm-changeset'
      ],
      expect.objectContaining({ cwd: '/path/to/project' })
    );
  });

  test('should handle backend artifacts path not existing', async () => {
    // Mock fs.existsSync to return false for backend path
    fs.existsSync.mockImplementation((path) => {
      if (path.includes('backend/dist')) {
        return false;
      }
      return true;
    });
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-backend',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const deploymentId = 'deploy-123456';
    const stackName = 'test-backend-stack';
    
    await deployService.runDeploymentProcess(params, deploymentId, stackName);
    
    // Verify deployment status was updated with error
    const deploymentStatus = mockDeployments.get('test-backend');
    expect(deploymentStatus).toBeDefined();
    expect(deploymentStatus.success).toBe(false);
    expect(deploymentStatus.status).toBe('FAILED');
    expect(deploymentStatus.error).toContain('Backend artifacts path does not exist');
    
    // Verify no further processing was done
    expect(templateRenderer.renderTemplate).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  test('should handle dependency installation failure', async () => {
    // Mock installDependencies to throw an error
    deployService.installDependencies.mockRejectedValueOnce(new Error('Failed to install dependencies'));
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-backend',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const deploymentId = 'deploy-123456';
    const stackName = 'test-backend-stack';
    
    await deployService.runDeploymentProcess(params, deploymentId, stackName);
    
    // Verify deployment status was updated with error
    const deploymentStatus = mockDeployments.get('test-backend');
    expect(deploymentStatus).toBeDefined();
    expect(deploymentStatus.success).toBe(false);
    expect(deploymentStatus.status).toBe('FAILED');
    expect(deploymentStatus.error).toContain('Failed to install dependencies');
    
    // Verify no further processing was done
    expect(templateRenderer.renderTemplate).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test('should handle template rendering failure', async () => {
    // Mock renderTemplate to throw an error
    templateRenderer.renderTemplate.mockRejectedValueOnce(new Error('Failed to render template'));
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-backend',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const deploymentId = 'deploy-123456';
    const stackName = 'test-backend-stack';
    
    await deployService.runDeploymentProcess(params, deploymentId, stackName);
    
    // Verify deployment status was updated with error
    const deploymentStatus = mockDeployments.get('test-backend');
    expect(deploymentStatus).toBeDefined();
    expect(deploymentStatus.success).toBe(false);
    expect(deploymentStatus.status).toBe('FAILED');
    expect(deploymentStatus.error).toContain('Failed to render template');
    
    // Verify no further processing was done
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  test('should handle SAM build failure', async () => {
    // Mock spawn to simulate SAM build failure
    childProcess.spawn.mockImplementation((command) => {
      if (command === 'sam') {
        return {
          on: jest.fn().mockImplementation(function(event, callback) {
            if (event === 'close') {
              setTimeout(() => callback(1), 10); // Exit code 1 indicates failure
            }
            return this;
          })
        };
      }
      
      return {
        on: jest.fn().mockReturnThis(),
        stdout: {
          on: jest.fn().mockReturnThis()
        }
      };
    });
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-backend',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const deploymentId = 'deploy-123456';
    const stackName = 'test-backend-stack';
    
    await deployService.runDeploymentProcess(params, deploymentId, stackName);
    
    // Verify deployment status was updated with error
    const deploymentStatus = mockDeployments.get('test-backend');
    expect(deploymentStatus).toBeDefined();
    expect(deploymentStatus.success).toBe(false);
    expect(deploymentStatus.status).toBe('FAILED');
    expect(deploymentStatus.error).toContain('SAM build failed');
    
    // Verify SAM build was called but not SAM deploy
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'sam',
      ['build', '--template-file', '/path/to/project/template.yaml', '--build-dir', '.aws-sam'],
      expect.any(Object)
    );
    
    // SAM deploy should not have been called
    expect(childProcess.spawn).not.toHaveBeenCalledWith(
      'sam',
      expect.arrayContaining(['deploy']),
      expect.any(Object)
    );
  });
});
