/**
 * Test for Startup Script Generator
 */
const { generateStartupScript } = require('../../../src/deployment/startup-script-generator');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  chmodSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true)
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

describe('Startup Script Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should generate Node.js startup script', async () => {
    const options = {
      runtime: 'nodejs18.x',
      entryPoint: 'app.js',
      builtArtifactsPath: '/build/artifacts'
    };
    
    const result = await generateStartupScript(options);
    
    expect(result).toBe('/build/artifacts/bootstrap');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/build/artifacts/bootstrap',
      expect.stringContaining('node app.js'),
      { mode: 0o755 }
    );
  });
  
  test('should generate Python startup script', async () => {
    const options = {
      runtime: 'python3.9',
      entryPoint: 'app.py',
      builtArtifactsPath: '/build/artifacts'
    };
    
    const result = await generateStartupScript(options);
    
    expect(result).toBe('/build/artifacts/bootstrap');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/build/artifacts/bootstrap',
      expect.stringContaining('python app.py'),
      { mode: 0o755 }
    );
  });
  
  test('should generate Ruby startup script', async () => {
    const options = {
      runtime: 'ruby3.2',
      entryPoint: 'app.rb',
      builtArtifactsPath: '/build/artifacts'
    };
    
    const result = await generateStartupScript(options);
    
    expect(result).toBe('/build/artifacts/bootstrap');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/build/artifacts/bootstrap',
      expect.stringContaining('ruby app.rb'),
      { mode: 0o755 }
    );
  });
  
  test('should throw error for unsupported runtime', async () => {
    const options = {
      runtime: 'unsupported-runtime',
      entryPoint: 'app.js',
      builtArtifactsPath: '/build/artifacts'
    };
    
    await expect(generateStartupScript(options)).rejects.toThrow(
      'Unsupported runtime for startup script generation: unsupported-runtime'
    );
  });
  
  test('should throw error when entryPoint is missing', async () => {
    const options = {
      runtime: 'nodejs18.x',
      builtArtifactsPath: '/build/artifacts'
    };
    
    await expect(generateStartupScript(options)).rejects.toThrow(
      'Entry point is required for startup script generation'
    );
  });
  
  test('should throw error when builtArtifactsPath is missing', async () => {
    const options = {
      runtime: 'nodejs18.x',
      entryPoint: 'app.js'
    };
    
    await expect(generateStartupScript(options)).rejects.toThrow(
      'Built artifacts path is required for startup script generation'
    );
  });
  
  test('should throw error when builtArtifactsPath does not exist', async () => {
    // Mock fs.existsSync to return false
    fs.existsSync.mockReturnValue(false);
    
    const options = {
      runtime: 'nodejs18.x',
      entryPoint: 'app.js',
      builtArtifactsPath: '/non-existent/path'
    };
    
    await expect(generateStartupScript(options)).rejects.toThrow(
      'Built artifacts path does not exist: /non-existent/path'
    );
  });
});
