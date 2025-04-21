// test/unit/deployment/install-dependencies.test.js
const { installDependencies } = require('../../../src/deployment/deploy-service');

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

describe('installDependencies', () => {
  let originalChdir;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save original process.chdir
    originalChdir = process.chdir;
    process.chdir = jest.fn();
    
    // Mock fs.existsSync
    fs.existsSync.mockImplementation((path) => {
      if (path.includes('package.json') || 
          path.includes('requirements.txt') || 
          path.includes('Gemfile')) {
        return true;
      }
      return false;
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
    jest.restoreAllMocks();
  });

  test('should do nothing if no backend configuration', async () => {
    const params = {
      deploymentType: 'frontend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      frontendConfiguration: {
        builtAssetsPath: 'frontend/build'
      }
    };
    
    await installDependencies(params, '/path/to/backend');
    
    expect(process.chdir).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  test('should install Node.js dependencies when package.json exists', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    await installDependencies(params, '/path/to/backend');
    
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project');
    expect(fs.existsSync).toHaveBeenCalledWith('package.json');
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'npm',
      ['install', '--production'],
      expect.objectContaining({ stdio: 'inherit' })
    );
    expect(logger.logger.info).toHaveBeenCalledWith('Installing Node.js dependencies');
  });

  test('should copy package.json from project root when not in backend directory', async () => {
    // Mock package.json not existing in backend dir but existing in project root
    fs.existsSync.mockImplementation((path) => {
      if (path === 'package.json') {
        return false;
      }
      if (path === '/path/to/project/package.json') {
        return true;
      }
      return false;
    });
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    await installDependencies(params, '/path/to/backend');
    
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(fs.existsSync).toHaveBeenCalledWith('package.json');
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/project/package.json');
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/path/to/project/package.json',
      '/path/to/backend/package.json'
    );
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'npm',
      ['install', '--production'],
      expect.objectContaining({ stdio: 'inherit' })
    );
    expect(logger.logger.info).toHaveBeenCalledWith('Copying package.json from project root');
  });

  test('should skip Node.js dependency installation when no package.json found', async () => {
    // Mock package.json not existing anywhere
    fs.existsSync.mockReturnValue(false);
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    await installDependencies(params, '/path/to/backend');
    
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(fs.existsSync).toHaveBeenCalledWith('package.json');
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/project/package.json');
    expect(childProcess.spawn).not.toHaveBeenCalled();
    expect(logger.logger.warn).toHaveBeenCalledWith('No package.json found, skipping dependency installation');
  });

  test('should install Python dependencies when requirements.txt exists', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'python3.9'
      }
    };
    
    await installDependencies(params, '/path/to/backend');
    
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(fs.existsSync).toHaveBeenCalledWith('requirements.txt');
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'pip',
      ['install', '-r', 'requirements.txt', '-t', '.'],
      expect.objectContaining({ stdio: 'inherit' })
    );
    expect(logger.logger.info).toHaveBeenCalledWith('Installing Python dependencies');
  });

  test('should copy requirements.txt from project root when not in backend directory', async () => {
    // Mock requirements.txt not existing in backend dir but existing in project root
    fs.existsSync.mockImplementation((path) => {
      if (path === 'requirements.txt') {
        return false;
      }
      if (path === '/path/to/project/requirements.txt') {
        return true;
      }
      return false;
    });
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'python3.9'
      }
    };
    
    await installDependencies(params, '/path/to/backend');
    
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(fs.existsSync).toHaveBeenCalledWith('requirements.txt');
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/project/requirements.txt');
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/path/to/project/requirements.txt',
      '/path/to/backend/requirements.txt'
    );
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'pip',
      ['install', '-r', 'requirements.txt', '-t', '.'],
      expect.objectContaining({ stdio: 'inherit' })
    );
    expect(logger.logger.info).toHaveBeenCalledWith('Copying requirements.txt from project root');
  });

  test('should install Ruby dependencies when Gemfile exists', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'ruby3.2'
      }
    };
    
    await installDependencies(params, '/path/to/backend');
    
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(fs.existsSync).toHaveBeenCalledWith('Gemfile');
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'bundle',
      ['install'],
      expect.objectContaining({ stdio: 'inherit' })
    );
    expect(logger.logger.info).toHaveBeenCalledWith('Installing Ruby dependencies');
  });

  test('should handle npm install failure', async () => {
    // Mock spawn to simulate npm install failure
    const mockSpawnOn = jest.fn().mockImplementation(function(event, callback) {
      if (event === 'close') {
        setTimeout(() => callback(1), 10); // Exit code 1 indicates failure
      }
      return this;
    });
    
    childProcess.spawn.mockReturnValue({
      on: mockSpawnOn
    });
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    await expect(installDependencies(params, '/path/to/backend')).rejects.toThrow('npm install failed with code 1');
    
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project'); // Should return to project root even on failure
    expect(logger.logger.error).toHaveBeenCalledWith(expect.stringContaining('Error installing dependencies'));
  });

  test('should handle spawn error', async () => {
    // Mock spawn to simulate error
    const mockSpawnOn = jest.fn().mockImplementation(function(event, callback) {
      if (event === 'error') {
        setTimeout(() => callback(new Error('Command not found')), 10);
      }
      return this;
    });
    
    childProcess.spawn.mockReturnValue({
      on: mockSpawnOn
    });
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    await expect(installDependencies(params, '/path/to/backend')).rejects.toThrow('Command not found');
    
    expect(process.chdir).toHaveBeenCalledWith('/path/to/backend');
    expect(process.chdir).toHaveBeenCalledWith('/path/to/project'); // Should return to project root even on failure
    expect(logger.logger.error).toHaveBeenCalledWith(expect.stringContaining('Error installing dependencies'));
  });
});
