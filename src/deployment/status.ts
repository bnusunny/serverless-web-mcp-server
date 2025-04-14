import fs from 'fs';
import path from 'path';
import os from 'os';

// Define the directory where deployment status files will be stored
const DEPLOYMENT_STATUS_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-deployments');

// Ensure the directory exists
if (!fs.existsSync(DEPLOYMENT_STATUS_DIR)) {
  fs.mkdirSync(DEPLOYMENT_STATUS_DIR, { recursive: true });
}

/**
 * Initialize deployment status for a new deployment
 */
export function initializeDeploymentStatus(projectName: string, deploymentType: string, framework: string): void {
  const statusFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
  const progressFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}-progress.log`);
  
  try {
    // Create the status file
    fs.writeFileSync(statusFile, JSON.stringify({
      status: 'in_progress',
      timestamp: new Date().toISOString(),
      deploymentType,
      framework,
      message: `Deployment of ${projectName} initiated`
    }, null, 2));
    
    // Create an empty progress log file
    fs.writeFileSync(progressFile, `[${new Date().toISOString()}] Deployment of ${projectName} initiated\n`);
    
    console.log(`Deployment status initialized for ${projectName}`);
  } catch (error) {
    console.error(`Failed to initialize deployment status for ${projectName}:`, error);
  }
}
export function storeDeploymentResult(projectName: string, result: any): void {
  const statusFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
  
  try {
    fs.writeFileSync(statusFile, JSON.stringify({
      status: 'completed',
      timestamp: new Date().toISOString(),
      result
    }, null, 2));
    
    console.log(`Deployment status stored for ${projectName}`);
  } catch (error) {
    console.error(`Failed to store deployment status for ${projectName}:`, error);
  }
}

/**
 * Store deployment error for later retrieval
 */
export function storeDeploymentError(projectName: string, error: any): void {
  const statusFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
  
  try {
    fs.writeFileSync(statusFile, JSON.stringify({
      status: 'failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    
    console.log(`Deployment error stored for ${projectName}`);
  } catch (error) {
    console.error(`Failed to store deployment error for ${projectName}:`, error);
  }
}

/**
 * Store deployment progress update
 */
export function storeDeploymentProgress(projectName: string, message: string): void {
  const progressFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}-progress.log`);
  const statusFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
  
  try {
    // Append to the progress log
    fs.appendFileSync(progressFile, `[${new Date().toISOString()}] ${message}\n`);
    
    // Also update the current status message in the status file
    if (fs.existsSync(statusFile)) {
      try {
        const statusContent = fs.readFileSync(statusFile, 'utf8');
        const status = JSON.parse(statusContent);
        
        // Only update if the status is still in_progress
        if (status.status === 'in_progress') {
          status.message = message;
          status.lastUpdated = new Date().toISOString();
          fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
        }
      } catch (err) {
        console.error(`Error updating status file for ${projectName}:`, err);
      }
    }
  } catch (error) {
    console.error(`Failed to store deployment progress for ${projectName}:`, error);
  }
}

/**
 * Get deployment status for a project
 * 
 * This function returns immediately with the current status without waiting for completion.
 * It also extracts CloudFormation status from progress logs if available.
 */
export async function getDeploymentStatus(projectName: string): Promise<any> {
  const statusFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
  const progressFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}-progress.log`);
  
  try {
    // Check if status file exists
    if (fs.existsSync(statusFile)) {
      const statusContent = fs.readFileSync(statusFile, 'utf8');
      const status = JSON.parse(statusContent);
      
      // Add progress logs if available
      if (fs.existsSync(progressFile)) {
        const progressContent = fs.readFileSync(progressFile, 'utf8');
        const progressLogs = progressContent.split('\n').filter(line => line.trim() !== '');
        status.progressLogs = progressLogs;
        
        // Extract CloudFormation resource status from progress logs if deployment is in progress
        if (status.status === 'in_progress') {
          status.resources = extractResourceStatus(progressLogs);
          status.currentPhase = determineDeploymentPhase(progressLogs);
          status.estimatedPercentComplete = estimateCompletion(progressLogs);
        }
      } else {
        status.progressLogs = [];
      }
      
      return status;
    } else if (fs.existsSync(progressFile)) {
      // If only progress file exists, deployment is still in progress
      const progressContent = fs.readFileSync(progressFile, 'utf8');
      const progressLogs = progressContent.split('\n').filter(line => line.trim() !== '');
      
      // Extract the latest message
      const latestMessage = progressLogs.length > 0 
        ? progressLogs[progressLogs.length - 1].replace(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] /, '') 
        : 'Deployment in progress';
      
      // Extract CloudFormation resource status
      const resources = extractResourceStatus(progressLogs);
      const currentPhase = determineDeploymentPhase(progressLogs);
      const estimatedPercentComplete = estimateCompletion(progressLogs);
      
      return {
        status: 'in_progress',
        timestamp: new Date().toISOString(),
        message: latestMessage,
        progressLogs,
        resources,
        currentPhase,
        estimatedPercentComplete
      };
    } else {
      // No deployment found
      console.log(`No deployment files found for project: ${projectName}`);
      return {
        status: 'not_found',
        message: `No deployment found for project: ${projectName}`
      };
    }
  } catch (error) {
    console.error(`Failed to get deployment status for ${projectName}:`, error);
    throw new Error(`Failed to get deployment status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract CloudFormation resource status from progress logs
 */
