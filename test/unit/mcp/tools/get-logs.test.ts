import { handleGetLogs } from '../../../../src/mcp/tools/get-logs';

// Mock AWS SDK without importing the actual module
jest.mock('@aws-sdk/client-cloudwatch-logs', () => {
  return {
    CloudWatchLogsClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({
        events: [
          {
            timestamp: 1672531200000, // 2023-01-01T00:00:00Z
            message: 'Log message 1',
            logStreamName: 'stream-1'
          },
          {
            timestamp: 1672531260000, // 2023-01-01T00:01:00Z
            message: 'Log message 2',
            logStreamName: 'stream-1'
          }
        ]
      })
    })),
    FilterLogEventsCommand: jest.fn()
  };
});

describe('Get Logs Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return logs for a project', async () => {
    const params = {
      projectName: 'test-project',
      region: 'us-east-1',
      logGroupName: '/aws/lambda/test-project',
      startTime: '2023-01-01T00:00:00Z',
      endTime: '2023-01-01T00:10:00Z',
      filterPattern: 'ERROR',
      limit: 100
    };

    const result = await handleGetLogs(params);

    // Verify the result has the expected structure
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty('type', 'text');
    
    // Parse the JSON string in the content
    const logsData = JSON.parse(result.content[0].text);
    expect(logsData).toHaveProperty('success', true);
    expect(logsData).toHaveProperty('logs');
    expect(logsData.logs).toBeInstanceOf(Array);
  });

  test('should handle minimal parameters', async () => {
    const params = {
      projectName: 'test-project',
      region: 'us-east-1'
    };

    const result = await handleGetLogs(params);

    // Verify the result has the expected structure
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    
    // Parse the JSON string in the content
    const logsData = JSON.parse(result.content[0].text);
    expect(logsData).toHaveProperty('success', true);
    expect(logsData).toHaveProperty('logs');
    expect(logsData.logs).toBeInstanceOf(Array);
  });

  test('should handle specific log group name', async () => {
    const params = {
      projectName: 'test-project',
      region: 'us-east-1',
      logGroupName: '/aws/lambda/custom-function'
    };

    const result = await handleGetLogs(params);

    // Verify the result has the expected structure
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    
    // Parse the JSON string in the content
    const logsData = JSON.parse(result.content[0].text);
    expect(logsData).toHaveProperty('success', true);
    expect(logsData).toHaveProperty('logs');
  });
});
