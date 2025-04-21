/**
 * Deploy Tool
 * 
 * Handles deployment of web applications to AWS serverless infrastructure.
 */

import { z } from 'zod';
import { McpTool } from '../types/mcp-tool.js';
import { deployApplication } from '../../deployment/deploy-service.js';
import { DeployOptions } from '../../deployment/types.js';
import { logger } from '../../utils/logger.js';
import path from 'path';

/**
 * Handler for the deploy tool
 */
export async function handleDeploy(params: DeployOptions): Promise<any> {
  try {
    logger.debug('Deploy tool called with params', { params });
    
    // Validate that projectRoot is provided and is an absolute path or convert it
    if (!params.projectRoot) {
      return {
        success: false,
        message: "Project root is required",
        error: "Missing required parameter: projectRoot"
      };
    }
    
    // Start the deployment process in the background with setTimeout(0)
    setTimeout(() => {
      deployApplication(params)
        .then(result => {
          logger.info(`Background deployment completed for ${params.projectName} with result: ${JSON.stringify(result)}`);
        })
        .catch(error => {
          logger.error(`Background deployment failed for ${params.projectName}:`, error);
        });
    }, 0);
    
    // Return an immediate response
    const responseText = JSON.stringify({
      success: true,
      message: `Deployment of ${params.projectName} initiated successfully.`,
      status: 'INITIATED',
      note: `The deployment process is running in the background and may take several minutes to complete.`,
      checkStatus: `To check the status of your deployment, use the resource: deployment:${params.projectName}`
    }, null, 2);
    
    const response = {
      content: [
        {
          type: "text",
          text: responseText
        }
      ]
    };
    
    logger.debug('Deploy tool response', { response });
    return response;
  } catch (error: any) {
    logger.error('Deploy tool error', { error: error.message, stack: error.stack });
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            message: `Deployment failed: ${error.message}`,
            error: error.message
          }, null, 2)
        }
      ]
    };
  }
}

/**
 * Deploy tool definition
 */
const deployTool: McpTool = {
  name: 'deploy',
  description: 'Deploy web applications to AWS serverless infrastructure, including database resources like DynamoDB tables. IMPORTANT FOR DEPENDENCIES: For Node.js, copy package.json to builtArtifactsPath and run \'npm install --omit-dev\' there. For Python, include requirements.txt and run \'pip install -r requirements.txt -t .\' in builtArtifactsPath. WARNING: Choose deployment types carefully. Changing deployment types can destroy existing resources and cause data loss. Safe changes: backend→fullstack, frontend→fullstack. Destructive changes: backend→frontend, frontend→backend, fullstack→backend, fullstack→frontend.',
  parameters: {
    deploymentType: z.enum(['backend', 'frontend', 'fullstack']).describe('Type of deployment'),
    projectName: z.string().describe('Project name'),
    projectRoot: z.string().describe('Absolute path to the project root directory where SAM template will be generated. Must be an absolute path (e.g., /home/user/projects/myapp)'),
    region: z.string().optional().default('us-east-1').describe('AWS region'),
    backendConfiguration: z.object({
      builtArtifactsPath: z.string().describe('Path to pre-built backend artifacts. Can be absolute or relative to projectRoot'),
      framework: z.string().optional().describe('Backend framework'),
      runtime: z.string().describe('Lambda runtime (e.g. nodejs18.x, python3.9)'),
      startupScript: z.string().optional().describe('Startup script that must be executable in Linux environment (chmod +x) and take no parameters. Required unless entryPoint and generateStartupScript are provided.'),
      entryPoint: z.string().optional().describe('Application entry point file (e.g., app.js, app.py). If provided with generateStartupScript=true, a startup script will be automatically generated.'),
      generateStartupScript: z.boolean().optional().default(false).describe('Whether to automatically generate a startup script based on the runtime and entry point'),
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
      builtAssetsPath: z.string().describe('Path to pre-built frontend assets. Can be absolute or relative to projectRoot'),
      framework: z.string().optional().describe('Frontend framework'),
      indexDocument: z.string().optional().default('index.html').describe('Index document'),
      errorDocument: z.string().optional().describe('Error document'),
      customDomain: z.string().optional().describe('Custom domain'),
      certificateArn: z.string().optional().describe('ACM certificate ARN')
    }).optional().describe('Frontend configuration')
  },
  handler: handleDeploy
};

export default deployTool;
