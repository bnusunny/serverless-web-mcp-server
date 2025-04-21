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
import { DeploymentStatus } from './types.js';
import * as os from 'os';
import { logger } from '../utils/logger.js';
import { generateStartupScript, StartupScriptOptions } from './startup-script-generator.js';
import { validateConfiguration } from './validation.js';
import { installDependencies } from './dependency-installer.js';
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
  const { deploymentType, projectName } = options;
  
  // Convert relative project root to absolute path
  const projectRoot = path.isAbsolute(options.projectRoot) 
    ? options.projectRoot 
    : path.resolve(process.cwd(), options.projectRoot);
  
  logger.info(`[DEPLOY START] Starting deployment process for ${projectName}`);
  logger.info(`Deployment type: ${deploymentType}`);
  logger.info(`Project root: ${projectRoot}`);
  
  try {
    // If backend configuration exists, convert relative paths to absolute
    if ((deploymentType === 'backend' || deploymentType === 'fullstack') && 
        options.backendConfiguration) {
      
      if (!path.isAbsolute(options.backendConfiguration.builtArtifactsPath)) {
        options.backendConfiguration.builtArtifactsPath = path.resolve(
          process.cwd(), 
          options.backendConfiguration.builtArtifactsPath
        );
      }
      
      logger.info(`Backend artifacts path: ${options.backendConfiguration.builtArtifactsPath}`);
    }
    
    // If frontend configuration exists, convert relative paths to absolute
    if ((deploymentType === 'frontend' || deploymentType === 'fullstack') && 
        options.frontendConfiguration) {
      
      if (!path.isAbsolute(options.frontendConfiguration.builtAssetsPath)) {
        options.frontendConfiguration.builtAssetsPath = path.resolve(
          process.cwd(), 
          options.frontendConfiguration.builtAssetsPath
        );
      }
      
      logger.info(`Frontend assets path: ${options.frontendConfiguration.builtAssetsPath}`);
    }
    
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
    
    // Install dependencies for backend deployments
    if ((deploymentType === 'backend' || deploymentType === 'fullstack') && 
        options.backendConfiguration) {
      
      logger.info(`Installing dependencies for ${projectName}...`);
      
      try {
        await installDependencies(
          projectRoot,
          options.backendConfiguration.builtArtifactsPath,
          options.backendConfiguration.runtime
        );
        
        logger.info(`Dependencies installed successfully for ${projectName}`);
      } catch (error) {
        logger.warn(`Failed to install dependencies: ${error.message}`);
        // Continue with deployment even if dependency installation fails
        // This allows users to bundle dependencies themselves if needed
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
      status: DeploymentStatus.FAILED,
      message: `Deployment failed: ${error.message}`,
      error: error.message,
      projectName
    };
  }
}

/**
 * Generate a SAM template for the deployment
 * @param {string} projectRoot - Project root directory
 * @param {DeploymentConfiguration} configuration - Deployment configuration
 * @param {string} deploymentType - Deployment type
 * @returns {Promise<void>}
 */
async function generateSamTemplate(
  projectRoot: string,
  configuration: DeploymentConfiguration,
  deploymentType: string
): Promise<void> {
  // Implementation details...
  logger.info('Generating SAM template...');
}

/**
 * Build and deploy the application using SAM CLI
 * @param {string} projectRoot - Project root directory
 * @param {DeploymentConfiguration} configuration - Deployment configuration
 * @param {string} deploymentType - Deployment type
 * @returns {Promise<void>}
 */
async function buildAndDeployApplication(
  projectRoot: string,
  configuration: DeploymentConfiguration,
  deploymentType: string
): Promise<void> {
  logger.info('Deploying application...');
  
  const stackName = `${configuration.projectName}-${Date.now().toString().slice(-6)}`;
  
  try {
    // Create samconfig.toml file
    const samConfigPath = path.join(projectRoot, 'samconfig.toml');
    const samConfigContent = `
[default]
[default.deploy]
[default.deploy.parameters]
stack_name = "${stackName}"
s3_bucket = "aws-sam-cli-managed-default-samclisourcebucket-${Math.random().toString(36).substring(2, 10)}"
s3_prefix = "${stackName}"
region = "${configuration.region}"
confirm_changeset = false
capabilities = "CAPABILITY_IAM"
disable_rollback = true
`;
    fs.writeFileSync(samConfigPath, samConfigContent);
    logger.debug(`Created samconfig.toml at ${samConfigPath}`);
    
    // Deploy the SAM application
    logger.info(`Deploying SAM application with stack name: ${stackName}...`);
    await new Promise<void>((resolve, reject) => {
      const samDeploy = spawn('sam', [
        'deploy',
        '--stack-name', stackName,
        '--region', configuration.region,
        '--capabilities', 'CAPABILITY_IAM',
        '--no-confirm-changeset'
      ], {
        cwd: projectRoot,
        stdio: 'inherit'
      });
      
      samDeploy.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`SAM deploy failed with code ${code}`));
        }
      });
      
      samDeploy.on('error', (err) => {
        reject(err);
      });
    });
    
    logger.info('SAM deployment completed successfully');
  } catch (error) {
    logger.error(`SAM deployment failed: ${error}`);
    throw new Error(`Failed to deploy application: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the deployment result for a project
 * @param {string} projectName - Project name
 * @returns {Promise<DeployResult>} Deployment result
 */
async function getDeploymentResult(projectName: string): Promise<DeployResult> {
  // Implementation details...
  logger.info(`Getting deployment result for ${projectName}...`);
  
  return {
    status: DeploymentStatus.DEPLOYED,
    message: 'Deployment completed successfully',
    projectName
  };
}
