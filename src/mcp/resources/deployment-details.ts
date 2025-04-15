/**
 * Deployment Details Resource
 * 
 * Provides details about a specific deployment.
 */

import { McpResource } from './index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../utils/logger.js';

// Define the directory where deployment status files are stored
const DEPLOYMENT_STATUS_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-deployments');

// Ensure the directory exists
if (!fs.existsSync(DEPLOYMENT_STATUS_DIR)) {
  fs.mkdirSync(DEPLOYMENT_STATUS_DIR, { recursive: true });
}

/**
 * Handler for the deployment:{projectName} resource
 * 
 * @param uri - Resource URI
 * @param variables - URI template variables
 * @returns - Deployment details
 */
async function handleDeploymentDetails(uri: URL, variables?: Record<string, string>): Promise<any> {
  if (!variables || !variables.projectName) {
    return undefined;
  }
  
  const projectName = variables.projectName;
  
  // Check if deployment status file exists
  const statusFilePath = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
  
  if (fs.existsSync(statusFilePath)) {
    try {
      // Read deployment status from file
      const statusData = fs.readFileSync(statusFilePath, 'utf8');
      return JSON.parse(statusData);
    } catch (error) {
      logger.error(`Error reading deployment status for ${projectName}:`, error);
    }
  }
  
  // If no status file exists or there was an error reading it,
  // return a placeholder response
  return {
    projectName,
    status: 'unknown',
    message: 'Deployment status not found',
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Deployment Details resource definition
 */
const deploymentDetails: McpResource = {
  name: 'deployment-details',
  uri: 'deployment:{projectName}',
  description: 'Status and details of a specific deployment',
  handler: handleDeploymentDetails
};

export default deploymentDetails;
