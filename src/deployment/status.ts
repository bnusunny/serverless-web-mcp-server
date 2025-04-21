import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';
import { getStackInfo, mapCloudFormationStatus } from './cloudformation.js';

// Define the directory where deployment metadata files will be stored
const DEPLOYMENT_METADATA_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-deployments');

// Ensure the directory exists
if (!fs.existsSync(DEPLOYMENT_METADATA_DIR)) {
  fs.mkdirSync(DEPLOYMENT_METADATA_DIR, { recursive: true });
}

/**
 * Initialize deployment metadata for a new deployment
 * This stores minimal information needed to query CloudFormation later
 */
export async function initializeDeploymentStatus(projectName: string, deploymentType: string, framework: string): Promise<void> {
  const metadataFile = path.join(DEPLOYMENT_METADATA_DIR, `${projectName}.json`);
  const stackName = projectName;
  
  try {
    // Create the metadata file with minimal information
    await fs.promises.writeFile(metadataFile, JSON.stringify({
      projectName,
      stackName,
      timestamp: new Date().toISOString(),
      deploymentType,
      framework,
      region: process.env.AWS_REGION || 'us-east-1'
    }, null, 2));
    
    logger.info(`Deployment metadata initialized for ${projectName}`);
  } catch (error) {
    logger.error(`Failed to initialize deployment metadata for ${projectName}:`, error);
  }
}

/**
 * Store additional deployment metadata if needed
 * This is used for information that isn't available in CloudFormation
 */
export async function storeDeploymentMetadata(projectName: string, metadata: any): Promise<void> {
  const metadataFile = path.join(DEPLOYMENT_METADATA_DIR, `${projectName}.json`);
  
  try {
    // Read existing metadata
    let existingMetadata = {};
    try {
      const content = await fs.promises.readFile(metadataFile, 'utf8');
      existingMetadata = JSON.parse(content);
    } catch (error) {
      // File might not exist yet, that's ok
    }
    
    // Merge with new metadata
    const updatedMetadata = {
      ...existingMetadata,
      ...metadata,
      lastUpdated: new Date().toISOString()
    };
    
    // Write back to file
    await fs.promises.writeFile(metadataFile, JSON.stringify(updatedMetadata, null, 2));
    
    logger.info(`Deployment metadata updated for ${projectName}`);
  } catch (error) {
    logger.error(`Failed to store deployment metadata for ${projectName}:`, error);
  }
}

/**
 * Store deployment error for cases where CloudFormation wasn't involved
 * For example, if the deployment failed before CloudFormation was called
 */
export async function storeDeploymentError(projectName: string, error: any): Promise<void> {
  await storeDeploymentMetadata(projectName, {
    error: error instanceof Error ? error.message : String(error),
    errorTimestamp: new Date().toISOString()
  });
}

/**
 * Get deployment status by combining metadata and CloudFormation status
 */
export async function getDeploymentStatus(projectName: string): Promise<any> {
  const metadataFile = path.join(DEPLOYMENT_METADATA_DIR, `${projectName}.json`);
  
  try {
    // Check if metadata file exists
    if (!fs.existsSync(metadataFile)) {
      logger.info(`No deployment metadata found for project: ${projectName}`);
      return {
        status: 'not_found',
        message: `No deployment found for project: ${projectName}`
      };
    }
    
    // Read metadata file
    const metadataContent = await fs.promises.readFile(metadataFile, 'utf8');
    const metadata = JSON.parse(metadataContent);
    
    // If there's an error stored in metadata and no stack info, return the error
    if (metadata.error && !metadata.stackId) {
      return {
        status: 'failed',
        timestamp: metadata.errorTimestamp || metadata.timestamp,
        deploymentType: metadata.deploymentType,
        framework: metadata.framework,
        message: metadata.error
      };
    }
    
    // Get stack info from CloudFormation
    const stackName = metadata.stackName || projectName;
    const region = metadata.region || process.env.AWS_REGION || 'us-east-1';
    
    try {
      const stackInfo = await getStackInfo(stackName, region);
      
      // If stack not found but we have metadata, deployment is in progress or failed before CF was called
      if (stackInfo.status === 'NOT_FOUND') {
        return {
          status: metadata.error ? 'failed' : 'in_progress',
          timestamp: metadata.timestamp,
          deploymentType: metadata.deploymentType,
          framework: metadata.framework,
          message: metadata.error || 'Deployment initiated, waiting for CloudFormation stack creation'
        };
      }
      
      // Map CloudFormation status to our status format
      const status = mapCloudFormationStatus(stackInfo.status);
      
      // Get endpoint URL if available
      let endpoint = null;
      if (stackInfo.outputs) {
        endpoint = stackInfo.outputs.ApiEndpoint || 
                  stackInfo.outputs.WebsiteURL || 
                  stackInfo.outputs.ApiUrl || 
                  null;
      }
      
      // Return combined information
      return {
        status,
        stackStatus: stackInfo.status,
        stackStatusReason: stackInfo.statusReason,
        timestamp: metadata.timestamp,
        lastUpdated: stackInfo.lastUpdatedTime || metadata.lastUpdated,
        deploymentType: metadata.deploymentType,
        framework: metadata.framework,
        endpoint,
        outputs: stackInfo.outputs,
        resources: stackInfo.resources,
        region
      };
    } catch (error) {
      // If CloudFormation query fails, return metadata with error
      logger.error(`Failed to get CloudFormation stack info for ${projectName}:`, error);
      return {
        status: 'unknown',
        timestamp: metadata.timestamp,
        deploymentType: metadata.deploymentType,
        framework: metadata.framework,
        message: `Error querying CloudFormation: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  } catch (error) {
    logger.error(`Failed to get deployment status for ${projectName}:`, error);
    throw new Error(`Failed to get deployment status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List all deployments by combining metadata and CloudFormation status
 */
export async function listDeployments(
  limit?: number,
  sortBy: string = 'timestamp',
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<any[]> {
  try {
    logger.info(`Listing deployments from directory: ${DEPLOYMENT_METADATA_DIR}`);
    
    // Create directory if it doesn't exist
    try {
      await fs.promises.mkdir(DEPLOYMENT_METADATA_DIR, { recursive: true });
    } catch (error) {
      // Ignore error if directory already exists
    }
    
    // Get all metadata files
    let files: string[];
    try {
      files = await fs.promises.readdir(DEPLOYMENT_METADATA_DIR);
    } catch (error) {
      logger.error(`Error reading deployment directory:`, error);
      return [];
    }
    
    // Filter to only include metadata files
    const metadataFiles = files.filter(file => file.endsWith('.json'));
    
    logger.info(`Found ${metadataFiles.length} deployment metadata files`);
    
    // Process deployments with a timeout
    const deployments: any[] = [];
    
    // Process files in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      const batchPromises = batch.map(async (file) => {
        try {
          const projectName = path.basename(file, '.json');
          const status = await getDeploymentStatus(projectName);
          return status;
        } catch (error) {
          logger.error(`Error processing deployment ${file}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      deployments.push(...batchResults.filter(Boolean));
      
      // Apply limit if specified
      if (limit && deployments.length >= limit) {
        deployments.splice(limit);
        break;
      }
    }
    
    // Sort deployments
    deployments.sort((a, b) => {
      const valueA = a[sortBy];
      const valueB = b[sortBy];
      
      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return deployments;
  } catch (error) {
    logger.error(`Failed to list deployments:`, error);
    throw error;
  }
}
