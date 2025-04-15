/**
 * Deploy Tool Implementation
 * 
 * MCP tool for deploying web applications to AWS serverless infrastructure.
 */

import { deploy } from '../../deployment/deploy-service.js';
import { DeployToolParams, DeployToolResult } from '../../types/index.js';
import { McpTool } from '../tools/index.js';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

/**
 * Deploy tool handler
 * 
 * @param params - Tool parameters
 * @returns - Tool result
 */
async function handleDeploy(params: DeployToolParams): Promise<any> {
  try {
    // Validate required parameters
    if (!params.deploymentType) {
      return {
        content: [],
        status: 'error',
        message: 'Missing required parameter: deploymentType'
      };
    }
    
    if (!params.source || !params.source.path) {
      return {
        content: [],
        status: 'error',
        message: 'Missing required parameter: source.path'
      };
    }
    
    if (!params.configuration || !params.configuration.projectName) {
      return {
        content: [],
        status: 'error',
        message: 'Missing required parameter: configuration.projectName'
      };
    }
    
    // Prompt for framework if not provided
    if (!params.framework && !params.configuration.backendConfiguration?.framework) {
      return {
        content: [],
        status: 'needs_input',
        message: 'Please specify the web framework being used (e.g., express, flask, fastapi, nextjs)',
        inputKey: 'framework'
      };
    }
    
    // Prompt for entry point if not provided
    if ((params.deploymentType === 'backend' || params.deploymentType === 'fullstack') && 
        !params.configuration.backendConfiguration?.entryPoint) {
      return {
        content: [],
        status: 'needs_input',
        message: 'Please specify the entry point for your application (e.g., app.js, app.py, main:app)',
        inputKey: 'entryPoint',
        context: 'This will be used to generate the bootstrap file for Lambda Web Adapter.'
      };
    }
    
    // Set framework in configuration if provided as top-level parameter
    if (params.framework && params.configuration.backendConfiguration) {
      params.configuration.backendConfiguration.framework = params.framework;
    }
    
    // Set entry point in configuration if provided as input
    if (params.entryPoint && params.configuration.backendConfiguration) {
      params.configuration.backendConfiguration.entryPoint = params.entryPoint;
    }
    
    // Deploy application
    const result = await deploy(params);
    
    // Format outputs as content items for MCP protocol
    const contentItems = [];
    
    // Add main deployment result
    contentItems.push({
      type: 'text',
      text: `Deployment ${result.status}: ${result.message}`
    });
    
    // Add outputs as separate content items
    if (result.outputs && Object.keys(result.outputs).length > 0) {
      for (const [key, value] of Object.entries(result.outputs)) {
        contentItems.push({
          type: 'text',
          text: `${key}: ${value}`
        });
      }
    }
    
    return {
      content: contentItems,
      status: result.status,
      message: result.message,
      outputs: result.outputs,
      stackName: result.stackName
    };
  } catch (error) {
    logger.error('Deploy tool error:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Deployment failed: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      status: 'error',
      message: `Deployment failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Define Zod schemas for parameter validation
const deploymentTypeSchema = z.enum(['backend', 'frontend', 'fullstack']);

const sourceSchema = z.object({
  path: z.string().describe('Path to source code')
}).describe('Source code location');

const backendConfigSchema = z.object({
  runtime: z.string().default('nodejs18.x').describe('Lambda runtime'),
  framework: z.string().optional().describe('Backend framework'),
  entryPoint: z.string().optional().describe('Entry point file or module'),
  memorySize: z.number().default(512).describe('Lambda memory size'),
  timeout: z.number().default(30).describe('Lambda timeout'),
  architecture: z.enum(['x86_64', 'arm64']).default('x86_64').describe('Lambda architecture'),
  stage: z.string().default('prod').describe('API Gateway stage'),
  cors: z.boolean().default(true).describe('Enable CORS'),
  environment: z.record(z.string()).optional().describe('Environment variables')
}).describe('Backend configuration');

const frontendConfigSchema = z.object({
  type: z.enum(['static', 'react', 'vue', 'angular', 'nextjs']).default('static').describe('Frontend type'),
  indexDocument: z.string().default('index.html').describe('Index document'),
  errorDocument: z.string().default('error.html').describe('Error document'),
  customDomain: z.string().optional().describe('Custom domain'),
  certificateArn: z.string().optional().describe('ACM certificate ARN')
}).describe('Frontend configuration');

const attributeDefSchema = z.object({
  name: z.string().describe('Attribute name'),
  type: z.enum(['S', 'N', 'B']).describe('Attribute type')
});

const keySchemaSchema = z.object({
  name: z.string().describe('Attribute name'),
  type: z.enum(['HASH', 'RANGE']).describe('Key type')
});

const databaseConfigSchema = z.object({
  tableName: z.string().describe('DynamoDB table name'),
  billingMode: z.enum(['PROVISIONED', 'PAY_PER_REQUEST']).default('PAY_PER_REQUEST').describe('DynamoDB billing mode'),
  attributeDefinitions: z.array(attributeDefSchema).describe('DynamoDB attribute definitions'),
  keySchema: z.array(keySchemaSchema).describe('DynamoDB key schema'),
  readCapacity: z.number().optional().describe('Read capacity units (for PROVISIONED)'),
  writeCapacity: z.number().optional().describe('Write capacity units (for PROVISIONED)')
}).describe('Database configuration');

const configurationSchema = z.object({
  projectName: z.string().describe('Project name'),
  region: z.string().default('us-east-1').describe('AWS region'),
  backendConfiguration: backendConfigSchema.optional(),
  frontendConfiguration: frontendConfigSchema.optional(),
  databaseConfiguration: databaseConfigSchema.optional()
}).describe('Deployment configuration');

// Define the parameters schema for the deploy tool
const deployParamsSchema = {
  deploymentType: deploymentTypeSchema.describe('Type of deployment (backend, frontend, fullstack)'),
  source: sourceSchema,
  framework: z.string().optional().describe('Web framework (express, flask, fastapi, nextjs, etc.)'),
  entryPoint: z.string().optional().describe('Entry point for the application'),
  configuration: configurationSchema
};

/**
 * Deploy tool definition
 */
const deployTool: McpTool = {
  name: 'deploy',
  description: 'Deploy web applications to AWS serverless infrastructure',
  parameters: deployParamsSchema,
  handler: handleDeploy
};

export default deployTool;
