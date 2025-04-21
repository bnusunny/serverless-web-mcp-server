/**
 * Test for Deploy Tool
 */
import { mockDeployApplication, mockLogger } from '../../../mock-utils';

// Mock dependencies
jest.mock('../../../../src/deployment/deploy-service', () => ({
  deployApplication: mockDeployApplication
}));

jest.mock('../../../../src/utils/logger', () => ({
  logger: mockLogger
}));

// Import the tool after mocking dependencies
import deployTool from '../../../../src/mcp/tools/deploy';

describe('Deploy Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
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
    const backendConfig = deployTool.parameters.backendConfiguration;
    const builtArtifactsPath = backendConfig._def.shape().builtArtifactsPath;
    
    expect(builtArtifactsPath).toBeDefined();
    
    // Check that the description mentions it can be relative to projectRoot
    const description = builtArtifactsPath._def.description;
    expect(description).toContain('Can be absolute or relative to projectRoot');
  });
  
  test('should have builtAssetsPath parameter with relative path description', () => {
    const frontendConfig = deployTool.parameters.frontendConfiguration;
    const builtAssetsPath = frontendConfig._def.shape().builtAssetsPath;
    
    expect(builtAssetsPath).toBeDefined();
    
    // Check that the description mentions it can be relative to projectRoot
    const description = builtAssetsPath._def.description;
    expect(description).toContain('Can be absolute or relative to projectRoot');
  });
  
  test('should call deployApplication with provided parameters', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/absolute/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    await deployTool.handler(params);
    
    expect(mockDeployApplication).toHaveBeenCalledWith(params);
  });
  
  test('should return error if projectRoot is missing', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    // Remove projectRoot
    const paramsWithoutRoot = { ...params, projectRoot: undefined };
    
    const result = await deployTool.handler(paramsWithoutRoot);
    
    // Check that the response contains an error about missing projectRoot
    expect(JSON.parse(result.content[0].text)).toEqual(expect.objectContaining({
      success: false,
      message: expect.stringContaining("Project root is required"),
      error: expect.stringContaining("Missing required parameter: projectRoot")
    }));
    
    // Verify deployApplication was not called
    expect(mockDeployApplication).not.toHaveBeenCalled();
  });
  
  test('should return success response when deployment is initiated', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/absolute/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    const result = await deployTool.handler(params);
    const responseText = result.content[0].text;
    const response = JSON.parse(responseText);
    
    expect(response.success).toBe(true);
    expect(response.message).toContain('initiated successfully');
    expect(response.status).toBe('INITIATED');
    expect(response.deploymentId).toBe('test-deployment-id');
  });
  
  test('should handle deployment failure', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/absolute/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    // Mock deployApplication to return failure
    mockDeployApplication.mockResolvedValueOnce({
      success: false,
      status: 'FAILED',
      error: 'Test deployment failure'
    });
    
    const result = await deployTool.handler(params);
    const responseText = result.content[0].text;
    const response = JSON.parse(responseText);
    
    expect(response.success).toBe(false);
    expect(response.message).toContain('failed to initiate');
    expect(response.error).toBe('Test deployment failure');
    expect(response.status).toBe('FAILED');
  });
  
  test('should handle exceptions during deployment', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/absolute/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: 'backend/dist',
        runtime: 'nodejs18.x'
      }
    };
    
    // Mock deployApplication to throw an error
    mockDeployApplication.mockRejectedValueOnce(new Error('Unexpected error'));
    
    const result = await deployTool.handler(params);
    const responseText = result.content[0].text;
    const response = JSON.parse(responseText);
    
    expect(response.success).toBe(false);
    expect(response.message).toContain('Deployment failed');
    expect(response.error).toBe('Unexpected error');
    
    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Deploy tool error',
      expect.objectContaining({
        error: 'Unexpected error'
      })
    );
  });
});
