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
