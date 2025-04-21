// test/unit/deployment/deploy-service-internal.test.ts
// This file tests the internal functions of the deploy-service module

// Import the actual module to access non-exported functions
import { generateStartupScript } from '../../../src/deployment/deploy-service';

describe('Deploy Service Internal Functions', () => {
  describe('generateStartupScript', () => {
    test('should generate startup script for nodejs runtime', () => {
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'test-project',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'nodejs18.x',
          entryPoint: 'app.js',
          generateStartupScript: true
        }
      };
      
      // Call the function
      const result = generateStartupScript(params);
      
      // Verify the result
      expect(result).toBe('node app.js');
    });

    test('should generate startup script for python runtime', () => {
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'test-project',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'python3.9',
          entryPoint: 'app.py',
          generateStartupScript: true
        }
      };
      
      // Call the function
      const result = generateStartupScript(params);
      
      // Verify the result
      expect(result).toBe('python app.py');
    });

    test('should generate startup script for ruby runtime', () => {
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'test-project',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'ruby2.7',
          entryPoint: 'app.rb',
          generateStartupScript: true
        }
      };
      
      // Call the function
      const result = generateStartupScript(params);
      
      // Verify the result
      expect(result).toBe('ruby app.rb');
    });

    test('should throw error for unsupported runtime when generating startup script', () => {
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'test-project',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'unsupported',
          entryPoint: 'app.js',
          generateStartupScript: true
        }
      };
      
      // Call the function and expect it to throw
      expect(() => generateStartupScript(params)).toThrow('Cannot generate startup script for runtime: unsupported');
    });

    test('should use provided startup script if available', () => {
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'test-project',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'nodejs18.x',
          startupScript: 'custom-bootstrap.sh',
          entryPoint: 'app.js',
          generateStartupScript: true
        }
      };
      
      // Call the function
      const result = generateStartupScript(params);
      
      // Verify the result - should use the provided startup script
      expect(result).toBe('custom-bootstrap.sh');
    });

    test('should return undefined if no startup script is needed', () => {
      // Test parameters
      const params = {
        deploymentType: 'backend',
        projectName: 'test-project',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        backendConfiguration: {
          builtArtifactsPath: 'backend/dist',
          runtime: 'nodejs18.x',
          // No startupScript or generateStartupScript
        }
      };
      
      // Call the function
      const result = generateStartupScript(params);
      
      // Verify the result
      expect(result).toBeUndefined();
    });

    test('should return undefined if backendConfiguration is not provided', () => {
      // Test parameters
      const params = {
        deploymentType: 'frontend',
        projectName: 'test-project',
        projectRoot: '/path/to/project',
        region: 'us-east-1',
        // No backendConfiguration
      };
      
      // Call the function
      const result = generateStartupScript(params);
      
      // Verify the result
      expect(result).toBeUndefined();
    });
  });
});
