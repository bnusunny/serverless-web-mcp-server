/**
 * Deploy Tool
 * 
 * Handles deployment of web applications to AWS serverless infrastructure.
 */

import { z } from 'zod';
import { McpTool } from '../types/mcp-tool.js';
import { deployApplication } from '../../deployment/deploy-service.js';
import { logger } from '../../utils/logger.js';
import path from 'path';

/**
 * Schema for deploy tool parameters
 */
const deploySchema = z.object({
  deploymentType: z.enum(['backend', 'frontend', 'fullstack']),
  projectName: z.string().min(1),
  projectRoot: z.string().min(1),
  region: z.string().optional().default('us-east-1'),
  backendConfiguration: z.object({
    builtArtifactsPath: z.string().min(1),
    runtime: z.string().min(1),
    startupScript: z.string().optional(),
    entryPoint: z.string().optional(),
    generateStartupScript: z.boolean().optional(),
    memorySize: z.number().optional().default(512),
    timeout: z.number().optional().default(30),
    environment: z.record(z.string()).optional(),
    cors: z.boolean().optional().default(true),
    framework: z.string().optional(),
    stage: z.string().optional().default('prod'),
    architecture: z.enum(['x86_64', 'arm64']).optional().default('x86_64'),
    databaseConfiguration: z.object({
      tableName: z.string().min(1),
      attributeDefinitions: z.array(z.object({
        name: z.string().min(1),
        type: z.enum(['S', 'N', 'B'])
      })),
      keySchema: z.array(z.object({
        name: z.string().min(1),
        type: z.enum(['HASH', 'RANGE'])
      })),
      billingMode: z.enum(['PROVISIONED', 'PAY_PER_REQUEST']).optional().default('PAY_PER_REQUEST'),
      readCapacity: z.number().optional(),
      writeCapacity: z.number().optional()
    }).optional()
  }).optional(),
  frontendConfiguration: z.object({
    builtAssetsPath: z.string().min(1),
    indexDocument: z.string().optional().default('index.html'),
    errorDocument: z.string().optional(),
    customDomain: z.string().optional(),
    certificateArn: z.string().optional(),
    framework: z.string().optional()
  }).optional()
}).refine(data => {
  if (data.deploymentType === 'backend' && !data.backendConfiguration) {
    return false;
  }
  if (data.deploymentType === 'frontend' && !data.frontendConfiguration) {
    return false;
  }
  if (data.deploymentType === 'fullstack' && (!data.backendConfiguration || !data.frontendConfiguration)) {
    return false;
  }
  return true;
}, {
  message: "Configuration must match deployment type"
});

/**
 * Handler for the deploy tool
 */
export async function handleDeploy(params: any): Promise<any> {
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
    
    // Create a deployment ID for tracking
    const deploymentId = `${params.projectName}-${Date.now()}`;
    
    // Start the deployment process in the background with setTimeout(0)
    setTimeout(() => {
      deployApplication(params)
        .then(result => {
          logger.info(`Background deployment completed for ${params.projectName} with status: ${result.status}`);
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
      deploymentId: deploymentId,
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
  description: 'Deploy web applications to AWS serverless infrastructure. Can also create and configure database resources like DynamoDB tables.',
  schema: deploySchema,
  handler: handleDeploy
};

export default deployTool;
