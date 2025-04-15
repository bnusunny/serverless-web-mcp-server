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
    
    // Start deployment in background
    startBackgroundDeployment(deploymentDir, configuration);
    
    // Update deployment status
    updateDeploymentStatus(configuration.projectName, {
      status: 'in_progress',
      message: `Deployment of ${deploymentType} application started. Check status with deployment:${configuration.projectName} resource.`,
      startTime: new Date().toISOString(),
      projectName: configuration.projectName,
      deploymentType,
      lastUpdated: new Date().toISOString()
    });
    
    return {
      status: 'in_progress',
      message: `Deployment of ${deploymentType} application started. Check status with deployment:${configuration.projectName} resource.`,
      stackName: configuration.projectName
    };
  } catch (error) {
    console.error('Deployment failed:', error);
    
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
 * Start deployment in background
 * 
 * @param deploymentDir - Path to deployment directory
 * @param configuration - Deployment configuration
 */
function startBackgroundDeployment(
  deploymentDir: string, 
  configuration: DeploymentConfiguration
): void {
  // Create a Node.js script for the deployment process
  const deployScriptPath = path.join(deploymentDir, 'deploy.js');
  const statusCheckScriptPath = path.join(deploymentDir, 'status-check.js');
  
  // Create deployment script
  const deployScript = `
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    try {
      console.log('Building SAM application...');
      execSync('sam build', { cwd: '${deploymentDir.replace(/\\/g, '\\\\')}', stdio: 'inherit' });
      
      console.log('Deploying SAM application...');
      execSync('sam deploy --stack-name ${configuration.projectName} --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset', 
        { cwd: '${deploymentDir.replace(/\\/g, '\\\\')}', stdio: 'inherit' });
      
      console.log('Getting stack outputs...');
      const outputs = execSync('aws cloudformation describe-stacks --stack-name ${configuration.projectName} --query "Stacks[0].Outputs" --output json', 
        { encoding: 'utf8' });
      
      fs.writeFileSync(path.join('${deploymentDir.replace(/\\/g, '\\\\')}', 'outputs.json'), outputs);
      console.log('Deployment completed successfully.');
    } catch (error) {
      console.error('Deployment failed:', error);
      process.exit(1);
    }
  `;
  
  // Create status check script
  const statusCheckScript = `
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    
    const DEPLOYMENT_STATUS_DIR = '${DEPLOYMENT_STATUS_DIR.replace(/\\/g, '\\\\')}';
    const projectName = '${configuration.projectName}';
    const deploymentDir = '${deploymentDir.replace(/\\/g, '\\\\')}';
    
    function updateStatus(status) {
      const statusFilePath = path.join(DEPLOYMENT_STATUS_DIR, \`\${projectName}.json\`);
      fs.writeFileSync(statusFilePath, JSON.stringify({
        ...status,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    }
    
    async function checkStatus() {
      try {
        // Check if outputs.json exists (deployment completed)
        if (fs.existsSync(path.join(deploymentDir, 'outputs.json'))) {
          const outputs = JSON.parse(fs.readFileSync(path.join(deploymentDir, 'outputs.json'), 'utf8'));
          updateStatus({
            status: 'success',
            message: 'Deployment completed successfully',
            outputs,
            projectName
          });
          return true; // Exit the loop
        }
        
        // Check CloudFormation stack status
        try {
          const stackStatusCmd = 'aws cloudformation describe-stacks --stack-name ' + 
            projectName + ' --query "Stacks[0].StackStatus" --output text';
          const stackStatus = execSync(stackStatusCmd, { encoding: 'utf8' }).trim();
          
          if (stackStatus === 'CREATE_COMPLETE' || stackStatus === 'UPDATE_COMPLETE') {
            // Get outputs
            const outputsCmd = 'aws cloudformation describe-stacks --stack-name ' + 
              projectName + ' --query "Stacks[0].Outputs" --output json';
            const outputs = JSON.parse(execSync(outputsCmd, { encoding: 'utf8' }));
            
            updateStatus({
              status: 'success',
              message: 'Deployment completed successfully',
              outputs,
              projectName
            });
            return true; // Exit the loop
          } else if (stackStatus === 'CREATE_FAILED' || stackStatus === 'ROLLBACK_COMPLETE' || 
                    stackStatus === 'UPDATE_FAILED') {
            updateStatus({
              status: 'error',
              message: 'Deployment failed with status: ' + stackStatus,
              projectName
            });
            return true; // Exit the loop
          } else {
            updateStatus({
              status: 'in_progress',
              message: 'Deployment in progress with status: ' + stackStatus,
              projectName
            });
          }
        } catch (error) {
          // Stack might not exist yet
          updateStatus({
            status: 'in_progress',
            message: 'Preparing deployment...',
            projectName
          });
        }
        
        return false; // Continue the loop
      } catch (error) {
        console.error('Error checking status:', error);
        return false; // Continue the loop
      }
    }
    
    async function main() {
      while (true) {
        const done = await checkStatus();
        if (done) break;
        
        // Sleep for 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    main().catch(console.error);
  `;
  
  // Write scripts to files
  fs.writeFileSync(deployScriptPath, deployScript);
  fs.writeFileSync(statusCheckScriptPath, statusCheckScript);
  
  // Make scripts executable on Unix-like systems
  if (os.platform() !== 'win32') {
    try {
      fs.chmodSync(deployScriptPath, '755');
      fs.chmodSync(statusCheckScriptPath, '755');
    } catch (error) {
      console.error('Error making scripts executable:', error);
    }
  }
  
  // Start deployment process
  const deployProcess = spawn('node', [deployScriptPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  
  // Unref the process to allow the parent process to exit
  deployProcess.unref();
  
  // Start status check process
  const statusCheckProcess = spawn('node', [statusCheckScriptPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  
  // Unref the status check process
  statusCheckProcess.unref();
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
