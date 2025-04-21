// test/unit/deployment/install-dependencies.test.ts
import { installDependencies, DeploymentParams } from '../../../src/deployment/deploy-service';

// We need to mock these modules before importing the module under test
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  copyFileSync: jest.fn()
}));

jest.mock('path', () => ({
  resolve: jest.fn(p => p),
  join: jest.fn((...args) => args.join('/'))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn()
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
const logger = require('../../../src/utils/logger.js');

describe('Install Dependencies Function', () => {
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
      on: mockSpawnOn
    };
    
    childProcess.spawn.mockReturnValue(mockSpawn);
  });

  afterEach(() => {
    // Restore original process.chdir
    process.chdir = originalChdir;
  });

  test('should do nothing if backendConfiguration is not provided', async () => {
    // Test parameters
    const params = {
      deploymentType: 'frontend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      // No backendConfiguration
    };
    
    // Call the function
    await installDependencies(params, '/path/to/backend');
    
    // Verify that no operations were performed
    expect(process.chdir).not.toHaveBeenCalled();
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  test('should install Node.js dependencies when package.json exists', async () => {
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
    
    // Mock fs.existsSync to return true for package.json
    fs.existsSync.mockImplementation((path) => {
      if (path === 'package.json') {
        return true;
      }
      return false;
    });
    
    // Call the function
    await installDependencies(params, '/path/to/backend');
    
    // Verify that the correct operations were performed
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project');
    expect(fs.existsSync).toHaveBeenCalledWith('package.json');
    expect(childProcess.spawn).toHaveBeenCalledWith('npm', ['install', '--production'], { stdio: 'inherit' });
    expect(logger.logger.info).toHaveBeenCalledWith('Installing Node.js dependencies');
  });

  test('should copy package.json from project root when it does not exist in backend', async () => {
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
    
    // Mock fs.existsSync to return false for package.json in backend but true for project root
    fs.existsSync.mockImplementation((path) => {
      if (path === 'package.json') {
        return false;
      }
      if (path === '/path/to/project/package.json') {
        return true;
      }
      return false;
    });
    
    // Call the function
    await installDependencies(params, '/path/to/backend');
    
    // Verify that the correct operations were performed
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project');
    expect(fs.existsSync).toHaveBeenCalledWith('package.json');
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/project/package.json');
    expect(fs.copyFileSync).toHaveBeenCalledWith('/path/to/project/package.json', '/path/to/backend/package.json');
    expect(childProcess.spawn).toHaveBeenCalledWith('npm', ['install', '--production'], { stdio: 'inherit' });
    expect(logger.logger.info).toHaveBeenCalledWith('Copying package.json from project root');
  });

  test('should skip dependency installation when no package.json is found', async () => {
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
    
    // Mock fs.existsSync to return false for all package.json paths
    fs.existsSync.mockReturnValue(false);
    
    // Call the function
    await installDependencies(params, '/path/to/backend');
    
    // Verify that the correct operations were performed
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project');
    expect(fs.existsSync).toHaveBeenCalledWith('package.json');
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/project/package.json');
    expect(childProcess.spawn).not.toHaveBeenCalled();
    expect(logger.logger.warn).toHaveBeenCalledWith('No package.json found, skipping dependency installation');
  });

  test('should install Python dependencies when requirements.txt exists', async () => {
    // Test parameters
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'python3.9',
        startupScript: 'bootstrap'
      }
    };
    
    // Mock fs.existsSync to return true for requirements.txt
    fs.existsSync.mockImplementation((path) => {
      if (path === 'requirements.txt') {
        return true;
      }
      return false;
    });
    
    // Call the function
    await installDependencies(params, '/path/to/backend');
    
    // Verify that the correct operations were performed
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project');
    expect(fs.existsSync).toHaveBeenCalledWith('requirements.txt');
    expect(childProcess.spawn).toHaveBeenCalledWith('pip', ['install', '-r', 'requirements.txt', '-t', '.'], { stdio: 'inherit' });
    expect(logger.logger.info).toHaveBeenCalledWith('Installing Python dependencies');
  });

  test('should install Ruby dependencies when Gemfile exists', async () => {
    // Test parameters
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'ruby2.7',
        startupScript: 'bootstrap'
      }
    };
    
    // Mock fs.existsSync to return true for Gemfile
    fs.existsSync.mockImplementation((path) => {
      if (path === 'Gemfile') {
        return true;
      }
      return false;
    });
    
    // Call the function
    await installDependencies(params, '/path/to/backend');
    
    // Verify that the correct operations were performed
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project');
    expect(fs.existsSync).toHaveBeenCalledWith('Gemfile');
    expect(childProcess.spawn).toHaveBeenCalledWith('bundle', ['install'], { stdio: 'inherit' });
    expect(logger.logger.info).toHaveBeenCalledWith('Installing Ruby dependencies');
  });

  test('should handle npm install failure', async () => {
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
    
    // Mock fs.existsSync to return true for package.json
    fs.existsSync.mockImplementation((path) => {
      if (path === 'package.json') {
        return true;
      }
      return false;
    });
    
    // Mock child_process.spawn to simulate npm install failure
    const mockSpawnOn = jest.fn().mockImplementation(function(event, callback) {
      if (event === 'close') {
        setTimeout(() => callback(1), 10); // Return non-zero exit code
      }
      return this;
    });
    
    const mockSpawn = {
      on: mockSpawnOn
    };
    
    childProcess.spawn.mockReturnValue(mockSpawn);
    
    // Call the function and expect it to throw
    await expect(installDependencies(params, '/path/to/backend')).rejects.toThrow('npm install failed with code 1');
    
    // Verify that the correct operations were performed
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project');
    expect(fs.existsSync).toHaveBeenCalledWith('package.json');
    expect(childProcess.spawn).toHaveBeenCalledWith('npm', ['install', '--production'], { stdio: 'inherit' });
    expect(logger.logger.error).toHaveBeenCalled();
  });

  test('should handle spawn error', async () => {
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
    
    // Mock fs.existsSync to return true for package.json
    fs.existsSync.mockImplementation((path) => {
      if (path === 'package.json') {
        return true;
      }
      return false;
    });
    
    // Mock child_process.spawn to simulate spawn error
    const mockSpawnOn = jest.fn().mockImplementation(function(event, callback) {
      if (event === 'error') {
        setTimeout(() => callback(new Error('spawn error')), 10);
      }
      return this;
    });
    
    const mockSpawn = {
      on: mockSpawnOn
    };
    
    childProcess.spawn.mockReturnValue(mockSpawn);
    
    // Call the function and expect it to throw
    await expect(installDependencies(params, '/path/to/backend')).rejects.toThrow('spawn error');
    
    // Verify that the correct operations were performed
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project');
    expect(fs.existsSync).toHaveBeenCalledWith('package.json');
    expect(childProcess.spawn).toHaveBeenCalledWith('npm', ['install', '--production'], { stdio: 'inherit' });
    expect(logger.logger.error).toHaveBeenCalled();
  });
});
