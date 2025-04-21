/**
 * Deployment Details Resource
 * 
 * Provides information about a specific deployment.
 */

import { McpResource } from './index.js';
import { getDeploymentStatus } from '../../deployment/deploy-service.js';
import { logger } from '../../utils/logger.js';

/**
 * Handler for the deployment details resource
 */
export async function handleDeploymentDetails(params: any): Promise<any> {
  try {
    const { projectName } = params;
    logger.debug('Deployment details resource called', { projectName });
    
    // Get deployment status
    const deployment = getDeploymentStatus(projectName);
    
    if (!deployment) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Deployment not found for project: ${projectName}`,
              message: `No deployment information available for ${projectName}. Make sure you have initiated a deployment for this project.`
            }, null, 2)
          }
        ]
      };
    }
    
    // Format the response based on deployment status
    let responseText = '';
    
    if (deployment.status === 'COMPLETE') {
      responseText = JSON.stringify({
        projectName,
        status: deployment.status,
        success: deployment.success,
        deploymentUrl: deployment.url,
        resources: deployment.resources,
        outputs: deployment.outputs,
        stackName: deployment.stackName,
        deploymentId: deployment.deploymentId
      }, null, 2);
    } else if (deployment.status === 'FAILED') {
      responseText = JSON.stringify({
        projectName,
        status: deployment.status,
        success: deployment.success,
        error: deployment.error,
        stackName: deployment.stackName,
        deploymentId: deployment.deploymentId
      }, null, 2);
    } else {
      // Deployment is still in progress
      responseText = JSON.stringify({
        projectName,
        status: deployment.status,
        message: `Deployment is currently in progress (${deployment.status}).`,
        stackName: deployment.stackName,
        deploymentId: deployment.deploymentId,
        note: "Check this resource again in a few moments for updated status."
      }, null, 2);
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText
        }
      ]
    };
  } catch (error: any) {
    logger.error('Deployment details resource error', { error: error.message, stack: error.stack });
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: `Failed to get deployment details: ${error.message}`
          }, null, 2)
        }
      ]
    };
  }
}

/**
 * Deployment details resource definition
 */
const deploymentDetailsResource: McpResource = {
  name: 'Deployment Details',
  uri: 'deployment:{projectName}',
  description: 'Get details about a specific deployment',
  handler: async (uri: URL, variables?: any) => {
    return handleDeploymentDetails({ projectName: variables?.projectName });
  }
};

export default deploymentDetailsResource;
