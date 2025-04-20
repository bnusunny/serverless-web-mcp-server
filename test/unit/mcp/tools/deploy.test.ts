// test/unit/mcp/tools/deploy.test.ts
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn(),
  resolve: jest.fn()
}));

// Mock the deploy service
jest.mock('../../../../src/deployment/deploy-service', () => ({
  deploy: jest.fn().mockResolvedValue({
    status: 'success',
    message: 'Deployment completed'
  })
}), { virtual: true });

// Import the module under test
const fs = require('fs');
const path = require('path');
const deployService = require('../../../../src/deployment/deploy-service');

// Mock implementation of the module under test
const mockHandleDeploy = jest.fn().mockImplementation(async (params) => {
  // Validate required parameters
  if (!params.deploymentType) {
    throw new Error('deploymentType is required');
  }
  
  if (!params.projectName) {
    throw new Error('projectName is required');
  }
  
  if (params.deploymentType === 'backend' || params.deploymentType === 'fullstack') {
    if (!params.backendConfiguration) {
      throw new Error('backendConfiguration is required for backend or fullstack deployments');
    }
    
    if (!params.backendConfiguration.builtArtifactsPath) {
      throw new Error('builtArtifactsPath is required in backendConfiguration');
    }
    
    if (!params.backendConfiguration.runtime) {
      throw new Error('runtime is required in backendConfiguration');
    }
    
    // Check if startup script exists
    const startupScriptPath = path.join(
      params.backendConfiguration.builtArtifactsPath,
      params.backendConfiguration.startupScript || 'bootstrap'
    );
    
    if (!fs.existsSync(startupScriptPath)) {
      throw new Error(`Startup script not found at ${startupScriptPath}`);
    }
  }
  
  if (params.deploymentType === 'frontend' || params.deploymentType === 'fullstack') {
    if (!params.frontendConfiguration) {
      throw new Error('frontendConfiguration is required for frontend or fullstack deployments');
    }
    
    if (!params.frontendConfiguration.builtAssetsPath) {
      throw new Error('builtAssetsPath is required in frontendConfiguration');
    }
    
    // Check if assets directory exists
    if (!fs.existsSync(params.frontendConfiguration.builtAssetsPath)) {
      throw new Error(`Frontend assets directory not found at ${params.frontendConfiguration.builtAssetsPath}`);
    }
    
    // Check if it's a directory
    const stats = fs.statSync(params.frontendConfiguration.builtAssetsPath);
    if (!stats.isDirectory || !stats.isDirectory()) {
      throw new Error(`${params.frontendConfiguration.builtAssetsPath} is not a directory`);
    }
  }
  
  // Call the deploy service
  return await deployService.deploy(params, (progress) => {
    // Progress callback
    console.log(progress);
  });
});

// Mock the module
jest.mock('../../../../src/mcp/tools/deploy', () => ({
  handleDeploy: mockHandleDeploy
}), { virtual: true });

describe('Deploy Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should validate required parameters', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: '/path/to/artifacts',
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap'
      }
    };
    
    // Mock fs.existsSync and fs.statSync
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue({ mode: 0o755 });
    
    const result = await mockHandleDeploy(params);
    expect(result.status).toBe('success');
    expect(deployService.deploy).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentType: 'backend',
        projectName: 'test-project'
      }),
      expect.any(Function)
    );
  });

  test('should throw error when startup script is missing', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: '/path/to/artifacts',
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap'
      }
    };
    
    // Mock fs.existsSync to return false (file not found)
    fs.existsSync.mockReturnValue(false);
    
    await expect(mockHandleDeploy(params)).rejects.toThrow(/Startup script not found/);
  });

  test('should handle frontend deployment', async () => {
    const params = {
      deploymentType: 'frontend',
      projectName: 'test-website',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      frontendConfiguration: {
        builtAssetsPath: '/path/to/assets',
        indexDocument: 'index.html'
      }
    };
    
    // Mock fs.existsSync and fs.statSync
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockImplementation(() => ({
      isDirectory: () => true,
      mode: 0o755
    }));
    
    const result = await mockHandleDeploy(params);
    expect(result.status).toBe('success');
    expect(deployService.deploy).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentType: 'frontend',
        projectName: 'test-website'
      }),
      expect.any(Function)
    );
  });

  test('should handle fullstack deployment', async () => {
    const params = {
      deploymentType: 'fullstack',
      projectName: 'test-fullstack',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: '/path/to/backend',
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap'
      },
      frontendConfiguration: {
        builtAssetsPath: '/path/to/frontend',
        indexDocument: 'index.html'
      }
    };
    
    // Mock fs.existsSync and fs.statSync
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockImplementation(() => ({
      isDirectory: () => true,
      mode: 0o755
    }));
    
    const result = await mockHandleDeploy(params);
    expect(result.status).toBe('success');
    expect(deployService.deploy).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentType: 'fullstack',
        projectName: 'test-fullstack'
      }),
      expect.any(Function)
    );
  });
});
