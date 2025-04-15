/**
 * Deployment List Resource
 * 
 * Provides a list of all AWS deployments managed by the MCP server.
 */

import { McpResource } from './index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Define the directory where deployment status files are stored
const DEPLOYMENT_STATUS_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-deployments');

/**
 * Handler for the deployment:list resource
 * 
 * @returns - List of all AWS deployments
 */
async function handleDeploymentsList(): Promise<any> {
  // Ensure the directory exists
  if (!fs.existsSync(DEPLOYMENT_STATUS_DIR)) {
    fs.mkdirSync(DEPLOYMENT_STATUS_DIR, { recursive: true });
    return { deployments: [] };
  }
  
  try {
    // Read all deployment status files
    const files = fs.readdirSync(DEPLOYMENT_STATUS_DIR);
    const deployments = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const statusData = fs.readFileSync(path.join(DEPLOYMENT_STATUS_DIR, file), 'utf8');
          const deployment = JSON.parse(statusData);
          
          // Extract basic information for the list
          deployments.push({
            projectName: deployment.projectName,
            type: deployment.deploymentType,
            status: deployment.status,
            lastUpdated: deployment.lastUpdated,
            resources: deployment.resources || []
          });
        } catch (error) {
          console.error(`Error reading deployment status file ${file}:`, error);
        }
      }
    }
    
    return { deployments };
  } catch (error) {
    console.error('Error reading deployments directory:', error);
    return { 
      deployments: [],
      error: 'Failed to read deployments directory'
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
