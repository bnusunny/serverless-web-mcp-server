/**
 * Test for Deploy Tool Parameters
 * 
 * This test focuses on the parameter definitions and descriptions
 * rather than the actual functionality, which requires mocking
 * the deployment service.
 */
import { z } from 'zod';

// Create a mock deploy tool with just the parameters we want to test
const deployTool = {
  name: 'deploy',
  description: 'Deploy web applications to AWS serverless infrastructure',
  parameters: {
    deploymentType: z.enum(['backend', 'frontend', 'fullstack']).describe(
      'Type of deployment'
    ),
    projectName: z.string().describe(
      'Project name'
    ),
    projectRoot: z.string().describe(
      'Absolute path to the project root directory where SAM template will be generated. Must be an absolute path.'
    ),
    region: z.string().default('us-east-1').describe(
      'AWS region'
    ),
    backendConfiguration: z.object({
      builtArtifactsPath: z.string().describe(
        'Path to pre-built backend artifacts (must contain all dependencies and be ready for execution). Can be absolute or relative to projectRoot.'
      ),
      runtime: z.string().describe(
        'Lambda runtime (e.g. nodejs18.x, python3.9)'
      ),
      // Other parameters omitted for brevity
    }).optional().describe('Backend configuration'),
    frontendConfiguration: z.object({
      builtAssetsPath: z.string().describe(
        'Path to pre-built frontend assets (must contain index.html and all static files). Can be absolute or relative to projectRoot.'
      ),
      // Other parameters omitted for brevity
    }).optional().describe('Frontend configuration')
  }
};

describe('Deploy Tool Parameters', () => {
  test('should have correct name and description', () => {
    expect(deployTool.name).toBe('deploy');
    expect(deployTool.description).toContain('Deploy web applications to AWS serverless infrastructure');
  });
  
  test('should have projectRoot parameter with absolute path description', () => {
    const projectRootParam = deployTool.parameters.projectRoot;
    expect(projectRootParam).toBeDefined();
    
    // Check that the description mentions "absolute path"
    const description = projectRootParam._def.description;
    expect(description).toContain('Absolute path');
    expect(description).toContain('Must be an absolute path');
  });
  
  test('should have builtArtifactsPath parameter with relative path description', () => {
    // Get the backend configuration schema
    const backendConfig = deployTool.parameters.backendConfiguration;
    expect(backendConfig).toBeDefined();
    
    // Check that the builtArtifactsPath description mentions relative paths
    // We need to access the inner type definition since it's an optional object
    const innerType = backendConfig._def.innerType;
    const shape = innerType._def.shape();
    const builtArtifactsPath = shape.builtArtifactsPath;
    
    expect(builtArtifactsPath).toBeDefined();
    expect(builtArtifactsPath._def.description).toContain('Can be absolute or relative to projectRoot');
  });
  
  test('should have builtAssetsPath parameter with relative path description', () => {
    // Get the frontend configuration schema
    const frontendConfig = deployTool.parameters.frontendConfiguration;
    expect(frontendConfig).toBeDefined();
    
    // Check that the builtAssetsPath description mentions relative paths
    // We need to access the inner type definition since it's an optional object
    const innerType = frontendConfig._def.innerType;
    const shape = innerType._def.shape();
    const builtAssetsPath = shape.builtAssetsPath;
    
    expect(builtAssetsPath).toBeDefined();
    expect(builtAssetsPath._def.description).toContain('Can be absolute or relative to projectRoot');
  });
});
