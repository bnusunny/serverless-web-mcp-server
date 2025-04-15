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
    
    // Copy backend code
    const backendSourcePath = path.join(sourcePath, 'backend');
    await execAsync(`cp -r ${backendSourcePath}/* ${path.join(deploymentDir, 'src', 'backend')}`);
    
    // Copy frontend code
    const frontendSourcePath = path.join(sourcePath, 'frontend');
    await execAsync(`cp -r ${frontendSourcePath}/* ${path.join(deploymentDir, 'src', 'frontend')}`);
  } else {
    // Copy source code
    await execAsync(`cp -r ${sourcePath}/* ${path.join(deploymentDir, 'src')}`);
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
  // Run deployment in background
  const deploymentProcess = spawn('bash', ['-c', `
    cd "${deploymentDir}" && 
    echo "Building SAM application..." && 
    sam build && 
    echo "Deploying SAM application..." && 
    sam deploy --stack-name ${configuration.projectName} --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset && 
    echo "Getting stack outputs..." && 
    aws cloudformation describe-stacks --stack-name ${configuration.projectName} --query "Stacks[0].Outputs" --output json > outputs.json && 
    echo "Deployment completed successfully."
  `], {
    detached: true,
    stdio: 'ignore'
  });
  
  // Unref the process to allow the parent process to exit
  deploymentProcess.unref();
  
  // Set up a process to check deployment status periodically
  const statusCheckProcess = spawn('bash', ['-c', `
    cd "${deploymentDir}" && 
    while true; do
      if [ -f "outputs.json" ]; then
        # Deployment completed successfully
        OUTPUTS=$(cat outputs.json)
        echo "{
          \\"status\\": \\"success\\",
          \\"message\\": \\"Deployment completed successfully\\",
          \\"outputs\\": $OUTPUTS,
          \\"projectName\\": \\"${configuration.projectName}\\",
          \\"lastUpdated\\": \\"\$(date -u +"%Y-%m-%dT%H:%M:%SZ")\\"
        }" > "${DEPLOYMENT_STATUS_DIR}/${configuration.projectName}.json"
        exit 0
      fi
      
      # Check if the deployment is still running
      STACK_STATUS=$(aws cloudformation describe-stacks --stack-name ${configuration.projectName} --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "STACK_NOT_FOUND")
      
      if [[ "$STACK_STATUS" == "CREATE_COMPLETE" || "$STACK_STATUS" == "UPDATE_COMPLETE" ]]; then
        # Get outputs
        OUTPUTS=$(aws cloudformation describe-stacks --stack-name ${configuration.projectName} --query "Stacks[0].Outputs" --output json)
        echo "{
          \\"status\\": \\"success\\",
          \\"message\\": \\"Deployment completed successfully\\",
          \\"outputs\\": $OUTPUTS,
          \\"projectName\\": \\"${configuration.projectName}\\",
          \\"lastUpdated\\": \\"\$(date -u +"%Y-%m-%dT%H:%M:%SZ")\\"
        }" > "${DEPLOYMENT_STATUS_DIR}/${configuration.projectName}.json"
        exit 0
      elif [[ "$STACK_STATUS" == "CREATE_FAILED" || "$STACK_STATUS" == "ROLLBACK_COMPLETE" || "$STACK_STATUS" == "UPDATE_FAILED" ]]; then
        # Deployment failed
        echo "{
          \\"status\\": \\"error\\",
          \\"message\\": \\"Deployment failed with status: $STACK_STATUS\\",
          \\"projectName\\": \\"${configuration.projectName}\\",
          \\"lastUpdated\\": \\"\$(date -u +"%Y-%m-%dT%H:%M:%SZ")\\"
        }" > "${DEPLOYMENT_STATUS_DIR}/${configuration.projectName}.json"
        exit 1
      elif [[ "$STACK_STATUS" == "STACK_NOT_FOUND" ]]; then
        # Stack not found yet, still in early stages
        echo "{
          \\"status\\": \\"in_progress\\",
          \\"message\\": \\"Preparing deployment...\\",
          \\"projectName\\": \\"${configuration.projectName}\\",
          \\"lastUpdated\\": \\"\$(date -u +"%Y-%m-%dT%H:%M:%SZ")\\"
        }" > "${DEPLOYMENT_STATUS_DIR}/${configuration.projectName}.json"
      else
        # Deployment in progress
        echo "{
          \\"status\\": \\"in_progress\\",
          \\"message\\": \\"Deployment in progress with status: $STACK_STATUS\\",
          \\"projectName\\": \\"${configuration.projectName}\\",
          \\"lastUpdated\\": \\"\$(date -u +"%Y-%m-%dT%H:%M:%SZ")\\"
        }" > "${DEPLOYMENT_STATUS_DIR}/${configuration.projectName}.json"
      fi
      
      # Sleep for 10 seconds before checking again
      sleep 10
    done
  `], {
    detached: true,
    stdio: 'ignore'
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

/**
 * Deploy SAM application (synchronous version - not used in main flow)
 * 
 * @param deploymentDir - Path to deployment directory
 * @param configuration - Deployment configuration
 * @returns - Deployment result
 */
async function deploySamApplication(
  deploymentDir: string, 
  configuration: DeploymentConfiguration
): Promise<DeploySamResult> {
  // Build SAM application
  console.log('Building SAM application...');
  await execAsync('sam build', { cwd: deploymentDir });
  
  // Deploy SAM application
  console.log('Deploying SAM application...');
  const deployCommand = `sam deploy --stack-name ${configuration.projectName} --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset`;
  await execAsync(deployCommand, { cwd: deploymentDir });
  
  // Get stack outputs
  console.log('Getting stack outputs...');
  const { stdout } = await execAsync(`aws cloudformation describe-stacks --stack-name ${configuration.projectName} --query "Stacks[0].Outputs" --output json`);
  
  const outputs = JSON.parse(stdout);
  const formattedOutputs: Record<string, string> = {};
  
  outputs.forEach((output: { OutputKey: string; OutputValue: string }) => {
    formattedOutputs[output.OutputKey] = output.OutputValue;
  });
  
  return { outputs: formattedOutputs };
}

export default {
  deploy
};
