import { DeploymentService } from '../../../src/deployment/deployment-service';
import { runProcess } from '../../../src/utils/process';
import { installDependencies } from '../../../src/deployment/dependency-installer';
import { generateStartupScript } from '../../../src/deployment/startup-script-generator';
import { ensureDirectoryExists, copyDirectory, isExecutable } from '../../../src/utils/fs-utils';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('../../../src/utils/process');
jest.mock('../../../src/deployment/dependency-installer');
jest.mock('../../../src/deployment/startup-script-generator');
jest.mock('../../../src/utils/fs-utils');
jest.mock('fs');
jest.mock('path');

describe('Deployment Service', () => {
  let deploymentService: DeploymentService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock path.join to return predictable paths
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    // Mock path.resolve to return predictable paths
    (path.resolve as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    // Mock fs.existsSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Mock fs.writeFileSync
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    
    // Mock runProcess to return success
    (runProcess as jest.Mock).mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'Deployment successful',
      stderr: ''
    });
    
    // Mock installDependencies to return success
    (installDependencies as jest.Mock).mockResolvedValue({
      success: true,
      message: 'Dependencies installed successfully'
    });
    
    // Mock generateStartupScript to return success
    (generateStartupScript as jest.Mock).mockReturnValue({
      success: true,
      scriptPath: '/build/artifacts/bootstrap'
    });
    
    // Mock isExecutable to return true
    (isExecutable as jest.Mock).mockReturnValue(true);
    
    // Create deployment service instance
    deploymentService = new DeploymentService();
  });

  describe('deployBackend', () => {
    test('should deploy backend successfully', async () => {
      const params = {
        projectName: 'test-api',
        projectRoot: '/project/root',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: '/build/artifacts',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap',
          memorySize: 512,
          timeout: 30,
          environment: {
            NODE_ENV: 'production'
          }
        }
      };
      
      const result = await deploymentService.deployBackend(params);
      
      // Should check if startup script exists and is executable
      expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/bootstrap');
      expect(isExecutable).toHaveBeenCalledWith('/build/artifacts/bootstrap');
      
      // Should install dependencies
      expect(installDependencies).toHaveBeenCalledWith(
        'nodejs18.x',
        '/project/root',
        '/build/artifacts'
      );
      
      // Should run SAM build and deploy
      expect(runProcess).toHaveBeenCalledTimes(2);
      
      expect(result).toEqual({
        success: true,
        message: 'Backend deployment completed successfully',
        outputs: {
          ApiUrl: expect.any(String)
        }
      });
    });
    
    test('should generate startup script if requested', async () => {
      const params = {
        projectName: 'test-api',
        projectRoot: '/project/root',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: '/build/artifacts',
          runtime: 'nodejs18.x',
          entryPoint: 'app.js',
          generateStartupScript: true,
          memorySize: 512,
          timeout: 30
        }
      };
      
      const result = await deploymentService.deployBackend(params);
      
      // Should generate startup script
      expect(generateStartupScript).toHaveBeenCalledWith(
        'nodejs18.x',
        'app.js',
        '/build/artifacts'
      );
      
      // Should install dependencies
      expect(installDependencies).toHaveBeenCalledWith(
        'nodejs18.x',
        '/project/root',
        '/build/artifacts'
      );
      
      // Should run SAM build and deploy
      expect(runProcess).toHaveBeenCalledTimes(2);
      
      expect(result).toEqual({
        success: true,
        message: 'Backend deployment completed successfully',
        outputs: {
          ApiUrl: expect.any(String)
        }
      });
    });
    
    test('should handle missing startup script', async () => {
      // Mock fs.existsSync to return false for startup script
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return !path.endsWith('bootstrap');
      });
      
      const params = {
        projectName: 'test-api',
        projectRoot: '/project/root',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: '/build/artifacts',
          runtime: 'nodejs18.x',
          memorySize: 512,
          timeout: 30
        }
      };
      
      await expect(deploymentService.deployBackend(params)).rejects.toThrow(
        'Startup script not found. Please provide a valid startup script or use generateStartupScript with entryPoint.'
      );
      
      // Should not install dependencies or run SAM commands
      expect(installDependencies).not.toHaveBeenCalled();
      expect(runProcess).not.toHaveBeenCalled();
    });
    
    test('should handle non-executable startup script', async () => {
      // Mock isExecutable to return false
      (isExecutable as jest.Mock).mockReturnValue(false);
      
      const params = {
        projectName: 'test-api',
        projectRoot: '/project/root',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: '/build/artifacts',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap',
          memorySize: 512,
          timeout: 30
        }
      };
      
      await expect(deploymentService.deployBackend(params)).rejects.toThrow(
        'Startup script is not executable. Please make it executable (chmod +x).'
      );
      
      // Should not install dependencies or run SAM commands
      expect(installDependencies).not.toHaveBeenCalled();
      expect(runProcess).not.toHaveBeenCalled();
    });
    
    test('should handle dependency installation failure', async () => {
      // Mock installDependencies to return failure
      (installDependencies as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Failed to install dependencies'
      });
      
      const params = {
        projectName: 'test-api',
        projectRoot: '/project/root',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: '/build/artifacts',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap',
          memorySize: 512,
          timeout: 30
        }
      };
      
      await expect(deploymentService.deployBackend(params)).rejects.toThrow(
        'Failed to install dependencies'
      );
      
      // Should attempt to install dependencies but not run SAM commands
      expect(installDependencies).toHaveBeenCalled();
      expect(runProcess).not.toHaveBeenCalled();
    });
    
    test('should handle SAM build failure', async () => {
      // Mock runProcess to return failure for SAM build
      (runProcess as jest.Mock).mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'SAM build failed'
      });
      
      const params = {
        projectName: 'test-api',
        projectRoot: '/project/root',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: '/build/artifacts',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap',
          memorySize: 512,
          timeout: 30
        }
      };
      
      await expect(deploymentService.deployBackend(params)).rejects.toThrow(
        'SAM build failed: SAM build failed'
      );
      
      // Should install dependencies and attempt SAM build
      expect(installDependencies).toHaveBeenCalled();
      expect(runProcess).toHaveBeenCalledTimes(1);
    });
  });

  describe('deployFrontend', () => {
    test('should deploy frontend successfully', async () => {
      const params = {
        projectName: 'test-website',
        projectRoot: '/project/root',
        region: 'us-east-1',
        frontendConfiguration: {
          builtAssetsPath: '/build/assets',
          indexDocument: 'index.html'
        }
      };
      
      const result = await deploymentService.deployFrontend(params);
      
      // Should run SAM build and deploy
      expect(runProcess).toHaveBeenCalledTimes(2);
      
      expect(result).toEqual({
        success: true,
        message: 'Frontend deployment completed successfully',
        outputs: {
          WebsiteUrl: expect.any(String)
        }
      });
    });
    
    test('should handle custom domain configuration', async () => {
      const params = {
        projectName: 'test-website',
        projectRoot: '/project/root',
        region: 'us-east-1',
        frontendConfiguration: {
          builtAssetsPath: '/build/assets',
          indexDocument: 'index.html',
          customDomain: 'example.com',
          certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/abcdef'
        }
      };
      
      const result = await deploymentService.deployFrontend(params);
      
      // Should run SAM build and deploy
      expect(runProcess).toHaveBeenCalledTimes(2);
      
      expect(result).toEqual({
        success: true,
        message: 'Frontend deployment completed successfully',
        outputs: {
          WebsiteUrl: expect.any(String),
          CustomDomainUrl: 'https://example.com'
        }
      });
    });
    
    test('should handle SAM build failure', async () => {
      // Mock runProcess to return failure for SAM build
      (runProcess as jest.Mock).mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'SAM build failed'
      });
      
      const params = {
        projectName: 'test-website',
        projectRoot: '/project/root',
        region: 'us-east-1',
        frontendConfiguration: {
          builtAssetsPath: '/build/assets',
          indexDocument: 'index.html'
        }
      };
      
      await expect(deploymentService.deployFrontend(params)).rejects.toThrow(
        'SAM build failed: SAM build failed'
      );
      
      // Should attempt SAM build but not deploy
      expect(runProcess).toHaveBeenCalledTimes(1);
    });
  });

  describe('deployFullstack', () => {
    test('should deploy fullstack application successfully', async () => {
      const params = {
        projectName: 'test-fullstack',
        projectRoot: '/project/root',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: '/build/artifacts',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap',
          memorySize: 512,
          timeout: 30
        },
        frontendConfiguration: {
          builtAssetsPath: '/build/assets',
          indexDocument: 'index.html'
        }
      };
      
      const result = await deploymentService.deployFullstack(params);
      
      // Should check if startup script exists and is executable
      expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/bootstrap');
      expect(isExecutable).toHaveBeenCalledWith('/build/artifacts/bootstrap');
      
      // Should install dependencies
      expect(installDependencies).toHaveBeenCalledWith(
        'nodejs18.x',
        '/project/root',
        '/build/artifacts'
      );
      
      // Should run SAM build and deploy
      expect(runProcess).toHaveBeenCalledTimes(2);
      
      expect(result).toEqual({
        success: true,
        message: 'Fullstack deployment completed successfully',
        outputs: {
          ApiUrl: expect.any(String),
          WebsiteUrl: expect.any(String)
        }
      });
    });
    
    test('should handle missing backend configuration', async () => {
      const params = {
        projectName: 'test-fullstack',
        projectRoot: '/project/root',
        region: 'us-east-1',
        frontendConfiguration: {
          builtAssetsPath: '/build/assets',
          indexDocument: 'index.html'
        }
      };
      
      await expect(deploymentService.deployFullstack(params)).rejects.toThrow(
        'Backend configuration is required for fullstack deployment'
      );
      
      // Should not install dependencies or run SAM commands
      expect(installDependencies).not.toHaveBeenCalled();
      expect(runProcess).not.toHaveBeenCalled();
    });
    
    test('should handle missing frontend configuration', async () => {
      const params = {
        projectName: 'test-fullstack',
        projectRoot: '/project/root',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: '/build/artifacts',
          runtime: 'nodejs18.x',
          startupScript: 'bootstrap',
          memorySize: 512,
          timeout: 30
        }
      };
      
      await expect(deploymentService.deployFullstack(params)).rejects.toThrow(
        'Frontend configuration is required for fullstack deployment'
      );
      
      // Should not install dependencies or run SAM commands
      expect(installDependencies).not.toHaveBeenCalled();
      expect(runProcess).not.toHaveBeenCalled();
    });
  });
});
