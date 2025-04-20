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
  DeploySamResult
} from '../types/index.js';
import * as os from 'os';
import { logger } from '../utils/logger.js';
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
    // Create deployment configuration
    const configuration: DeploymentConfiguration = {
      projectName,
      region: options.region || 'us-east-1',
      backendConfiguration: options.backendConfiguration,
      frontendConfiguration: options.frontendConfiguration
    };
    
    // Validate configuration
    validateConfiguration(configuration, deploymentType);
    
    // Update deployment status
    updateDeploymentStatus(projectName, {
      status: 'preparing',
      message: 'Preparing deployment...',
      projectName,
      lastUpdated: new Date().toISOString()
    });
    
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
    
    // Update deployment status
    updateDeploymentStatus(projectName, {
      status: 'error',
      message: `Deployment process failed: ${error.message}`,
      projectName,
      lastUpdated: new Date().toISOString()
    });
    
    return {
      status: 'error',
      message: `Deployment failed: ${error.message}`,
      projectName
    };
  }
}

/**
 * Validate deployment configuration
 * 
 * @param configuration - Deployment configuration
 * @param deploymentType - Type of deployment
 */
function validateConfiguration(configuration: DeploymentConfiguration, deploymentType: string): void {
  // Common validation
  if (!configuration.projectName) {
    throw new Error('Project name is required');
  }
  
  // Backend validation
  if (deploymentType === 'backend' || deploymentType === 'fullstack') {
    if (!configuration.backendConfiguration) {
      throw new Error('Backend configuration is required for backend or fullstack deployments');
    }
    
    const backendConfig = configuration.backendConfiguration;
    
    if (!backendConfig.builtArtifactsPath) {
      throw new Error('Built artifacts path is required for backend deployment');
    }
    
    if (!fs.existsSync(backendConfig.builtArtifactsPath)) {
      throw new Error(`Built artifacts path not found: ${backendConfig.builtArtifactsPath}`);
    }
    
    // Check if startup script exists
    const startupScript = backendConfig.startupScript || 'bootstrap';
    const startupScriptPath = path.join(backendConfig.builtArtifactsPath, startupScript);
    
    if (!fs.existsSync(startupScriptPath)) {
      throw new Error(`Startup script not found: ${startupScriptPath}`);
    }
    
    // Make startup script executable
    try {
      fs.chmodSync(startupScriptPath, 0o755);
    } catch (error) {
      logger.warn(`Failed to make startup script executable: ${error}`);
    }
    
    if (!backendConfig.runtime) {
      throw new Error('Runtime is required for backend deployment');
    }
  }
  
  // Frontend validation
  if (deploymentType === 'frontend' || deploymentType === 'fullstack') {
    if (!configuration.frontendConfiguration) {
      throw new Error('Frontend configuration is required for frontend or fullstack deployments');
    }
    
    const frontendConfig = configuration.frontendConfiguration;
    
    if (!frontendConfig.builtAssetsPath) {
      throw new Error('Built assets path is required for frontend deployment');
    }
    
    if (!fs.existsSync(frontendConfig.builtAssetsPath)) {
      throw new Error(`Built assets path not found: ${frontendConfig.builtAssetsPath}`);
    }
    
    // Check if index document exists
    const indexDocument = frontendConfig.indexDocument || 'index.html';
    const indexDocumentPath = path.join(frontendConfig.builtAssetsPath, indexDocument);
    
    if (!fs.existsSync(indexDocumentPath)) {
      throw new Error(`Index document not found: ${indexDocumentPath}`);
    }
    
    // If custom domain is provided, certificate ARN is required
    if (frontendConfig.customDomain && !frontendConfig.certificateArn) {
      throw new Error('Certificate ARN is required when using a custom domain');
    }
  }
}

/**
 * Generate SAM template for the application
 * 
 * @param projectRoot - Path to project root directory
 * @param configuration - Deployment configuration
 * @param deploymentType - Type of deployment
 */
