/**
 * Deployment Service
 * 
 * Handles the deployment of web applications to AWS serverless infrastructure.
 */

import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import * as handlebars from 'handlebars';
import { generateBootstrap } from './bootstrap-generator.js';
import { 
  DeployOptions, 
  DeployResult, 
  DeploymentConfiguration,
  DeploySamResult
} from '../types/index.js';
import * as os from 'os';
import { copyDirectory } from '../utils/fs-utils.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);
const mkdirAsync = promisify(fs.mkdir);
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
  const { deploymentType, source, framework, configuration } = options;
  
  try {
    // Validate options
    validateOptions(options);
    
    // Create deployment directory
    const deploymentDir = await createDeploymentDirectory(configuration.projectName);
    
    // Copy source code
    await copySourceCode(source.path, deploymentDir, deploymentType);
    
    // Generate bootstrap file for backend or fullstack deployments
    if (deploymentType === 'backend' || deploymentType === 'fullstack') {
      const backendDir = deploymentType === 'fullstack' 
        ? path.join(deploymentDir, 'src', 'backend')
        : path.join(deploymentDir, 'src');
      
      // Generate bootstrap file
      await generateBootstrap({
        framework: framework || configuration.backendConfiguration?.framework,
        entryPoint: configuration.backendConfiguration?.entryPoint,
        projectPath: backendDir,
        environment: configuration.backendConfiguration?.environment || {}
      });
    }
    
    // Generate SAM template
    await generateSamTemplate(deploymentType, deploymentDir, configuration);
    
    // Create initial deployment status
    updateDeploymentStatus(configuration.projectName, {
      status: 'preparing',
      message: `Preparing deployment of ${deploymentType} application. This may take several minutes.`,
      startTime: new Date().toISOString(),
      projectName: configuration.projectName,
      deploymentType,
      lastUpdated: new Date().toISOString()
    });
    
    // Schedule the build and deployment to start after a short delay
    // This ensures the response is sent before the long-running process starts
    setTimeout(() => {
      buildAndDeployApplication(deploymentDir, configuration)
        .catch((error: Error) => {
          logger.error('Build and deployment error:', error);
          updateDeploymentStatus(configuration.projectName, {
            status: 'error',
            message: `Build and deployment error: ${error.message}`,
            projectName: configuration.projectName,
            lastUpdated: new Date().toISOString()
          });
        });
    }, 100);
    
    return {
      status: 'preparing',
      message: `Deployment preparation started. Check status with deployment:${configuration.projectName} resource.`,
      stackName: configuration.projectName
    };
  } catch (error) {
    logger.error('Deployment failed:', error);
    
    // Update deployment status
    updateDeploymentStatus(configuration.projectName, {
      status: 'error',
      message: `Deployment failed: ${error instanceof Error ? error.message : String(error)}`,
      error: String(error),
      projectName: configuration.projectName,
      lastUpdated: new Date().toISOString()
    });
    
    return {
      status: 'error',
      message: `Deployment failed: ${error instanceof Error ? error.message : String(error)}`,
      error: String(error)
    };
  }
}

/**
 * Build and deploy the application using non-blocking spawn
 * 
 * @param deploymentDir - Path to deployment directory
 * @param configuration - Deployment configuration
 */
