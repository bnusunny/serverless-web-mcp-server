import { generateStartupScript, StartupScriptOptions } from '../../../src/deployment/startup-script-generator';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('path');

describe('Startup Script Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock path.join to return predictable paths
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    // Mock fs.existsSync to return true for entry point files
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Mock fs.writeFile (promisified version)
    (fs.writeFile as jest.Mock) = jest.fn((path, content, encoding, callback) => {
      callback(null);
    });
    
    // Mock fs.chmod (promisified version)
    (fs.chmod as jest.Mock) = jest.fn((path, mode, callback) => {
      callback(null);
    });
  });

  test('should generate Node.js startup script', async () => {
    const options: StartupScriptOptions = {
      runtime: 'nodejs18.x',
      entryPoint: 'app.js',
      builtArtifactsPath: '/build/artifacts'
    };
    
    const result = await generateStartupScript(options);
    
    expect(result).toBe('bootstrap');
    expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/app.js');
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/build/artifacts/bootstrap',
      expect.stringContaining('exec node app.js'),
      'utf8',
      expect.any(Function)
    );
    expect(fs.chmod).toHaveBeenCalledWith(
      '/build/artifacts/bootstrap',
      0o755,
      expect.any(Function)
    );
  });

  test('should generate Python startup script', async () => {
    const options: StartupScriptOptions = {
      runtime: 'python3.9',
      entryPoint: 'app.py',
      builtArtifactsPath: '/build/artifacts'
    };
    
    const result = await generateStartupScript(options);
    
    expect(result).toBe('bootstrap');
    expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/app.py');
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/build/artifacts/bootstrap',
      expect.stringContaining('exec python app.py'),
      'utf8',
      expect.any(Function)
    );
  });

  test('should throw error if entry point does not exist', async () => {
    // Mock fs.existsSync to return false for entry point
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    // Mock fs.readdirSync to return some files
    (fs.readdirSync as jest.Mock).mockReturnValue(['other.js', 'package.json']);
    
    const options: StartupScriptOptions = {
      runtime: 'nodejs18.x',
      entryPoint: 'app.js',
      builtArtifactsPath: '/build/artifacts'
    };
    
    await expect(generateStartupScript(options)).rejects.toThrow(
      'Entry point file not found: /build/artifacts/app.js'
    );
    
    expect(fs.existsSync).toHaveBeenCalledWith('/build/artifacts/app.js');
    expect(fs.readdirSync).toHaveBeenCalledWith('/build/artifacts');
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.chmod).not.toHaveBeenCalled();
  });

  test('should include additional environment variables', async () => {
    const options: StartupScriptOptions = {
      runtime: 'nodejs18.x',
      entryPoint: 'app.js',
      builtArtifactsPath: '/build/artifacts',
      additionalEnv: {
        NODE_ENV: 'production',
        DEBUG: 'app:*'
      }
    };
    
    const result = await generateStartupScript(options);
    
    expect(result).toBe('bootstrap');
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/build/artifacts/bootstrap',
      expect.stringContaining('export NODE_ENV="production"'),
      'utf8',
      expect.any(Function)
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/build/artifacts/bootstrap',
      expect.stringContaining('export DEBUG="app:*"'),
      'utf8',
      expect.any(Function)
    );
  });
});
