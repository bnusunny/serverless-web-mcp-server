/**
 * Deployment List Resource
 * 
 * Provides a list of all AWS deployments managed by the MCP server.
 */

import { McpResource } from './index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../utils/logger.js';

// Define the directory where deployment status files are stored
const DEPLOYMENT_STATUS_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-deployments');

/**
 * Handler for the deployment:list resource
 * 
 * @returns - List of all AWS deployments
 */
async function handleDeploymentsList(): Promise<any> {
  try {
    // Ensure the directory exists
    if (!fs.existsSync(DEPLOYMENT_STATUS_DIR)) {
      fs.mkdirSync(DEPLOYMENT_STATUS_DIR, { recursive: true });
      return {
        contents: [],
        metadata: {
          count: 0
        }
      };
    }
    
    // Read all deployment status files
    const files = fs.readdirSync(DEPLOYMENT_STATUS_DIR);
    const deployments = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const statusData = fs.readFileSync(path.join(DEPLOYMENT_STATUS_DIR, file), 'utf8');
          const deployment = JSON.parse(statusData);
          
          // Format each deployment as a text content item with URI
          deployments.push({
            uri: `deployment:${deployment.projectName}`,
            text: JSON.stringify({
              projectName: deployment.projectName,
              type: deployment.deploymentType,
              status: deployment.status,
              lastUpdated: deployment.lastUpdated
            })
          });
        } catch (error) {
          logger.error(`Error reading deployment status file ${file}:`, error);
        }
      }
    }
    
    // Return in the format expected by MCP protocol
    return {
      contents: deployments,
      metadata: {
        count: deployments.length
      }
    };
  } catch (error) {
    logger.error('Error reading deployments directory:', error);
    return { 
      contents: [],
      metadata: {
        count: 0,
        error: 'Failed to read deployments directory'
      }
    };
  }
}

/**
 * Deployment List resource definition
 */
const deploymentList: McpResource = {
  name: 'deployment-list',
  uri: 'deployment:list',
  description: 'List of all AWS deployments managed by the MCP server',
  handler: handleDeploymentsList
};

export default deploymentList;
