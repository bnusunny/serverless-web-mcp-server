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
    logger.info(`[DEPLOY TOOL START] Received deploy request for ${params.configuration?.projectName || 'unknown project'}`);
    logger.info(`Deploy parameters: ${JSON.stringify(params, null, 2)}`);
    
    // Validate required parameters
    if (!params.deploymentType) {
      logger.error('Missing required parameter: deploymentType');
      return {
        content: [],
        status: 'error',
        message: 'Missing required parameter: deploymentType'
      };
    }
    
    if (!params.source || !params.source.path) {
      logger.error('Missing required parameter: source.path');
      return {
        content: [],
        status: 'error',
        message: 'Missing required parameter: source.path'
      };
    }
    
    if (!params.configuration || !params.configuration.projectName) {
      logger.error('Missing required parameter: configuration.projectName');
      return {
        content: [],
        status: 'error',
        message: 'Missing required parameter: configuration.projectName'
      };
    }
    
    // Prompt for framework if not provided
    if (!params.framework && !params.configuration.backendConfiguration?.framework) {
      logger.info('Framework not provided, requesting input');
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
      logger.info('Entry point not provided, requesting input');
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
      logger.info(`Setting framework in configuration: ${params.framework}`);
      params.configuration.backendConfiguration.framework = params.framework;
    }
    
    // Set entry point in configuration if provided as input
    if (params.entryPoint && params.configuration.backendConfiguration) {
      logger.info(`Setting entry point in configuration: ${params.entryPoint}`);
      params.configuration.backendConfiguration.entryPoint = params.entryPoint;
    }
    
    // Add default backend configuration if not provided
    if ((params.deploymentType === 'backend' || params.deploymentType === 'fullstack') && 
        !params.configuration.backendConfiguration) {
      logger.info('Adding default backend configuration');
      params.configuration.backendConfiguration = {
        runtime: 'nodejs18.x',
        memorySize: 512,
        timeout: 30,
        architecture: 'x86_64',
        stage: 'prod',
        cors: true
      };
    }
    
    logger.info(`[DEPLOY TOOL] Preparing to start deployment for ${params.configuration.projectName}`);
    
    // Create a response object immediately
    const response = {
      content: [
        {
          type: 'text',
          text: `Starting deployment of ${params.deploymentType} application ${params.configuration.projectName}. This may take several minutes.`
        },
        {
          type: 'text',
          text: `You can check the status with the deployment:${params.configuration.projectName} resource.`
        }
      ],
      status: 'preparing',
      message: `Deployment preparation started. Check status with deployment:${params.configuration.projectName} resource.`,
      stackName: params.configuration.projectName
    };
    
    // Start the deployment process in the background using setTimeout with 0ms delay
    // This ensures the event loop completes and the response is sent to the client
    // before starting the long-running deployment process
    setTimeout(async () => {
      try {
        logger.info(`[DEPLOY TOOL] Starting deployment process for ${params.configuration.projectName} in background`);
        const result = await deploy(params);
        logger.info(`[DEPLOY TOOL] Background deployment process completed with status: ${result.status}`);
      } catch (error) {
        logger.error(`[DEPLOY TOOL ERROR] Background deployment process failed:`, error);
      }
    }, 0);
    
    logger.info(`[DEPLOY TOOL COMPLETE] Successfully initiated deploy request for ${params.configuration.projectName}`);
    logger.info(`Returning immediate response: ${JSON.stringify(response)}`);
    
    // Return the response immediately, before the deployment actually starts
    return response;
  } catch (error) {
    logger.error(`[DEPLOY TOOL ERROR] Deploy tool error for ${params.configuration?.projectName || 'unknown project'}:`, error);
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
