import { handleGetMetrics } from '../../../../src/mcp/tools/get-metrics';

// No need to mock AWS SDK as the implementation is a placeholder

describe('Get Metrics Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return sample metrics data', async () => {
    const params = {
      projectName: 'test-project',
      region: 'us-east-1',
      resources: ['lambda'],
      startTime: '2023-01-01T00:00:00Z',
      endTime: '2023-01-01T00:10:00Z',
      period: 300,
      statistics: ['Average', 'p90']
    };

    const result = await handleGetMetrics(params);

    // Verify the result has the expected structure
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty('type', 'text');
    
    // Parse the JSON string in the content
    const metricsData = JSON.parse(result.content[0].text);
    expect(metricsData).toHaveProperty('success', true);
    
    // The implementation returns sample data, so we just verify it has some metrics
    expect(metricsData).toHaveProperty('metrics');
  });

  test('should handle minimal parameters', async () => {
    const params = {
      projectName: 'test-project',
      region: 'us-east-1'
    };

    const result = await handleGetMetrics(params);

    // Verify the result has the expected structure
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    
    // Parse the JSON string in the content
    const metricsData = JSON.parse(result.content[0].text);
    expect(metricsData).toHaveProperty('success', true);
    expect(metricsData).toHaveProperty('metrics');
  });

  test('should handle multiple resource types', async () => {
    const params = {
      projectName: 'test-project',
      region: 'us-east-1',
      resources: ['lambda', 'apiGateway', 'dynamodb', 's3', 'cloudfront']
    };

    const result = await handleGetMetrics(params);

    // Verify the result has the expected structure
    expect(result).toHaveProperty('content');
    
    // Parse the JSON string in the content
    const metricsData = JSON.parse(result.content[0].text);
    expect(metricsData).toHaveProperty('success', true);
    expect(metricsData).toHaveProperty('metrics');
  });
});
