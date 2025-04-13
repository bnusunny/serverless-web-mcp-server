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
  
  try {
    fs.writeFileSync(statusFile, JSON.stringify({
      status: 'in_progress',
      timestamp: new Date().toISOString(),
      deploymentType,
      framework,
      message: `Deployment of ${projectName} initiated`
    }, null, 2));
    
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
  
  try {
    // Append to the progress log
    fs.appendFileSync(progressFile, `[${new Date().toISOString()}] ${message}\n`);
  } catch (error) {
    console.error(`Failed to store deployment progress for ${projectName}:`, error);
  }
}

/**
 * Get deployment status for a project
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
        status.progressLogs = progressContent.split('\n').filter(line => line.trim() !== '');
      }
      
      return status;
    } else if (fs.existsSync(progressFile)) {
      // If only progress file exists, deployment is still in progress
      const progressContent = fs.readFileSync(progressFile, 'utf8');
      
      return {
        status: 'in_progress',
        timestamp: new Date().toISOString(),
        progressLogs: progressContent.split('\n').filter(line => line.trim() !== '')
      };
    } else {
      // No deployment found
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
 * List all deployments
 */
export async function listDeployments(): Promise<any[]> {
  try {
    const files = fs.readdirSync(DEPLOYMENT_STATUS_DIR);
    const deployments: any[] = [];
    
    // Process each JSON status file
    for (const file of files) {
      if (file.endsWith('.json') && !file.includes('-progress')) {
        const projectName = file.replace('.json', '');
        try {
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
    
    return deployments;
  } catch (error) {
    console.error('Failed to list deployments:', error);
    return [];
  }
}
