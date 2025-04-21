const { generateStartupScript } = require('../../src/deployment/startup-script-generator');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs');
jest.mock('path');

describe('Startup Script Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock path.join to return predictable paths
    path.join.mockImplementation((...args) => args.join('/'));
    
    // Mock fs.existsSync to return true for entry point files
    fs.existsSync.mockReturnValue(true);
    
    // Mock fs.writeFile (promisified version)
    fs.writeFile = jest.fn((path, content, encoding, callback) => {
      callback(null);
    });
    
    // Mock fs.chmod (promisified version)
    fs.chmod = jest.fn((path, mode, callback) => {
      callback(null);
    });
  });

  test('should throw error if entry point does not exist', async () => {
    // Mock fs.existsSync to return false for entry point
    fs.existsSync.mockReturnValue(false);
    
    // Mock fs.readdirSync to return some files
    fs.readdirSync.mockReturnValue(['other.js', 'package.json']);
    
    const options = {
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
});
