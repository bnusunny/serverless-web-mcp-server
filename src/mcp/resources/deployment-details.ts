/**
 * Deployment Details Resource
 * 
 * Provides details about a specific deployment.
 */

import { McpResource } from './index.js';
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
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
 * Deployment Details resource definition
 */
const deploymentDetails: McpResource = {
  name: 'deployment-details',
  uri: new ResourceTemplate("deployment:{projectName}", { list: undefined }),
  description: 'Status and details of a specific deployment',
  handler: async (uri, { projectName }, extra) => {
    if (!projectName) {
      return {
        contents: [{
          uri: "deployment:unknown",
          text: "Missing project name"
        }],
        metadata: {
          error: "Missing project name"
        }
      };
    }
    
    // Check if deployment status file exists
    const statusFilePath = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
    
    if (fs.existsSync(statusFilePath)) {
      try {
        // Read deployment status from file
        const statusData = fs.readFileSync(statusFilePath, 'utf8');
        const deploymentDetails = JSON.parse(statusData);
        
        // Return in the format expected by MCP protocol
        return {
          contents: [{
            uri: `deployment:${projectName}`,
            text: statusData
          }],
          metadata: {
            projectName
          }
        };
      } catch (error) {
        logger.error(`Error reading deployment status for ${projectName}:`, error);
        return {
          contents: [{
            uri: `deployment:${projectName}`,
            text: JSON.stringify({
              projectName,
              status: 'error',
              message: `Error reading deployment status: ${error instanceof Error ? error.message : String(error)}`,
              lastUpdated: new Date().toISOString()
            })
          }],
          metadata: {
            projectName,
            error: `Error reading deployment status: ${error instanceof Error ? error.message : String(error)}`
          }
        };
      }
    }
    
    // If no status file exists, return a placeholder response
    return {
      contents: [{
        uri: `deployment:${projectName}`,
        text: JSON.stringify({
          projectName,
          status: 'unknown',
          message: 'Deployment status not found',
          lastUpdated: new Date().toISOString()
        })
      }],
      metadata: {
        projectName,
        warning: 'Deployment status not found'
      }
    };
  }
};

export default deploymentDetails;