async function generateSamTemplate(
  projectRoot: string, 
  configuration: DeploymentConfiguration,
  deploymentType: string
): Promise<void> {
  logger.info(`[TEMPLATE] Generating SAM template for ${configuration.projectName}`);
  
  try {
    // Register handlebars helpers
    registerHandlebarsHelpers();
    
    // Determine template path
    const templatePath = path.join(__dirname, '..', '..', 'templates', `${deploymentType}.hbs`);
    logger.info(`Using template: ${templatePath}`);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    // Read template file
    const templateContent = await readFileAsync(templatePath, 'utf8');
    
    // Compile template
    const template = handlebars.compile(templateContent);
    
    // Generate template with configuration
    const description = `Serverless ${deploymentType} application: ${configuration.projectName}`;
    const samTemplate = template({
      ...configuration,
      description
    });
    
    // Write template to file
    const outputPath = path.join(projectRoot, 'template.yaml');
    await writeFileAsync(outputPath, samTemplate);
    
    logger.info(`SAM template generated: ${outputPath}`);
  } catch (error: any) {
    logger.error(`Failed to generate SAM template: ${error.message}`);
    throw new Error(`Failed to generate SAM template: ${error.message}`);
  }
}

/**
 * Register handlebars helpers
 */
function registerHandlebarsHelpers(): void {
  // Helper to check if a value exists
  handlebars.registerHelper('ifExists', function(this: any, value: any, options: any) {
    return value ? options.fn(this) : options.inverse(this);
  });
  
  // Helper to check if two values are equal
  handlebars.registerHelper('ifEquals', function(this: any, v1: any, v2: any, options: any) {
    return v1 === v2 ? options.fn(this) : options.inverse(this);
  });
  
  // Helper to iterate over object properties
  handlebars.registerHelper('eachInObject', function(this: any, object: any, options: any) {
    if (!object) return '';
    
    let result = '';
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        result += options.fn({ key, value: object[key] });
      }
    }
    return result;
  });
  
  // Helper to check if a string starts with a prefix
  handlebars.registerHelper('startsWith', function(this: any, str: string, prefix: string, options: any) {
    return str && str.startsWith(prefix) ? options.fn(this) : options.inverse(this);
  });
}

/**
 * Build and deploy the application using non-blocking spawn
 * 
 * @param projectRoot - Path to project root directory
 * @param configuration - Deployment configuration
 * @param deploymentType - Type of deployment
 */
async function buildAndDeployApplication(
  projectRoot: string, 
  configuration: DeploymentConfiguration,
  deploymentType: string
): Promise<void> {
  try {
    logger.info(`[BUILD START] Starting build and deployment process for ${configuration.projectName}`);
    
    // Update status to building
    updateDeploymentStatus(configuration.projectName, {
      status: 'building',
      message: 'Building application...',
      projectName: configuration.projectName,
      lastUpdated: new Date().toISOString()
    });
    logger.info(`Updated deployment status to 'building'`);
    
    // Run sam build
    logger.info(`[BUILD] Executing SAM build for ${configuration.projectName}`);
    await runSamBuild(projectRoot, configuration.projectName);
    logger.info(`[BUILD COMPLETE] SAM build completed for ${configuration.projectName}`);
    
    // Update status to deploying
    updateDeploymentStatus(configuration.projectName, {
      status: 'deploying',
      message: 'Deploying application...',
      projectName: configuration.projectName,
      lastUpdated: new Date().toISOString()
    });
    logger.info(`Updated deployment status to 'deploying'`);
    
    // Run sam deploy
    logger.info(`[DEPLOY] Executing SAM deploy for ${configuration.projectName}`);
    const deployResult = await runSamDeploy(projectRoot, configuration.projectName, configuration.region);
    logger.info(`[DEPLOY COMPLETE] SAM deploy completed for ${configuration.projectName}`);
    
    // Update status to deployed
    updateDeploymentStatus(configuration.projectName, {
      status: 'deployed',
      message: 'Application deployed successfully',
      projectName: configuration.projectName,
      outputs: deployResult.outputs,
      lastUpdated: new Date().toISOString()
    });
    logger.info(`Updated deployment status to 'deployed'`);
  } catch (error: any) {
    logger.error(`[BUILD/DEPLOY ERROR] Build or deployment failed: ${error.message}`);
    throw error;
  }
}

/**
 * Run SAM build command
 * 
 * @param projectRoot - Path to project root directory
 * @param projectName - Name of the project
 */
