/**
 * Get Metrics Tool Implementation
 * 
 * MCP tool for fetching performance metrics for deployed applications.
 */

import { McpTool } from './index.js';
import { z } from 'zod';

/**
 * Get metrics tool handler
 * 
 * @param params - Tool parameters
 * @returns - Tool result
 */
async function handleGetMetrics(params: any): Promise<any> {
  try {
    // Validate required parameters
    if (!params.projectName) {
      return {
        status: 'error',
        message: 'Missing required parameter: projectName'
      };
    }
    
    // TODO: Implement metrics retrieval logic
    // This would include:
    // 1. Determining the CloudWatch metrics for the resources
    // 2. Fetching metrics from CloudWatch
    // 3. Formatting and returning the metrics
    
    // For now, return a placeholder result
    return {
      status: 'success',
      message: `Retrieved metrics for project ${params.projectName}`,
      metrics: {
        lambda: {
          invocations: 100,
          errors: 2,
          duration: {
            average: 120,
            p90: 200,
            p99: 350
          },
          throttles: 0,
          concurrentExecutions: 5
        },
        apiGateway: {
          requests: 150,
          latency: {
            average: 150,
            p90: 250,
            p99: 400
          },
          '4xxErrors': 3,
          '5xxErrors': 1
        }
      }
    };
  } catch (error) {
    console.error('Get metrics tool error:', error);
    return {
      status: 'error',
      message: `Failed to retrieve metrics: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Define Zod schemas for parameter validation
const getMetricsParamsSchema = {
  projectName: z.string().describe('Name of the deployed project'),
  region: z.string().default('us-east-1').describe('AWS region'),
  startTime: z.string().optional().describe('Start time for metrics (ISO format)'),
  endTime: z.string().optional().describe('End time for metrics (ISO format)'),
  period: z.number().default(300).describe('Period in seconds for metrics aggregation'),
  statistics: z.array(z.enum(['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount', 'p90', 'p95', 'p99'])).default(['Average', 'p90', 'p99']).describe('Statistics to retrieve'),
  resources: z.array(z.enum(['lambda', 'apiGateway', 'dynamodb', 'cloudfront', 's3'])).default(['lambda', 'apiGateway']).describe('Resources to get metrics for')
};

/**
 * Get metrics tool definition
 */
const getMetricsTool: McpTool = {
  name: 'get-metrics',
  description: 'Fetch performance metrics for deployed applications',
  parameters: getMetricsParamsSchema,
  handler: handleGetMetrics
};

export default getMetricsTool;
