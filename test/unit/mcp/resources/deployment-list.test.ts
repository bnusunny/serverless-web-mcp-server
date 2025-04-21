/**
 * Test for Deployment List Resource
 */
import { handleDeploymentList } from '../../../../src/mcp/resources/deloyment-list';

// AWS SDK v3 mocks are set up in test/helpers/setup.js

describe('Deployment List Resource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return a list of deployments', async () => {
    // AWS SDK mock is already set up in setup.js
    const result = await handleDeploymentList({});

    expect(result).toHaveProperty('deployments');
    expect(result.deployments.length).toBeGreaterThan(0);
    expect(result.deployments[0]).toHaveProperty('name');
    expect(result.deployments[0]).toHaveProperty('status');
    expect(result.deployments[0]).toHaveProperty('createdAt');
  });

  test('should handle empty deployment list', async () => {
    // Override the default mock for this test
    const CloudFormationClient = require('@aws-sdk/client-cloudformation').CloudFormationClient;
    CloudFormationClient.prototype.send = jest.fn().mockResolvedValue({
      StackSummaries: []
    });

    const result = await handleDeploymentList({});

    expect(result).toHaveProperty('deployments');
    expect(result.deployments).toHaveLength(0);
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('No deployments found');
  });

  test('should handle errors when listing deployments', async () => {
    // Override the default mock for this test
    const CloudFormationClient = require('@aws-sdk/client-cloudformation').CloudFormationClient;
    CloudFormationClient.prototype.send = jest.fn().mockRejectedValue(
      new Error('Access denied')
    );

    const result = await handleDeploymentList({});

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Failed to list deployments');
  });

  test('should filter deployments by region when specified', async () => {
    const result = await handleDeploymentList({ region: 'eu-west-1' });

    expect(result).toHaveProperty('deployments');
    
    // Verify the CloudFormationClient was created with the specified region
    const CloudFormationClient = require('@aws-sdk/client-cloudformation').CloudFormationClient;
    expect(CloudFormationClient).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'eu-west-1' })
    );
  });
});
