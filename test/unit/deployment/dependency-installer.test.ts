import { installDependencies } from '../../../src/deployment/dependency-installer';
import { runProcess } from '../../../src/utils/process';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('../../../src/utils/process');
jest.mock('fs');
jest.mock('path');

describe('Dependency Installer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock path.join to return predictable paths
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    // Mock path.resolve to return predictable paths
    (path.resolve as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    // Mock fs.existsSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Mock fs.copyFileSync
    (fs.copyFileSync as jest.Mock).mockImplementation(() => {});
    
    // Mock runProcess to return success
    (runProcess as jest.Mock).mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'Installation successful',
      stderr: ''
    });
  });

  test('should install Node.js dependencies', async () => {
    const result = await installDependencies('nodejs18.x', '/project/root', '/build/artifacts');
    
    // Should check for package.json in build artifacts
    expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/package.json');
    
    // Should copy package.json from project root if not in build artifacts
    expect(fs.copyFileSync).toHaveBeenCalledWith('/project/root/package.json', '/build/artifacts/package.json');
    
    // Should run npm install
    expect(runProcess).toHaveBeenCalledWith(
      'npm',
      ['install', '--production'],
      { cwd: '/build/artifacts' },
      expect.any(Function)
    );
    
    expect(result).toEqual({
      success: true,
      message: 'Dependencies installed successfully'
    });
  });

  test('should install Python dependencies', async () => {
    const result = await installDependencies('python3.9', '/project/root', '/build/artifacts');
    
    // Should check for requirements.txt in build artifacts
    expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/requirements.txt');
    
    // Should copy requirements.txt from project root if not in build artifacts
    expect(fs.copyFileSync).toHaveBeenCalledWith('/project/root/requirements.txt', '/build/artifacts/requirements.txt');
    
    // Should run pip install
    expect(runProcess).toHaveBeenCalledWith(
      'pip',
      ['install', '-r', 'requirements.txt', '-t', '.'],
      { cwd: '/build/artifacts' },
      expect.any(Function)
    );
    
    expect(result).toEqual({
      success: true,
      message: 'Dependencies installed successfully'
    });
  });

  test('should install Ruby dependencies', async () => {
    const result = await installDependencies('ruby3.2', '/project/root', '/build/artifacts');
    
    // Should check for Gemfile in build artifacts
    expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/Gemfile');
    
    // Should copy Gemfile from project root if not in build artifacts
    expect(fs.copyFileSync).toHaveBeenCalledWith('/project/root/Gemfile', '/build/artifacts/Gemfile');
    
    // Should run bundle install
    expect(runProcess).toHaveBeenCalledWith(
      'bundle',
      ['install'],
      { cwd: '/build/artifacts' },
      expect.any(Function)
    );
    
    expect(result).toEqual({
      success: true,
      message: 'Dependencies installed successfully'
    });
  });

  test('should handle unsupported runtime', async () => {
    const result = await installDependencies('java11', '/project/root', '/build/artifacts');
    
    // Should not run any installation commands
    expect(runProcess).not.toHaveBeenCalled();
    
    expect(result).toEqual({
      success: true,
      message: 'No dependency installation needed for runtime: java11'
    });
  });

  test('should handle missing dependency file', async () => {
    // Mock fs.existsSync to return false for both build artifacts and project root
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    const result = await installDependencies('nodejs18.x', '/project/root', '/build/artifacts');
    
    // Should check for package.json in build artifacts and project root
    expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/package.json');
    expect(fs.existsSync).toHaveBeenCalledWith('/project/root/package.json');
    
    // Should not copy package.json or run npm install
    expect(fs.copyFileSync).not.toHaveBeenCalled();
    expect(runProcess).not.toHaveBeenCalled();
    
    expect(result).toEqual({
      success: true,
      message: 'No package.json found, skipping dependency installation'
    });
  });

  test('should handle installation failure', async () => {
    // Mock runProcess to return failure
    (runProcess as jest.Mock).mockResolvedValue({
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: 'Installation failed'
    });
    
    const result = await installDependencies('nodejs18.x', '/project/root', '/build/artifacts');
    
    // Should check for package.json in build artifacts
    expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/package.json');
    
    // Should copy package.json from project root if not in build artifacts
    expect(fs.copyFileSync).toHaveBeenCalledWith('/project/root/package.json', '/build/artifacts/package.json');
    
    // Should run npm install
    expect(runProcess).toHaveBeenCalledWith(
      'npm',
      ['install', '--production'],
      { cwd: '/build/artifacts' },
      expect.any(Function)
    );
    
    expect(result).toEqual({
      success: false,
      message: 'Failed to install dependencies: Installation failed'
    });
  });
});