async function runSamBuild(projectRoot: string, projectName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const samBuild = spawn('sam', ['build'], {
      cwd: projectRoot,
      shell: true
    });
    
    samBuild.stdout.on('data', (data) => {
      const message = data.toString().trim();
      logger.info(`[SAM BUILD] ${message}`);
      
      // Update status with build progress
      updateDeploymentStatus(projectName, {
        status: 'building',
        message: `Building: ${message}`,
        projectName,
        lastUpdated: new Date().toISOString()
      });
    });
    
    samBuild.stderr.on('data', (data) => {
      const message = data.toString().trim();
      logger.error(`[SAM BUILD ERROR] ${message}`);
    });
    
    samBuild.on('close', (code) => {
      if (code === 0) {
        logger.info(`SAM build completed successfully for ${projectName}`);
        resolve();
      } else {
        reject(new Error(`SAM build failed with code ${code}`));
      }
    });
    
    samBuild.on('error', (error) => {
      logger.error(`Failed to start SAM build: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Run SAM deploy command
 * 
 * @param projectRoot - Path to project root directory
 * @param projectName - Name of the project
 * @param region - AWS region
 */
async function runSamDeploy(
  projectRoot: string, 
  projectName: string,
  region: string
): Promise<DeploySamResult> {
  return new Promise<DeploySamResult>((resolve, reject) => {
    const stackName = `${projectName}-stack`;
    
    const samDeploy = spawn('sam', [
      'deploy',
      '--stack-name', stackName,
      '--region', region,
      '--capabilities', 'CAPABILITY_IAM',
      '--no-confirm-changeset',
      '--no-fail-on-empty-changeset'
    ], {
      cwd: projectRoot,
      shell: true
    });
    
    let outputs: Record<string, string> = {};
    
    samDeploy.stdout.on('data', (data) => {
      const message = data.toString().trim();
      logger.info(`[SAM DEPLOY] ${message}`);
      
      // Update status with deploy progress
      updateDeploymentStatus(projectName, {
        status: 'deploying',
        message: `Deploying: ${message}`,
        projectName,
        lastUpdated: new Date().toISOString()
      });
      
      // Extract outputs from CloudFormation
      if (message.includes('OutputKey')) {
        const match = message.match(/OutputKey=([\w]+)\s+OutputValue=([^\s]+)/);
        if (match && match.length === 3) {
          const key = match[1];
          const value = match[2];
          outputs[key] = value;
        }
      }
    });
    
    samDeploy.stderr.on('data', (data) => {
      const message = data.toString().trim();
      logger.error(`[SAM DEPLOY ERROR] ${message}`);
    });
    
    samDeploy.on('close', (code) => {
      if (code === 0) {
        logger.info(`SAM deploy completed successfully for ${projectName}`);
        resolve({
          status: 'success',
          message: 'Deployment completed successfully',
          outputs,
          stackName
        });
      } else {
        reject(new Error(`SAM deploy failed with code ${code}`));
      }
    });
    
    samDeploy.on('error', (error) => {
      logger.error(`Failed to start SAM deploy: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Update deployment status
 * 
 * @param projectName - Name of the project
 * @param status - Deployment status
 */
export function updateDeploymentStatus(projectName: string, status: any): void {
  try {
    const statusFilePath = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
    fs.writeFileSync(statusFilePath, JSON.stringify(status, null, 2));
  } catch (error: any) {
    logger.error(`Failed to update deployment status: ${error.message}`);
  }
}

/**
 * Get deployment status
 * 
 * @param projectName - Name of the project
 */
export function getDeploymentStatus(projectName: string): any {
  try {
    const statusFilePath = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
    if (fs.existsSync(statusFilePath)) {
      const statusContent = fs.readFileSync(statusFilePath, 'utf8');
      return JSON.parse(statusContent);
    }
  } catch (error: any) {
    logger.error(`Failed to get deployment status: ${error.message}`);
  }
  
  return {
    status: 'unknown',
    message: 'Deployment status not found',
    projectName,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get deployment result
 * 
 * @param projectName - Name of the project
 */
export async function getDeploymentResult(projectName: string): Promise<DeployResult> {
  const status = getDeploymentStatus(projectName);
  
  if (status.status === 'deployed') {
    const outputs = status.outputs || {};
    
    return {
      status: 'success',
      message: 'Deployment completed successfully',
      projectName,
      stackName: `${projectName}-stack`,
      apiUrl: outputs.ApiEndpoint,
      websiteUrl: outputs.CloudFrontURL || outputs.CustomDomainURL
    };
  } else if (status.status === 'error') {
    return {
      status: 'error',
      message: status.message || 'Deployment failed',
      projectName,
      error: status.error
    };
  } else {
    return {
      status: status.status,
      message: status.message || 'Deployment in progress',
      projectName
    };
  }
}

/**
 * List all deployments
 */
export function listDeployments(): string[] {
  try {
    const files = fs.readdirSync(DEPLOYMENT_STATUS_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error: any) {
    logger.error(`Failed to list deployments: ${error.message}`);
    return [];
  }
}
