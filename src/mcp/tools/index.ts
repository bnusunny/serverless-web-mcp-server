/**
 * Tool implementations for the MCP server
 */

import { handleDeploy } from './deploy.js';
import { handleGetLogs } from './get-logs.js';
import { handleGetMetrics } from './get-metrics.js';
import { handleDeploymentHelp } from './deployment-help.js';
import { handleValidationHelp } from './validation-help.js';
import { z } from 'zod';

// Export tool handlers
export {
  handleDeploy,
  handleGetLogs,
  handleGetMetrics,
  handleDeploymentHelp,
  handleValidationHelp
};

// Define tool definitions
export const toolDefinitions = [
  {
    name: 'deploy',
    description: 'Deploy web applications to AWS serverless infrastructure. Can also create and configure database resources like DynamoDB tables.',
    handler: handleDeploy,
    parameters: z.object({
      deploymentType: z.enum(['backend', 'frontend', 'fullstack']).describe('Type of deployment'),
      projectName: z.string().describe('Project name'),
      projectRoot: z.string().describe('Path to the project root directory where SAM template will be generated'),
      region: z.string().optional().default('us-east-1').describe('AWS region'),
      backendConfiguration: z.object({
        builtArtifactsPath: z.string().describe('Path to pre-built backend artifacts (must contain all dependencies and be ready for execution)'),
        framework: z.string().optional().describe('Backend framework'),
        runtime: z.string().describe('Lambda runtime (e.g. nodejs18.x, python3.9)'),
        startupScript: z.string().describe('Startup script that must be executable in Linux environment (chmod +x) and take no parameters. This is the entry point for your application.'),
        architecture: z.enum(['x86_64', 'arm64']).optional().default('x86_64').describe('Lambda architecture'),
        memorySize: z.number().optional().default(512).describe('Lambda memory size'),
        timeout: z.number().optional().default(30).describe('Lambda timeout'),
        stage: z.string().optional().default('prod').describe('API Gateway stage'),
        cors: z.boolean().optional().default(true).describe('Enable CORS'),
        environment: z.record(z.string()).optional().describe('Environment variables'),
        databaseConfiguration: z.object({
          tableName: z.string().describe('DynamoDB table name'),
          attributeDefinitions: z.array(
            z.object({
              name: z.string().describe('Attribute name'),
              type: z.enum(['S', 'N', 'B']).describe('Attribute type (S=String, N=Number, B=Binary)')
            })
          ).describe('DynamoDB attribute definitions'),
          keySchema: z.array(
            z.object({
              name: z.string().describe('Attribute name'),
              type: z.enum(['HASH', 'RANGE']).describe('Key type (HASH=partition key, RANGE=sort key)')
            })
          ).describe('DynamoDB key schema'),
          billingMode: z.enum(['PROVISIONED', 'PAY_PER_REQUEST']).optional().default('PAY_PER_REQUEST').describe('DynamoDB billing mode'),
          readCapacity: z.number().optional().describe('Read capacity units (for PROVISIONED)'),
          writeCapacity: z.number().optional().describe('Write capacity units (for PROVISIONED)')
        }).optional().describe('Database configuration for creating DynamoDB tables')
      }).optional().describe('Backend configuration'),
      frontendConfiguration: z.object({
        builtAssetsPath: z.string().describe('Path to pre-built frontend assets (must contain index.html and all static files)'),
        framework: z.string().optional().describe('Frontend framework'),
        indexDocument: z.string().optional().default('index.html').describe('Index document'),
        errorDocument: z.string().optional().describe('Error document'),
        customDomain: z.string().optional().describe('Custom domain'),
        certificateArn: z.string().optional().describe('ACM certificate ARN')
      }).optional().describe('Frontend configuration')
    })
  },
  {
    name: 'validate_deployment',
    description: 'Validate deployment configuration without actually deploying',
    handler: handleValidationHelp,
    parameters: z.object({
      deploymentType: z.enum(['backend', 'frontend', 'fullstack']).describe('Type of deployment'),
      projectName: z.string().describe('Project name'),
      projectRoot: z.string().describe('Path to the project root directory where SAM template will be generated'),
      region: z.string().optional().default('us-east-1').describe('AWS region'),
      backendConfiguration: z.object({
        builtArtifactsPath: z.string().describe('Path to pre-built backend artifacts (must contain all dependencies and be ready for execution)'),
        framework: z.string().optional().describe('Backend framework'),
        runtime: z.string().describe('Lambda runtime (e.g. nodejs18.x, python3.9)'),
        startupScript: z.string().describe('Startup script that must be executable in Linux environment (chmod +x) and take no parameters. This is the entry point for your application.'),
        architecture: z.enum(['x86_64', 'arm64']).optional().default('x86_64').describe('Lambda architecture'),
        memorySize: z.number().optional().default(512).describe('Lambda memory size'),
        timeout: z.number().optional().default(30).describe('Lambda timeout'),
        stage: z.string().optional().default('prod').describe('API Gateway stage'),
        cors: z.boolean().optional().default(true).describe('Enable CORS'),
        environment: z.record(z.string()).optional().describe('Environment variables'),
        databaseConfiguration: z.object({
          tableName: z.string().describe('DynamoDB table name'),
          attributeDefinitions: z.array(
            z.object({
              name: z.string().describe('Attribute name'),
              type: z.enum(['S', 'N', 'B']).describe('Attribute type (S=String, N=Number, B=Binary)')
            })
          ).describe('DynamoDB attribute definitions'),
          keySchema: z.array(
            z.object({
              name: z.string().describe('Attribute name'),
              type: z.enum(['HASH', 'RANGE']).describe('Key type (HASH=partition key, RANGE=sort key)')
            })
          ).describe('DynamoDB key schema'),
          billingMode: z.enum(['PROVISIONED', 'PAY_PER_REQUEST']).optional().default('PAY_PER_REQUEST').describe('DynamoDB billing mode'),
          readCapacity: z.number().optional().describe('Read capacity units (for PROVISIONED)'),
          writeCapacity: z.number().optional().describe('Write capacity units (for PROVISIONED)')
        }).optional().describe('Database configuration for creating DynamoDB tables')
      }).optional().describe('Backend configuration'),
      frontendConfiguration: z.object({
        builtAssetsPath: z.string().describe('Path to pre-built frontend assets (must contain index.html and all static files)'),
        framework: z.string().optional().describe('Frontend framework'),
        indexDocument: z.string().optional().default('index.html').describe('Index document'),
        errorDocument: z.string().optional().describe('Error document'),
        customDomain: z.string().optional().describe('Custom domain'),
        certificateArn: z.string().optional().describe('ACM certificate ARN')
      }).optional().describe('Frontend configuration')
    })
  },
  {
    name: 'get_logs',
    description: 'Retrieve application logs from CloudWatch',
    handler: handleGetLogs,
    parameters: z.object({
      projectName: z.string().describe('Name of the deployed project'),
      region: z.string().optional().default('us-east-1').describe('AWS region'),
      logGroupName: z.string().optional().describe('Specific log group name (if known)'),
      filterPattern: z.string().optional().describe('CloudWatch Logs filter pattern'),
      startTime: z.string().optional().describe('Start time for logs (ISO format)'),
      endTime: z.string().optional().describe('End time for logs (ISO format)'),
      limit: z.number().optional().default(100).describe('Maximum number of log entries to retrieve')
    })
  },
  {
    name: 'get_metrics',
    description: 'Fetch performance metrics for deployed applications',
    handler: handleGetMetrics,
    parameters: z.object({
      projectName: z.string().describe('Name of the deployed project'),
      region: z.string().optional().default('us-east-1').describe('AWS region'),
      resources: z.array(
        z.enum(['lambda', 'apiGateway', 'dynamodb', 'cloudfront', 's3'])
      ).optional().default(['lambda', 'apiGateway']).describe('Resources to get metrics for'),
      startTime: z.string().optional().describe('Start time for metrics (ISO format)'),
      endTime: z.string().optional().describe('End time for metrics (ISO format)'),
      period: z.number().optional().default(300).describe('Period in seconds for metrics aggregation'),
      statistics: z.array(
        z.enum(['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount', 'p90', 'p95', 'p99'])
      ).optional().default(['Average', 'p90', 'p99']).describe('Statistics to retrieve')
    })
  },
  {
    name: 'deployment_help',
    description: 'Get help with deployment requirements and troubleshooting',
    handler: handleDeploymentHelp,
    parameters: z.object({
      topic: z.enum(['startup_script', 'artifacts_path', 'permissions', 'project_structure', 'database', 'general']).describe('Help topic')
    })
  }
];
