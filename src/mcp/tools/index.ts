/**
 * Tool implementations for the MCP server
 */

import { handleDeploy } from './deploy.js';
import { handleConfigureDomain } from './configure-domain.js';
import { handleProvisionDatabase } from './provision-database.js';
import { handleGetLogs } from './get-logs.js';
import { handleGetMetrics } from './get-metrics.js';
import { z } from 'zod';

// Export tool handlers
export {
  handleDeploy,
  handleConfigureDomain,
  handleProvisionDatabase,
  handleGetLogs,
  handleGetMetrics
};

// Define tool definitions
export const toolDefinitions = [
  {
    name: 'deploy',
    description: 'Deploy web applications to AWS serverless infrastructure',
    handler: handleDeploy,
    parameters: z.object({
      deploymentType: z.enum(['backend', 'frontend', 'fullstack']).describe('Type of deployment'),
      projectName: z.string().describe('Project name'),
      projectRoot: z.string().describe('Path to the project root directory'),
      region: z.string().optional().default('us-east-1').describe('AWS region, default to "us-east-1"'),
      backendConfiguration: z.object({
        builtArtifactsPath: z.string().describe('Path to pre-built backend artifacts'),
        framework: z.string().optional().describe('Backend framework'),
        runtime: z.string().describe('Lambda runtime'),
        startupScript: z.string().describe('Name of the startup script file (must be executable in Lambda (Linux) environment and take no parameters)'),
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
              type: z.enum(['S', 'N', 'B']).describe('Attribute type')
            })
          ).describe('DynamoDB attribute definitions'),
          keySchema: z.array(
            z.object({
              name: z.string().describe('Attribute name'),
              type: z.enum(['HASH', 'RANGE']).describe('Key type')
            })
          ).describe('DynamoDB key schema'),
          billingMode: z.enum(['PROVISIONED', 'PAY_PER_REQUEST']).optional().default('PAY_PER_REQUEST').describe('DynamoDB billing mode'),
          readCapacity: z.number().optional().describe('Read capacity units (for PROVISIONED)'),
          writeCapacity: z.number().optional().describe('Write capacity units (for PROVISIONED)')
        }).optional().describe('Database configuration')
      }).optional().describe('Backend configuration'),
      frontendConfiguration: z.object({
        builtAssetsPath: z.string().describe('Path to pre-built frontend assets'),
        framework: z.string().optional().describe('Frontend framework'),
        indexDocument: z.string().optional().default('index.html').describe('Index document'),
        errorDocument: z.string().optional().describe('Error document'),
        customDomain: z.string().optional().describe('Custom domain'),
        certificateArn: z.string().optional().describe('ACM certificate ARN')
      }).optional().describe('Frontend configuration')
    })
  },
  {
    name: 'configure_domain',
    description: 'Set up custom domains and SSL certificates for deployed applications',
    handler: handleConfigureDomain,
    parameters: z.object({
      projectName: z.string().describe('Name of the deployed project'),
      domainName: z.string().describe('Custom domain name to configure'),
      region: z.string().optional().default('us-east-1').describe('AWS region'),
      createCertificate: z.boolean().optional().default(true).describe('Whether to create a new ACM certificate'),
      certificateArn: z.string().optional().describe('Existing ACM certificate ARN (if not creating a new one)'),
      hostedZoneId: z.string().optional().describe('Route53 hosted zone ID (if using Route53)')
    })
  },
  {
    name: 'provision_database',
    description: 'Create and configure database resources for applications',
    handler: handleProvisionDatabase,
    parameters: z.object({
      projectName: z.string().describe('Name of the project'),
      databaseType: z.enum(['dynamodb', 'aurora-serverless']).describe('Type of database to provision'),
      region: z.string().optional().default('us-east-1').describe('AWS region'),
      tableName: z.string().describe('DynamoDB table name'),
      attributeDefinitions: z.array(
        z.object({
          name: z.string().describe('Attribute name'),
          type: z.enum(['S', 'N', 'B']).describe('Attribute type')
        })
      ).describe('DynamoDB attribute definitions'),
      keySchema: z.array(
        z.object({
          name: z.string().describe('Attribute name'),
          type: z.enum(['HASH', 'RANGE']).describe('Key type')
        })
      ).describe('DynamoDB key schema'),
      billingMode: z.enum(['PROVISIONED', 'PAY_PER_REQUEST']).optional().default('PAY_PER_REQUEST').describe('DynamoDB billing mode'),
      readCapacity: z.number().optional().describe('Read capacity units (for PROVISIONED)'),
      writeCapacity: z.number().optional().describe('Write capacity units (for PROVISIONED)'),
      databaseName: z.string().describe('Database name'),
      engine: z.enum(['aurora-mysql', 'aurora-postgresql']).optional().default('aurora-postgresql').describe('Database engine'),
      username: z.string().optional().default('admin').describe('Master username'),
      password: z.string().optional().describe('Master password (if not provided, will be generated)'),
      minCapacity: z.number().optional().default(1).describe('Minimum ACU capacity'),
      maxCapacity: z.number().optional().default(8).describe('Maximum ACU capacity'),
      backupRetentionPeriod: z.number().optional().default(7).describe('Backup retention period in days')
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
  }
];