async function buildAndDeployApplication(
  deploymentDir: string, 
  configuration: DeploymentConfiguration
): Promise<void> {
  try {
    // Update status to building
    updateDeploymentStatus(configuration.projectName, {
      status: 'building',
      message: 'Building SAM application...',
      projectName: configuration.projectName,
      lastUpdated: new Date().toISOString()
    });
    
    // Run sam build in a non-blocking way
    await runSamBuild(deploymentDir, configuration.projectName);
    
    // Update status to deploying
    updateDeploymentStatus(configuration.projectName, {
      status: 'deploying',
      message: 'Deploying application to AWS...',
      projectName: configuration.projectName,
      lastUpdated: new Date().toISOString()
    });
    
    // Run sam deploy in a non-blocking way
    await runSamDeploy(deploymentDir, configuration);
    
    // Get stack outputs
    const outputs = await getStackOutputs(configuration.projectName);
    
    // Update status to success
    updateDeploymentStatus(configuration.projectName, {
      status: 'success',
      message: 'Deployment completed successfully',
      outputs,
      projectName: configuration.projectName,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    updateDeploymentStatus(configuration.projectName, {
      status: 'error',
      message: `Deployment process failed: ${error.message}`,
      projectName: configuration.projectName,
      lastUpdated: new Date().toISOString()
    });
  }
}

/**
 * Run SAM build using non-blocking spawn
 * 
 * @param deploymentDir - Path to deployment directory
 * @param projectName - Project name
 */
async function runSamBuild(deploymentDir: string, projectName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Create the build process
    const buildProcess = spawn('sam', ['build'], {
      cwd: deploymentDir,
      stdio: 'pipe',
      shell: true // Use shell for cross-platform compatibility
    });
    
    let buildOutput = '';
    let buildError = '';
    
    // Capture stdout
    buildProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      buildOutput += output;
      logger.info(`[${projectName} build] ${output.trim()}`);
    });
    
    // Capture stderr
    buildProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      buildError += output;
      logger.error(`[${projectName} build error] ${output.trim()}`);
    });
    
    // Handle process completion
    buildProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`SAM build failed with code ${code}: ${buildError}`));
      }
    });
    
    // Handle process errors
    buildProcess.on('error', (error) => {
      reject(new Error(`Failed to start SAM build: ${error.message}`));
    });
  });
}

/**
 * Run SAM deploy using non-blocking spawn
 * 
 * @param deploymentDir - Path to deployment directory
 * @param configuration - Deployment configuration
 */
async function runSamDeploy(
  deploymentDir: string, 
  configuration: DeploymentConfiguration
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Create the deploy process
    const deployProcess = spawn('sam', [
      'deploy',
      '--stack-name', configuration.projectName,
      '--capabilities', 'CAPABILITY_IAM',
      '--no-confirm-changeset',
      '--no-fail-on-empty-changeset'
    ], {
      cwd: deploymentDir,
      stdio: 'pipe',
      shell: true // Use shell for cross-platform compatibility
    });
    
    let deployOutput = '';
    let deployError = '';
    
    // Capture stdout
    deployProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      deployOutput += output;
      logger.info(`[${configuration.projectName} deploy] ${output.trim()}`);
    });
    
    // Capture stderr
    deployProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      deployError += output;
      logger.error(`[${configuration.projectName} deploy error] ${output.trim()}`);
    });
    
    // Handle process completion
    deployProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`SAM deploy failed with code ${code}: ${deployError}`));
      }
    });
    
    // Handle process errors
    deployProcess.on('error', (error) => {
      reject(new Error(`Failed to start SAM deploy: ${error.message}`));
    });
  });
}

/**
 * Get stack outputs
 * 
 * @param stackName - Stack name
 * @returns - Stack outputs
 */
async function getStackOutputs(stackName: string): Promise<Record<string, string>> {
  try {
    // Run the AWS CLI command to get stack outputs
    const { stdout } = await execAsync(
      `aws cloudformation describe-stacks --stack-name ${stackName} --query "Stacks[0].Outputs" --output json`
    );
    
    // Parse the outputs
    const outputs = JSON.parse(stdout);
    const formattedOutputs: Record<string, string> = {};
    
    if (Array.isArray(outputs)) {
      outputs.forEach((output: { OutputKey: string; OutputValue: string }) => {
        formattedOutputs[output.OutputKey] = output.OutputValue;
      });
    }
    
    return formattedOutputs;
  } catch (error: any) {
    logger.error(`Error getting stack outputs for ${stackName}:`, error);
    return {};
  }
}

/**
 * Validate deployment options
 * 
 * @param options - Deployment options
 */
function validateOptions(options: DeployOptions): void {
  const { deploymentType, source, configuration } = options;
  
  if (!deploymentType) {
    throw new Error('Deployment type is required');
  }
  
  if (!['backend', 'frontend', 'fullstack'].includes(deploymentType)) {
    throw new Error(`Invalid deployment type: ${deploymentType}`);
  }
  
  if (!source || !source.path) {
    throw new Error('Source path is required');
  }
  
  if (!configuration || !configuration.projectName) {
    throw new Error('Project name is required');
  }
  
  // Validate backend configuration
  if (deploymentType === 'backend' || deploymentType === 'fullstack') {
    const backendConfig = configuration.backendConfiguration;
    if (!backendConfig) {
      throw new Error('Backend configuration is required');
    }
    
    if (!backendConfig.runtime) {
      throw new Error('Runtime is required in backend configuration');
    }
  }
  
  // Validate frontend configuration
  if (deploymentType === 'frontend' || deploymentType === 'fullstack') {
    const frontendConfig = configuration.frontendConfiguration;
    if (!frontendConfig) {
      throw new Error('Frontend configuration is required');
    }
    
    if (!frontendConfig.indexDocument) {
      throw new Error('Index document is required in frontend configuration');
    }
  }
}

