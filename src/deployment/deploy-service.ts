/**
 * Deployment Service
 * 
 * Handles the deployment of web applications to AWS serverless infrastructure.
 */

import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import handlebars from 'handlebars';
// Remove fileURLToPath import
import { 
  DeployOptions, 
  DeployResult, 
  DeploymentConfiguration,
  DeploySamResult,
  BackendDeployOptions
} from '../types/index.js';
import * as os from 'os';
import { logger } from '../utils/logger.js';
import { generateStartupScript, StartupScriptOptions } from './startup-script-generator.js';
// We're not importing uploadFrontendAssets since it's handled in deploy.ts
// import { uploadFrontendAssets } from './frontend-upload.js';

// Get directory path for CommonJS
const __dirname = path.resolve();

const execAsync = promisify(exec);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

// Define the directory where deployment status files will be stored
const DEPLOYMENT_STATUS_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-deployments');

// Ensure the directory exists
if (!fs.existsSync(DEPLOYMENT_STATUS_DIR)) {
  fs.mkdirSync(DEPLOYMENT_STATUS_DIR, { recursive: true });
}

/**
 * Deploy a web application to AWS serverless infrastructure
 * 
 * @param options - Deployment options
 * @returns - Deployment result
 */
export async function deploy(options: DeployOptions): Promise<DeployResult> {
  const { deploymentType, projectName, projectRoot } = options;
  
  logger.info(`[DEPLOY START] Starting deployment process for ${projectName}`);
  logger.info(`Deployment type: ${deploymentType}`);
  
  try {
    // Check if we need to generate a startup script
    if ((deploymentType === 'backend' || deploymentType === 'fullstack') && 
        options.backendConfiguration?.generateStartupScript && 
        options.backendConfiguration?.entryPoint) {
      
      logger.info(`Generating startup script for ${projectName}...`);
      
      try {
        const startupScriptName = await generateStartupScript({
          runtime: options.backendConfiguration.runtime,
          entryPoint: options.backendConfiguration.entryPoint,
          builtArtifactsPath: options.backendConfiguration.builtArtifactsPath,
          startupScriptName: options.backendConfiguration.startupScript,
          additionalEnv: options.backendConfiguration.environment
        });
        
        // Update the configuration with the generated script name
        options.backendConfiguration.startupScript = startupScriptName;
        
        logger.info(`Startup script generated: ${startupScriptName}`);
      } catch (error) {
        if (error.name === 'EntryPointNotFoundError') {
          // Provide a more helpful error message for entry point not found
          throw new Error(`Failed to generate startup script: ${error.message}. Please check that your entry point file exists in the built artifacts directory and the path is correct.`);
        }
        throw error;
      }
    }
    
    // Create deployment configuration
    const configuration: DeploymentConfiguration = {
      projectName,
      region: options.region || 'us-east-1',
      backendConfiguration: options.backendConfiguration,
      frontendConfiguration: options.frontendConfiguration
    };
    
    // Validate configuration
    validateConfiguration(configuration, deploymentType);
    
    // Log deployment status
    logger.info(`Deployment status for ${projectName}: preparing`);
    logger.info('Preparing deployment...');
    
    // Generate SAM template
    await generateSamTemplate(projectRoot, configuration, deploymentType);
    
    // Deploy the application
    await buildAndDeployApplication(projectRoot, configuration, deploymentType);
    
    // Get deployment result
    const result = await getDeploymentResult(projectName);
    
    logger.info(`[DEPLOY COMPLETE] Deployment completed for ${projectName}`);
    return result;
  } catch (error: any) {
    logger.error(`[DEPLOY ERROR] Deployment failed for ${projectName}: ${error.message}`);
    
    // Log deployment error
    logger.error(`Deployment process failed: ${error.message}`);
    
    return {
      status: 'error',
      message: `Deployment failed: ${error.message}`,
      projectName
    };
  }
}
