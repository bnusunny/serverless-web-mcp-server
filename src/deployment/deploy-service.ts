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
import { renderTemplate } from '../template/renderer.js';
import * as os from 'os';
import { logger } from '../utils/logger.js';
import { generateStartupScript, StartupScriptOptions } from './startup-script-generator.js';
import { installDependencies } from './dependency-installer.js';
import { uploadFrontendAssets } from './frontend-upload.js';
import { initializeDeploymentStatus, storeDeploymentMetadata, storeDeploymentError } from './status.js';

// Get directory path for CommonJS
const __dirname = path.resolve();

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
export async function deployApplication(options: DeployOptions): Promise<DeployResult> {
  const { deploymentType, projectName } = options;
  
  // Convert relative project root to absolute path
  const projectRoot = path.isAbsolute(options.projectRoot) 
    ? options.projectRoot 
    : path.resolve(process.cwd(), options.projectRoot);
  
  logger.info(`[DEPLOY START] Starting deployment process for ${projectName}`);
  
  // Update deployment status using the status.ts module
  await initializeDeploymentStatus(projectName, deploymentType, 
    options.backendConfiguration?.framework || options.frontendConfiguration?.framework || 'unknown');
  
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
      } catch (error: any) {
        if (error.name === 'EntryPointNotFoundError') {
          // Provide a more helpful error message for entry point not found
          throw new Error(`Failed to generate startup script: ${error.message}. Please check that your entry point file exists in the built artifacts directory and the path is correct.`);
        }
        throw error;
      }
    }
    
    // Install dependencies for backend deployments
    // if ((deploymentType === 'backend' || deploymentType === 'fullstack') && 
    //     options.backendConfiguration) {
      
    //   logger.info(`Installing dependencies for ${projectName}...`);
      
    //   try {
    //     await installDependencies(
    //       projectRoot,
    //       options.backendConfiguration.builtArtifactsPath,
    //       options.backendConfiguration.runtime
    //     );
        
    //     logger.info(`Dependencies installed successfully for ${projectName}`);
    //   } catch (error: any) {
    //     logger.warn(`Failed to install dependencies: ${error.message}`);
    //     // Continue with deployment even if dependency installation fails
    //     // This allows users to bundle dependencies themselves if needed
    //   }
    // }
    
    // Create deployment configuration
    const configuration: DeploymentConfiguration = {
      projectName,
      region: options.region || 'us-east-1',
      backendConfiguration: options.backendConfiguration,
      frontendConfiguration: options.frontendConfiguration
    };
    
    // Validate configuration
    // validateConfiguration(configuration, deploymentType);
    
    // Log deployment status
    logger.info(`Deployment status for ${projectName}: preparing`);
    logger.info('Preparing deployment...');
    
    // Generate SAM template
    await generateSamTemplate(projectRoot, configuration, deploymentType);
    
    // Deploy the application
    const deployResult = await buildAndDeployApplication(projectRoot, configuration, deploymentType);
    
    // Upload frontend assets for frontend or fullstack deployments
    if ((deploymentType === 'frontend' || deploymentType === 'fullstack') && 
        configuration.frontendConfiguration?.builtAssetsPath) {
      logger.info('Uploading frontend assets...');
      await uploadFrontendAssets(configuration, deployResult);
    }
    
    // Get deployment result
    const result = await getDeploymentResult(projectName);
    
    // Update deployment status with success information
    await storeDeploymentMetadata(projectName, {
      status: DeploymentStatus.DEPLOYED,
      success: true,
      outputs: deployResult.outputs,
      url: deployResult.outputs.ApiUrl || deployResult.outputs.WebsiteUrl || null,
      resources: {
        api: deployResult.outputs.ApiUrl || null,
        website: deployResult.outputs.WebsiteUrl || null,
        distribution: deployResult.outputs.CloudFrontDistribution || null,
        bucket: deployResult.outputs.WebsiteBucket || null
      },
      stackName: deployResult.stackName,
      updatedAt: new Date().toISOString()
    });
    
    logger.info(`[DEPLOY COMPLETE] Deployment completed for ${projectName}`);
    return result;
  } catch (error: any) {
    logger.error(`[DEPLOY ERROR] Deployment failed for ${projectName}: ${error.message}`);
    
    // Log deployment error
    logger.error(`Deployment process failed: ${error.message}`);
    
    // Update deployment status with error information
    await storeDeploymentError(projectName, error);
    
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
  deploymentType: 'backend' | 'frontend' | 'fullstack'
): Promise<void> {
  logger.info('Generating SAM template...');
  
  try {
    // Create the deployment parameters object
    const deploymentParams = {
      projectRoot,
      deploymentType,
      projectName: configuration.projectName,
      region: configuration.region,
      backendConfiguration: configuration.backendConfiguration,
      frontendConfiguration: configuration.frontendConfiguration
    };
    
    // Render the template using the template renderer
    const renderedTemplate = await renderTemplate(deploymentParams);
    
    // Write the template to the project root
    const templatePath = path.join(projectRoot, 'template.yaml');
    fs.writeFileSync(templatePath, renderedTemplate);
    
    logger.info(`SAM template generated at ${templatePath}`);
  } catch (error: any) {
    logger.error(`Failed to generate SAM template: ${error}`);
    throw new Error(`Failed to generate SAM template: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Build and deploy the application using SAM CLI
 * @param {string} projectRoot - Project root directory
 * @param {DeploymentConfiguration} configuration - Deployment configuration
 * @param {string} deploymentType - Deployment type
 * @returns {Promise<any>} Deployment result with outputs
 */
async function buildAndDeployApplication(
  projectRoot: string,
  configuration: DeploymentConfiguration,
  deploymentType: string
): Promise<any> {
  logger.info('Deploying application...');
  
  const stackName = `${configuration.projectName}-${Date.now().toString().slice(-6)}`;
  
  try {
    // Create samconfig.toml file
    const samConfigPath = path.join(projectRoot, 'samconfig.toml');
    const samConfigContent = `version = 0.1
[default]
[default.deploy]
[default.deploy.parameters]
stack_name = "${stackName}"
resolve_s3 = true
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
    
    // Get the deployment outputs
    const outputs = await getStackOutputs(stackName, configuration.region);
    return { stackName, outputs };
  } catch (error) {
    logger.error(`SAM deployment failed: ${error}`);
    throw new Error(`Failed to deploy application: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get CloudFormation stack outputs
 * @param {string} stackName - Stack name
 * @param {string} region - AWS region
 * @returns {Promise<any>} Stack outputs
 */
async function getStackOutputs(stackName: string, region: string): Promise<any> {
  try {
    const { stdout } = await promisify(exec)(
      `aws cloudformation describe-stacks --stack-name ${stackName} --region ${region} --query "Stacks[0].Outputs" --output json`
    );
    
    const outputs = JSON.parse(stdout);
    const result: Record<string, string> = {};
    
    if (Array.isArray(outputs)) {
      outputs.forEach(output => {
        result[output.OutputKey] = output.OutputValue;
      });
    }
    
    return result;
  } catch (error) {
    logger.error(`Failed to get stack outputs: ${error}`);
    return {};
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

/**
 * Get the status of a deployment - this is now just a wrapper around the status.ts implementation
 * @param {string} projectName - Project name
 * @returns {Promise<object|null>} Deployment status object or null if not found
 */
export async function getDeploymentStatus(projectName: string): Promise<any> {
  // Import and use the getDeploymentStatus function from status.ts
  const { getDeploymentStatus: getStatus } = await import('./status.js');
  return getStatus(projectName);
}
