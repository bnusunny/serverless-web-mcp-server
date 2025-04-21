// test/unit/mcp/resources/deployment-details.test.ts
import { handleDeploymentDetails } from '../../../../src/mcp/resources/deployment-details';

// Import the mocked modules
const deployService = require('../../../../src/deployment/deploy-service.js');
const logger = require('../../../../src/utils/logger.js');

describe('Deployment Details Resource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return deployment details when deployment exists', async () => {
    // Mock deployment service to return deployment details
    const mockDeployment = {
      success: true,
      url: 'https://test-project.example.com',
      resources: {
        apiGateway: 'https://test-project-api.example.com',
        lambda: 'test-project-lambda',
        s3Bucket: 'test-project-bucket',
        cloudFront: 'test-project-distribution'
      },
      outputs: {
        ApiEndpoint: 'https://test-project-api.example.com',
        WebsiteURL: 'https://test-project.example.com'
      },
      status: 'COMPLETE',
      stackName: 'test-project-123456',
      deploymentId: 'deploy-1234567890'
    };
    
    deployService.getDeploymentStatus.mockReturnValue(mockDeployment);
    
    // Test parameters
    const params = {
      projectName: 'test-project'
    };
    
    // Call the handler
    const result = await handleDeploymentDetails(params);
    
    // Verify the response
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    
    // Parse the JSON response
    const responseJson = JSON.parse(result.content[0].text);
    
    // Verify the response content
    expect(responseJson).toHaveProperty('projectName', 'test-project');
    expect(responseJson).toHaveProperty('status', 'COMPLETE');
    expect(responseJson).toHaveProperty('success', true);
    expect(responseJson).toHaveProperty('deploymentUrl', 'https://test-project.example.com');
    expect(responseJson).toHaveProperty('resources');
    expect(responseJson).toHaveProperty('outputs');
    expect(responseJson).toHaveProperty('stackName', 'test-project-123456');
    expect(responseJson).toHaveProperty('deploymentId', 'deploy-1234567890');
    
    // Verify the deployment service was called with the correct parameters
    expect(deployService.getDeploymentStatus).toHaveBeenCalledWith('test-project');
  });

  test('should return error when deployment does not exist', async () => {
    // Mock deployment service to return null (deployment not found)
    deployService.getDeploymentStatus.mockReturnValue(null);
    
    // Test parameters
    const params = {
      projectName: 'nonexistent-project'
    };
    
    // Call the handler
    const result = await handleDeploymentDetails(params);
    
    // Verify the response
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    
    // Parse the JSON response
    const responseJson = JSON.parse(result.content[0].text);
    
    // Verify the response content
    expect(responseJson).toHaveProperty('error');
    expect(responseJson.error).toContain('Deployment not found');
    expect(responseJson).toHaveProperty('message');
    expect(responseJson.message).toContain('No deployment information available');
    
    // Verify the deployment service was called with the correct parameters
    expect(deployService.getDeploymentStatus).toHaveBeenCalledWith('nonexistent-project');
  });

  test('should return in-progress status for deployment in progress', async () => {
    // Mock deployment service to return an in-progress deployment
    const mockDeployment = {
      success: false,
      url: '',
      resources: {},
      status: 'BUILDING',
      stackName: 'test-project-123456',
      deploymentId: 'deploy-1234567890'
    };
    
    deployService.getDeploymentStatus.mockReturnValue(mockDeployment);
    
    // Test parameters
    const params = {
      projectName: 'test-project'
    };
    
    // Call the handler
    const result = await handleDeploymentDetails(params);
    
    // Verify the response
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    
    // Parse the JSON response
    const responseJson = JSON.parse(result.content[0].text);
    
    // Verify the response content
    expect(responseJson).toHaveProperty('projectName', 'test-project');
    expect(responseJson).toHaveProperty('status', 'BUILDING');
    expect(responseJson).toHaveProperty('message');
    expect(responseJson.message).toContain('Deployment is currently in progress');
    expect(responseJson).toHaveProperty('stackName', 'test-project-123456');
    expect(responseJson).toHaveProperty('deploymentId', 'deploy-1234567890');
    expect(responseJson).toHaveProperty('note');
    expect(responseJson.note).toContain('Check this resource again');
  });

  test('should return failed status for failed deployment', async () => {
    // Mock deployment service to return a failed deployment
    const mockDeployment = {
      success: false,
      url: '',
      resources: {},
      error: 'SAM build failed with code 1',
      status: 'FAILED',
      stackName: 'test-project-123456',
      deploymentId: 'deploy-1234567890'
    };
    
    deployService.getDeploymentStatus.mockReturnValue(mockDeployment);
    
    // Test parameters
    const params = {
      projectName: 'test-project'
    };
    
    // Call the handler
    const result = await handleDeploymentDetails(params);
    
    // Verify the response
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    
    // Parse the JSON response
    const responseJson = JSON.parse(result.content[0].text);
    
    // Verify the response content
    expect(responseJson).toHaveProperty('projectName', 'test-project');
    expect(responseJson).toHaveProperty('status', 'FAILED');
    expect(responseJson).toHaveProperty('success', false);
    expect(responseJson).toHaveProperty('error', 'SAM build failed with code 1');
    expect(responseJson).toHaveProperty('stackName', 'test-project-123456');
    expect(responseJson).toHaveProperty('deploymentId', 'deploy-1234567890');
  });

  test('should handle errors during processing', async () => {
    // Mock deployment service to throw an error
    const mockError = new Error('Unexpected error');
    deployService.getDeploymentStatus.mockImplementation(() => {
      throw mockError;
    });
    
    // Test parameters
    const params = {
      projectName: 'test-project'
    };
    
    // Call the handler
    const result = await handleDeploymentDetails(params);
    
    // Verify the response
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    
    // Parse the JSON response
    const responseJson = JSON.parse(result.content[0].text);
    
    // Verify the response content
    expect(responseJson).toHaveProperty('error');
    expect(responseJson.error).toContain('Failed to get deployment details');
    
    // Verify the logger was called with the error
    expect(logger.logger.error).toHaveBeenCalledWith('Deployment details resource error', {
      error: 'Unexpected error',
      stack: expect.any(String)
    });
  });
});
