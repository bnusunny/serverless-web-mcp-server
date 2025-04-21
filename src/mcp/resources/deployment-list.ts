/**
 * Deployment List Resource
 * 
 * Provides a list of all AWS deployments managed by the MCP server.
 */

import { McpResource } from './index.js';
import { listDeployments } from '../../deployment/status.js';
import { logger } from '../../utils/logger.js';

/**
 * Handler for the deployment:list resource
 * 
 * @returns - List of all AWS deployments
 */
async function handleDeploymentsList(): Promise<any> {
  try {
    logger.info('Deployment list resource called');
    
    // Use the listDeployments function from status.ts
    const deployments = await listDeployments();
    logger.info(`Found ${deployments.length} deployments`);
    
    // Format deployments for MCP response
    const formattedDeployments = deployments.map(deployment => ({
      uri: `deployment:${deployment.projectName}`,
      text: JSON.stringify({
        projectName: deployment.projectName,
        type: deployment.deploymentType || 'unknown',
        status: deployment.status || 'unknown',
        lastUpdated: deployment.lastUpdated || deployment.updatedAt || deployment.timestamp || new Date().toISOString()
      })
    }));
    
    // Return in the format expected by MCP protocol
    return {
      contents: formattedDeployments,
      metadata: {
        count: formattedDeployments.length
      }
    };
  } catch (error) {
    logger.error('Error listing deployments:', error);
    return { 
      contents: [],
      metadata: {
        count: 0,
        error: `Failed to list deployments: ${error instanceof Error ? error.message : String(error)}`
      }
    };
  }
}

/**
 * Deployment List resource definition
 */
const deploymentList: McpResource = {
  name: 'Deployment List',
  uri: 'deployment:list',
  description: 'List of all AWS deployments managed by the MCP server',
  handler: handleDeploymentsList
};

export default deploymentList;