function extractResourceStatus(logs: string[]): any[] {
  const resources: any[] = [];
  const resourceMap = new Map<string, any>();
  
  // Regular expression to match CloudFormation resource status lines
  const cfnStatusRegex = /([A-Z_]+)\s+([A-Za-z0-9:]+)\s+([A-Za-z0-9]+)\s+(.*)$/;
  
  for (const log of logs) {
    const match = log.match(cfnStatusRegex);
    if (match) {
      const [, status, resourceType, logicalId, reason] = match;
      
      // Update or add the resource
      resourceMap.set(logicalId, {
        logicalId,
        resourceType,
        status,
        reason: reason.trim(),
        lastUpdated: new Date().toISOString()
      });
    }
  }
  
  // Convert map to array
  resourceMap.forEach(resource => resources.push(resource));
  
  return resources;
}

/**
 * Determine the current deployment phase based on progress logs
 */
function determineDeploymentPhase(logs: string[]): string {
  // Check logs in reverse order (most recent first)
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i].toLowerCase();
    
    if (log.includes("uploading frontend assets")) {
      return "Uploading frontend assets";
    } else if (log.includes("retrieving deployment outputs")) {
      return "Retrieving deployment outputs";
    } else if (log.includes("deploying application")) {
      return "Deploying application";
    } else if (log.includes("building application")) {
      return "Building application";
    } else if (log.includes("starting aws sam deployment")) {
      return "Starting AWS SAM deployment";
    } else if (log.includes("preparing deployment files")) {
      return "Preparing deployment files";
    }
  }
  
  return "Initializing deployment";
}

/**
 * Estimate completion percentage based on progress logs
 */
function estimateCompletion(logs: string[]): number {
  // Check for CloudFront distribution creation which is typically the longest part
  const hasCloudfrontDistribution = logs.some(log => 
    log.includes("CloudFrontDistribution") && log.includes("CREATE_IN_PROGRESS")
  );
  
  // Check for completed resources
  const completedResources = logs.filter(log => log.includes("CREATE_COMPLETE")).length;
  const totalExpectedResources = hasCloudfrontDistribution ? 4 : 2; // Rough estimate
  
  // Check deployment phases
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i].toLowerCase();
    
    if (log.includes("completed successfully")) {
      return 100;
    } else if (log.includes("uploading frontend assets")) {
      return 90;
    } else if (log.includes("retrieving deployment outputs")) {
      return 80;
    } else if (log.includes("deploying application")) {
      // For CloudFront, this can take a long time
      if (hasCloudfrontDistribution) {
        // If CloudFront is involved, base progress on resource completion
        return Math.min(60 + (completedResources / totalExpectedResources) * 20, 79);
      }
      return 60;
    } else if (log.includes("building application")) {
      return 40;
    } else if (log.includes("starting aws sam deployment")) {
      return 30;
    } else if (log.includes("preparing deployment files")) {
      return 20;
    }
  }
  
  return 10; // Default starting percentage
}

/**
 * List all deployments
 */
export async function listDeployments(): Promise<any[]> {
  try {
    console.log(`Listing deployments from directory: ${DEPLOYMENT_STATUS_DIR}`);
    const files = fs.readdirSync(DEPLOYMENT_STATUS_DIR);
    console.log(`Found files: ${files.join(', ')}`);
    
    const deployments: any[] = [];
    
    // Process each JSON status file
    for (const file of files) {
      if (file.endsWith('.json') && !file.includes('-progress')) {
        const projectName = file.replace('.json', '');
        try {
          console.log(`Processing deployment: ${projectName}`);
          const status = await getDeploymentStatus(projectName);
          deployments.push({
            projectName,
            ...status
          });
        } catch (error) {
          console.error(`Error processing deployment ${projectName}:`, error);
        }
      }
    }
    
    console.log(`Returning ${deployments.length} deployments`);
    return deployments;
  } catch (error) {
    console.error('Failed to list deployments:', error);
    return [];
  }
}
