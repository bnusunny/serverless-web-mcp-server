/**
 * Test for Dependency Installer
 */
const { installDependencies } = require('../../../src/deployment/dependency-installer');
const fs = require('fs');
const path = require('path');
const process = require('../../../src/utils/process');

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  copyFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(p => p.split('/').slice(0, -1).join('/'))
}));

jest.mock('../../../src/utils/process', () => ({
  executeCommand: jest.fn()
}));

describe('Dependency Installer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should install Node.js dependencies', async () => {
    // Mock fs.existsSync to return true for package.json
    fs.existsSync.mockImplementation(path => {
      if (path.includes('package.json')) {
        return true;
      }
      return false;
    });
    
    // Mock process.executeCommand to succeed
    process.executeCommand.mockResolvedValue({
      success: true,
      stdout: 'npm install completed successfully'
    });
    
    const result = await installDependencies({
      runtime: 'nodejs18.x',
      projectRoot: '/project',
      builtArtifactsPath: '/build/artifacts'
    });
    
    expect(result.success).toBe(true);
    expect(process.executeCommand).toHaveBeenCalledWith(
      'npm',
      ['install', '--production'],
      expect.objectContaining({ cwd: '/build/artifacts' })
    );
  });
  
  test('should copy package.json if not present in artifacts', async () => {
    // Mock fs.existsSync to return false for artifacts package.json but true for project package.json
    fs.existsSync.mockImplementation(path => {
      if (path.includes('/build/artifacts/package.json')) {
        return false;
      }
      if (path.includes('/project/package.json')) {
        return true;
      }
      return false;
    });
    
    // Mock process.executeCommand to succeed
    process.executeCommand.mockResolvedValue({
      success: true,
      stdout: 'npm install completed successfully'
    });
    
    const result = await installDependencies({
      runtime: 'nodejs18.x',
      projectRoot: '/project',
      builtArtifactsPath: '/build/artifacts'
    });
    
    expect(result.success).toBe(true);
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/project/package.json',
      '/build/artifacts/package.json'
    );
    expect(process.executeCommand).toHaveBeenCalledWith(
      'npm',
      ['install', '--production'],
      expect.objectContaining({ cwd: '/build/artifacts' })
    );
  });
  
  test('should install Python dependencies', async () => {
    // Mock fs.existsSync to return true for requirements.txt
    fs.existsSync.mockImplementation(path => {
      if (path.includes('requirements.txt')) {
        return true;
      }
      return false;
    });
    
    // Mock process.executeCommand to succeed
    process.executeCommand.mockResolvedValue({
      success: true,
      stdout: 'pip install completed successfully'
    });
    
    const result = await installDependencies({
      runtime: 'python3.9',
      projectRoot: '/project',
      builtArtifactsPath: '/build/artifacts'
    });
    
    expect(result.success).toBe(true);
    expect(process.executeCommand).toHaveBeenCalledWith(
      'pip',
      ['install', '-r', 'requirements.txt', '-t', '.'],
      expect.objectContaining({ cwd: '/build/artifacts' })
    );
  });
  
  test('should install Ruby dependencies', async () => {
    // Mock fs.existsSync to return true for Gemfile
    fs.existsSync.mockImplementation(path => {
      if (path.includes('Gemfile')) {
        return true;
      }
      return false;
    });
    
    // Mock process.executeCommand to succeed
    process.executeCommand.mockResolvedValue({
      success: true,
      stdout: 'bundle install completed successfully'
    });
    
    const result = await installDependencies({
      runtime: 'ruby3.2',
      projectRoot: '/project',
      builtArtifactsPath: '/build/artifacts'
    });
    
    expect(result.success).toBe(true);
    expect(process.executeCommand).toHaveBeenCalledWith(
      'bundle',
      ['install', '--path', '.'],
      expect.objectContaining({ cwd: '/build/artifacts' })
    );
  });
  
  test('should handle missing dependency files', async () => {
    // Mock fs.existsSync to return false for all dependency files
    fs.existsSync.mockReturnValue(false);
    
    const result = await installDependencies({
      runtime: 'nodejs18.x',
      projectRoot: '/project',
      builtArtifactsPath: '/build/artifacts'
    });
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('No package.json found');
    expect(process.executeCommand).not.toHaveBeenCalled();
  });
  
  test('should handle installation failures', async () => {
    // Mock fs.existsSync to return true for package.json
    fs.existsSync.mockImplementation(path => {
      if (path.includes('package.json')) {
        return true;
      }
      return false;
    });
    
    // Mock process.executeCommand to fail
    process.executeCommand.mockResolvedValue({
      success: false,
      stderr: 'npm install failed',
      error: new Error('Command failed')
    });
    
    const result = await installDependencies({
      runtime: 'nodejs18.x',
      projectRoot: '/project',
      builtArtifactsPath: '/build/artifacts'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.message).toContain('Failed to install dependencies');
  });
  
  test('should handle unsupported runtimes', async () => {
    const result = await installDependencies({
      runtime: 'unsupported-runtime',
      projectRoot: '/project',
      builtArtifactsPath: '/build/artifacts'
    });
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('No dependency installation needed');
    expect(process.executeCommand).not.toHaveBeenCalled();
  });
});
