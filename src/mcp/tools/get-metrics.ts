/**
 * Get Metrics Tool Implementation
 * 
 * MCP tool for fetching performance metrics for deployed applications.
 */

import { McpTool } from './index.js';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

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
        content: [
          {
            type: 'text',
            text: 'Missing required parameter: projectName'
          }
        ],
        status: 'error',
        message: 'Missing required parameter: projectName'
      };
    }
    
    // TODO: Implement metrics retrieval logic
    // This would include:
    // 1. Determining the CloudWatch metrics for the resources
    // 2. Fetching metrics from CloudWatch
    // 3. Formatting and returning the metrics
    
    // For now, return a placeholder result with sample metrics
    const metrics = {
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
    };
    
    // Format metrics as content items
    const contentItems = [
      {
        type: 'text',
        text: `Metrics for project ${params.projectName}:`
      },
      {
        type: 'text',
        text: '--- Lambda Metrics ---'
      },
      {
        type: 'text',
        text: `Invocations: ${metrics.lambda.invocations}`
      },
      {
        type: 'text',
        text: `Errors: ${metrics.lambda.errors}`
      },
      {
        type: 'text',
        text: `Average Duration: ${metrics.lambda.duration.average}ms`
      },
      {
        type: 'text',
        text: `P90 Duration: ${metrics.lambda.duration.p90}ms`
      },
      {
        type: 'text',
        text: `P99 Duration: ${metrics.lambda.duration.p99}ms`
      },
      {
        type: 'text',
        text: `Throttles: ${metrics.lambda.throttles}`
      },
      {
        type: 'text',
        text: `Concurrent Executions: ${metrics.lambda.concurrentExecutions}`
      },
      {
        type: 'text',
        text: '--- API Gateway Metrics ---'
      },
      {
        type: 'text',
        text: `Requests: ${metrics.apiGateway.requests}`
      },
      {
        type: 'text',
        text: `Average Latency: ${metrics.apiGateway.latency.average}ms`
      },
      {
        type: 'text',
        text: `P90 Latency: ${metrics.apiGateway.latency.p90}ms`
      },
      {
        type: 'text',
        text: `P99 Latency: ${metrics.apiGateway.latency.p99}ms`
      },
      {
        type: 'text',
        text: `4xx Errors: ${metrics.apiGateway['4xxErrors']}`
      },
      {
        type: 'text',
        text: `5xx Errors: ${metrics.apiGateway['5xxErrors']}`
      }
    ];
    
    return {
      content: contentItems,
      status: 'success',
      message: `Retrieved metrics for project ${params.projectName}`,
      metrics: metrics
    };
  } catch (error) {
    logger.error('Get metrics tool error:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Failed to retrieve metrics: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
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