/**
 * Create deployment directory
 * 
 * @param projectName - Project name
 * @returns - Path to deployment directory
 */
async function createDeploymentDirectory(projectName: string): Promise<string> {
  const deploymentDir = path.join(process.cwd(), '.deployments', projectName);
  
  // Create deployment directory
  await mkdirAsync(deploymentDir, { recursive: true });
  
  // Create src directory
  await mkdirAsync(path.join(deploymentDir, 'src'), { recursive: true });
  
  return deploymentDir;
}

/**
 * Copy source code to deployment directory
 * 
 * @param sourcePath - Path to source code
 * @param deploymentDir - Path to deployment directory
 * @param deploymentType - Type of deployment
 */
async function copySourceCode(
  sourcePath: string, 
  deploymentDir: string, 
  deploymentType: string
): Promise<void> {
  if (deploymentType === 'fullstack') {
    // Create backend and frontend directories
    await mkdirAsync(path.join(deploymentDir, 'src', 'backend'), { recursive: true });
    await mkdirAsync(path.join(deploymentDir, 'src', 'frontend'), { recursive: true });
    
    // Copy backend code (cross-platform)
    const backendSourcePath = path.join(sourcePath, 'backend');
    const backendDestPath = path.join(deploymentDir, 'src', 'backend');
    await copyDirectory(backendSourcePath, backendDestPath);
    
    // Copy frontend code (cross-platform)
    const frontendSourcePath = path.join(sourcePath, 'frontend');
    const frontendDestPath = path.join(deploymentDir, 'src', 'frontend');
    await copyDirectory(frontendSourcePath, frontendDestPath);
  } else {
    // Copy source code (cross-platform)
    const destPath = path.join(deploymentDir, 'src');
    await copyDirectory(sourcePath, destPath);
  }
}

/**
 * Generate SAM template
 * 
 * @param deploymentType - Type of deployment
 * @param deploymentDir - Path to deployment directory
 * @param configuration - Deployment configuration
 */
async function generateSamTemplate(
  deploymentType: string, 
  deploymentDir: string, 
  configuration: DeploymentConfiguration
): Promise<void> {
  // Get template path based on deployment type
  const templatePath = path.join(__dirname, '..', '..', 'templates', `${deploymentType}.hbs`);
  
  // Read template
  const template = await readFileAsync(templatePath, 'utf8');
  
  // Register Handlebars helpers
  handlebars.registerHelper('ifEquals', function(this: any, arg1: any, arg2: any, options: any) {
    return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
  });
  
  handlebars.registerHelper('ifNotEquals', function(this: any, arg1: any, arg2: any, options: any) {
    return (arg1 !== arg2) ? options.fn(this) : options.inverse(this);
  });
  
  handlebars.registerHelper('ifExists', function(this: any, arg: any, options: any) {
    return arg ? options.fn(this) : options.inverse(this);
  });
  
  handlebars.registerHelper('eachInObject', function(object: any, options: any) {
    let result = '';
    for (const key in object) {
      result += options.fn({ key, value: object[key] });
    }
    return result;
  });
  
  // Compile template
  const compiledTemplate = handlebars.compile(template);
  
  // Render template with configuration
  const templateData = {
    description: `${deploymentType.charAt(0).toUpperCase() + deploymentType.slice(1)} application: ${configuration.projectName}`,
    ...configuration
  };
  
  const renderedTemplate = compiledTemplate(templateData);
  
  // Write template to deployment directory
  await writeFileAsync(path.join(deploymentDir, 'template.yaml'), renderedTemplate);
}

/**
 * Update deployment status
 * 
 * @param projectName - Project name
 * @param status - Deployment status
 */
function updateDeploymentStatus(projectName: string, status: any): void {
  const statusFilePath = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
  fs.writeFileSync(statusFilePath, JSON.stringify(status, null, 2));
}

export default {
  deploy
};
