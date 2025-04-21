/**
 * Deployment Details Resource
 * 
 * Provides information about a specific deployment.
 */

import { McpResource } from './index.js';
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDeploymentStatus } from '../../deployment/status.js';
import { logger } from '../../utils/logger.js';

/**
 * Handler for the deployment details resource
 */
export async function handleDeploymentDetails(params: any): Promise<any> {
  try {
    const { projectName } = params;
    logger.debug('Deployment details resource called', { projectName });
    
    // Get deployment status - using the async function from status.ts
    const deployment = await getDeploymentStatus(projectName);
    
    if (!deployment || deployment.status === 'not_found') {
      return {
        contents: [{
          uri: `deployment:${projectName}`,
          text: JSON.stringify({
            error: `Deployment not found for project: ${projectName}`,
            message: `No deployment information available for ${projectName}. Make sure you have initiated a deployment for this project.`
          }, null, 2)
        }],
        metadata: {
          projectName
        }
      };
    }
    
    // Format the response based on deployment status
    let responseData: any = {
      projectName,
      status: deployment.status
    };
    
    if (deployment.status === 'completed') {
      responseData = {
        ...responseData,
        success: true,
        deploymentUrl: deployment.endpoint,
        resources: {
          api: deployment.outputs?.ApiUrl || null,
          website: deployment.outputs?.WebsiteURL || null,
          distribution: deployment.outputs?.CloudFrontDistribution || null,
          bucket: deployment.outputs?.WebsiteBucket || null
        },
        outputs: deployment.outputs,
        stackName: deployment.stackName,
        deploymentId: deployment.stackId
      };
    } else if (deployment.status === 'failed') {
      responseData = {
        ...responseData,
        success: false,
        error: deployment.stackStatusReason || deployment.message,
        stackName: deployment.stackName,
        deploymentId: deployment.stackId
      };
    } else {
      // Deployment is still in progress
      responseData = {
        ...responseData,
        message: `Deployment is currently in progress (${deployment.stackStatus || deployment.status}).`,
        stackName: deployment.stackName,
        deploymentId: deployment.stackId,
        note: "Check this resource again in a few moments for updated status."
      };
    }
    
    // Return in the format expected by MCP protocol
    return {
      contents: [{
        uri: `deployment:${projectName}`,
        text: JSON.stringify(responseData, null, 2)
      }],
      metadata: {
        projectName
      }
    };
  } catch (error: any) {
    logger.error('Deployment details resource error', { error: error.message, stack: error.stack });
    
    return {
      contents: [{
        uri: `deployment:error`,
        text: JSON.stringify({
          error: `Failed to get deployment details: ${error.message}`
        }, null, 2)
      }],
      metadata: {
        error: error.message
      }
    };
  }
}

/**
 * Deployment details resource definition
 */
const deploymentDetailsResource: McpResource = {
  name: 'deployment-details',
  uri: new ResourceTemplate("deployment:{projectName}", { list: undefined }),
  description: 'Get details about a specific deployment',
  handler: async (uri: URL, variables?: any) => {
    return handleDeploymentDetails({ projectName: variables?.projectName });
  }
};

export default deploymentDetailsResource;
