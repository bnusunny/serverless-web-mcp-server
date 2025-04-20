// test/unit/mcp/tools/deploy.test.ts
import { handleDeploy } from '../../../../src/mcp/tools/deploy';
import * as deployService from '../../../../src/deployment/deploy-service';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('../../../../src/deployment/deploy-service');
jest.mock('fs');
jest.mock('path');

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
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ mode: 0o755 });
    
    // Mock deploy function
    (deployService.deploy as jest.Mock).mockResolvedValue({
      status: 'success',
      message: 'Deployment completed'
    });
    
    const result = await handleDeploy(params);
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
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    await expect(handleDeploy(params)).rejects.toThrow(/Startup script not found/);
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
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockImplementation((p) => {
      return { 
        isDirectory: () => true,
        mode: 0o755
      };
    });
    
    // Mock deploy function
    (deployService.deploy as jest.Mock).mockResolvedValue({
      status: 'success',
      message: 'Frontend deployment completed'
    });
    
    const result = await handleDeploy(params);
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
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockImplementation((p) => {
      return { 
        isDirectory: () => true,
        mode: 0o755
      };
    });
    
    // Mock deploy function
    (deployService.deploy as jest.Mock).mockResolvedValue({
      status: 'success',
      message: 'Fullstack deployment completed'
    });
    
    const result = await handleDeploy(params);
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
