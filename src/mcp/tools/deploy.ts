/**
 * Deploy tool implementation
 * 
 * This tool deploys web applications to AWS serverless infrastructure.
 */

import * as path from 'path';
import * as fs from 'fs';
import { deploy, getDeploymentResult } from '../../deployment/deploy-service.js';
import { uploadFrontendAssets } from '../../deployment/frontend-upload.js';
import { DeployToolParams, DeployToolResult } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Deploy tool handler
 * 
 * @param params - Deploy tool parameters
 * @returns - Deploy tool result
 */
export async function handleDeploy(params: DeployToolParams): Promise<DeployToolResult> {
  logger.info(`[DEPLOY TOOL] Starting deployment with params: ${JSON.stringify(params)}`);
  
  try {
    // Validate required parameters
    validateParams(params);
    
    // Deploy the application
    const deployResult = await deploy({
      deploymentType: params.deploymentType,
      projectName: params.projectName,
      projectRoot: params.projectRoot,
      region: params.region,
      backendConfiguration: params.backendConfiguration,
      frontendConfiguration: params.frontendConfiguration
    });
    
    // If frontend deployment, upload assets
    if ((params.deploymentType === 'frontend' || params.deploymentType === 'fullstack') && 
        params.frontendConfiguration && deployResult.status === 'success') {
      await uploadFrontendAssets({
        projectName: params.projectName,
        region: params.region,
        frontendConfiguration: params.frontendConfiguration
      }, deployResult);
    }
    
    // Get final deployment result
    const finalResult = await getDeploymentResult(params.projectName);
    
    // Create response
    const response: DeployToolResult = {
      content: [
        {
          type: "text",
          text: `Deployment ${finalResult.status === 'success' ? 'completed successfully' : 'failed'}`
        }
      ],
      status: finalResult.status === 'success' ? 'success' : 'error',
      message: finalResult.message,
      stackName: finalResult.stackName
    };
    
    // Add URLs if available
    if (finalResult.apiUrl) {
      response.apiUrl = finalResult.apiUrl;
      response.content.push({
        type: "text",
        text: `API URL: ${finalResult.apiUrl}`
      });
    }
    
    if (finalResult.websiteUrl) {
      response.websiteUrl = finalResult.websiteUrl;
      response.content.push({
        type: "text",
        text: `Website URL: ${finalResult.websiteUrl}`
      });
    }
    
    return response;
  } catch (error: any) {
    logger.error(`[DEPLOY TOOL ERROR] ${error.message}`);
    
    return {
      content: [
        {
          type: "text",
          text: `Deployment failed: ${error.message}`
        }
      ],
      status: 'error',
      message: `Deployment failed: ${error.message}`
    };
  }
}

/**
 * Validate deploy tool parameters
 * 
 * @param params - Deploy tool parameters
 */
function validateParams(params: DeployToolParams): void {
  // Check required parameters
  if (!params.deploymentType) {
    throw new Error('deploymentType is required');
  }
  
  if (!params.projectName) {
    throw new Error('projectName is required');
  }
  
  if (!params.projectRoot) {
    throw new Error('projectRoot is required');
  }
  
  // Check if project root exists
  if (!fs.existsSync(params.projectRoot)) {
    throw new Error(`Project root directory not found: ${params.projectRoot}`);
  }
  
  // Check deployment type specific parameters
  if (params.deploymentType === 'backend' || params.deploymentType === 'fullstack') {
    if (!params.backendConfiguration) {
      throw new Error('backendConfiguration is required for backend or fullstack deployments');
    }
    
    if (!params.backendConfiguration.builtArtifactsPath) {
      throw new Error('backendConfiguration.builtArtifactsPath is required');
    }
    
    if (!params.backendConfiguration.runtime) {
      throw new Error('backendConfiguration.runtime is required');
    }
    
    if (!params.backendConfiguration.startupScript) {
      throw new Error('backendConfiguration.startupScript is required. It must be a single executable script that takes no parameters.');
    }
    
    // Check if startup script exists
    const startupScriptPath = path.join(params.backendConfiguration.builtArtifactsPath, params.backendConfiguration.startupScript);
    if (!fs.existsSync(startupScriptPath)) {
      throw new Error(`Startup script not found: ${startupScriptPath}`);
    }
    
    // Check if startup script will be executable in Lambda (Linux) environment
    try {
      const stats = fs.statSync(startupScriptPath);
      const isExecutable = !!(stats.mode & 0o111); // Check if any execute bit is set
      
      if (!isExecutable) {
        // Script doesn't have execute permissions
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
          // On Windows, warn that the script needs to be made executable for Lambda
          logger.warn(`Warning: The startup script '${params.backendConfiguration.startupScript}' doesn't have execute permissions.`);
          logger.warn(`Since AWS Lambda runs on Linux, you should ensure the script has execute permissions.`);
          logger.warn(`If deploying from Windows, you may need to add a chmod +x command in your build process.`);
          
          // Check if it's a shell script without extension or with .sh extension
          if (!path.extname(startupScriptPath) || startupScriptPath.endsWith('.sh')) {
            logger.warn(`For shell scripts, consider adding "#!/bin/sh" or "#!/bin/bash" as the first line.`);
          }
        } else {
          // On Unix systems, we can be more direct about fixing permissions
          throw new Error(`Startup script is not executable: ${startupScriptPath}. AWS Lambda requires executable permissions. Please run 'chmod +x ${startupScriptPath}'`);
        }
      }
      
      // If it's a shell script, check for shebang
      if (!path.extname(startupScriptPath) || startupScriptPath.endsWith('.sh')) {
        try {
          const fileContent = fs.readFileSync(startupScriptPath, 'utf8');
          const firstLine = fileContent.split('\n')[0];
          
          if (!firstLine.startsWith('#!')) {
            logger.warn(`Warning: The startup script '${params.backendConfiguration.startupScript}' doesn't have a shebang line.`);
            logger.warn(`For shell scripts in Lambda, add "#!/bin/sh" or "#!/bin/bash" as the first line.`);
          }
        } catch (readError) {
          logger.warn(`Could not read startup script to check for shebang: ${readError}`);
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to check if startup script is executable: ${error.message}`);
    }
  }
  
  if (params.deploymentType === 'frontend' || params.deploymentType === 'fullstack') {
    if (!params.frontendConfiguration) {
      throw new Error('frontendConfiguration is required for frontend or fullstack deployments');
    }
    
    if (!params.frontendConfiguration.builtAssetsPath) {
      throw new Error('frontendConfiguration.builtAssetsPath is required');
    }
  }
}
