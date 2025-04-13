import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getTemplateInfo } from './templates.js';
import { exec } from 'child_process';
import os from 'os';

// Type for status update callback
type StatusCallback = (status: string) => void;

/**
 * Deploy an application to AWS serverless infrastructure
 */
export async function deployApplication(params: any, statusCallback?: StatusCallback): Promise<any> {
  const { deploymentType, framework, configuration, source } = params;
  
  try {
    // Send status update
    sendStatus(statusCallback, `Starting deployment of ${configuration.projectName}...`, configuration.projectName);
    
    // Validate parameters
    validateDeploymentParams(params);
    
    // Get appropriate template based on deployment type and framework
    const templateName = getTemplateNameForDeployment(deploymentType, framework);
    
    sendStatus(statusCallback, `Using template: ${templateName}`, configuration.projectName);
    
    // Get template information
    const templateInfo = await getTemplateInfo(templateName);
    
    // Create a temporary directory for the deployment
    sendStatus(statusCallback, `Preparing deployment files...`, configuration.projectName);
    const deploymentDir = await prepareDeploymentDirectory(source.path, templateInfo.path, configuration, statusCallback);
    
    // Deploy using AWS SAM CLI
    sendStatus(statusCallback, `Starting AWS SAM deployment...`, configuration.projectName);
    const deploymentResult = await deployWithSAM(deploymentDir, configuration, statusCallback);
    
    // Parse the outputs from CloudFormation to get the deployed resources
    sendStatus(statusCallback, `Deployment completed. Processing results...`, configuration.projectName);
    const resources = parseCloudFormationOutputs(deploymentResult.outputs);
    
    return {
      status: 'deployed',
      deploymentType,
      framework,
      projectName: configuration.projectName,
      template: templateInfo,
      resources,
      outputs: deploymentResult.outputs
    };
  } catch (error) {
    console.error('Deployment failed:', error);
    sendStatus(statusCallback, `Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

import { storeDeploymentProgress } from './status.js';

/**
 * Send a status update via the callback if provided
 */
function sendStatus(callback?: StatusCallback, message?: string, projectName?: string): void {
  if (message) {
    if (callback) {
      callback(message);
    }
    console.log(message); // Log to console
    
    // Store progress in the deployment status file if project name is provided
    if (projectName) {
      storeDeploymentProgress(projectName, message);
    }
  }
}

/**
 * Prepare a deployment directory with the source code and template
 */
async function prepareDeploymentDirectory(
  sourcePath: string, 
  templatePath: string, 
  configuration: any,
  statusCallback?: StatusCallback
): Promise<string> {
  sendStatus(statusCallback, `Creating deployment directory for ${configuration.projectName}...`);
  
  // Create a temporary directory
  const tempDir = path.join(os.tmpdir(), `deploy-${configuration.projectName}-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  sendStatus(statusCallback, `Created temporary directory: ${tempDir}`);
  
  // Copy source code to the temporary directory
  sendStatus(statusCallback, `Copying source code from ${sourcePath}...`);
  await copyDirectory(sourcePath, path.join(tempDir, 'src'), statusCallback);
  
  // Copy and customize the template
  sendStatus(statusCallback, `Copying and customizing template from ${templatePath}...`);
  const templateDestPath = path.join(tempDir, 'template.yaml');
  fs.copyFileSync(templatePath, templateDestPath);
  
  // Customize the template based on configuration
  await customizeTemplate(templateDestPath, configuration, statusCallback);
  
  sendStatus(statusCallback, `Deployment directory prepared successfully.`);
  return tempDir;
}

/**
 * Copy a directory recursively
 */
async function copyDirectory(src: string, dest: string, statusCallback?: StatusCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(dest, { recursive: true });
    
    fs.readdir(src, { withFileTypes: true }, (err, entries) => {
      if (err) {
        reject(err);
        return;
      }
      
      let pending = entries.length;
      if (pending === 0) {
        resolve();
        return;
      }
      
      entries.forEach(entry => {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
          copyDirectory(srcPath, destPath, statusCallback)
            .then(() => {
              if (--pending === 0) resolve();
            })
            .catch(reject);
        } else {
          fs.copyFile(srcPath, destPath, err => {
            if (err) {
              reject(err);
              return;
            }
            
            if (--pending === 0) resolve();
          });
        }
      });
    });
  });
}

/**
 * Customize the template based on configuration
 */
async function customizeTemplate(templatePath: string, configuration: any, statusCallback?: StatusCallback): Promise<void> {
  sendStatus(statusCallback, `Customizing template with project configuration...`);
  
  // Read the template file
  let templateContent = fs.readFileSync(templatePath, 'utf8');
  
  // Replace placeholders with configuration values
  templateContent = templateContent.replace(/\${ProjectName}/g, configuration.projectName);
  templateContent = templateContent.replace(/\${Region}/g, configuration.region || 'us-east-1');
  
  // Apply deployment-specific customizations
  if (configuration.backendConfiguration) {
    templateContent = templateContent.replace(/\${Runtime}/g, configuration.backendConfiguration.runtime || 'nodejs18.x');
    templateContent = templateContent.replace(/\${MemorySize}/g, configuration.backendConfiguration.memorySize || '512');
    templateContent = templateContent.replace(/\${Timeout}/g, configuration.backendConfiguration.timeout || '30');
  }
  
  if (configuration.frontendConfiguration) {
    templateContent = templateContent.replace(/\${IndexDocument}/g, configuration.frontendConfiguration.indexDocument || 'index.html');
    templateContent = templateContent.replace(/\${ErrorDocument}/g, configuration.frontendConfiguration.errorDocument || 'index.html');
  }
  
  // Write the customized template back to the file
  fs.writeFileSync(templatePath, templateContent);
  
  sendStatus(statusCallback, `Template customized successfully.`);
}

/**
 * Deploy the application using AWS SAM CLI
 */
async function deployWithSAM(deploymentDir: string, configuration: any, statusCallback?: StatusCallback): Promise<any> {
  try {
    sendStatus(statusCallback, `Deploying ${configuration.projectName} with AWS SAM CLI...`);
    
    // Step 1: Build the application
    sendStatus(statusCallback, `Building application...`);
    const buildResult = await executeSamCommand(
      ['build', '--use-container'],
      deploymentDir,
      statusCallback
    );
    
    // Step 2: Deploy the application
    sendStatus(statusCallback, `Deploying application...`);
    const deployArgs = [
      'deploy',
      '--stack-name', `${configuration.projectName}-stack`,
      '--capabilities', 'CAPABILITY_IAM',
      '--no-confirm-changeset',
      '--region', configuration.region || 'us-east-1'
    ];
    
    // Add parameter overrides based on configuration
    const paramOverrides = buildParameterOverrides(configuration);
    if (paramOverrides.length > 0) {
      deployArgs.push('--parameter-overrides', paramOverrides.join(' '));
    }
    
    const deployResult = await executeSamCommand(
      deployArgs,
      deploymentDir,
      statusCallback
    );
    
    // Step 3: Get the CloudFormation outputs
    sendStatus(statusCallback, `Retrieving deployment outputs...`);
    const describeResult = await executeAwsCommand(
      [
        'cloudformation', 'describe-stacks',
        '--stack-name', `${configuration.projectName}-stack`,
        '--region', configuration.region || 'us-east-1',
        '--query', 'Stacks[0].Outputs'
      ],
      statusCallback
    );
    
    // Parse the outputs
    const outputs = parseAwsOutputs(describeResult.stdout);
    
    sendStatus(statusCallback, `Deployment of ${configuration.projectName} completed successfully.`);
    
    return {
      success: true,
      outputs
    };
  } catch (error) {
    sendStatus(statusCallback, `Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Build parameter overrides for SAM deployment
 */
function buildParameterOverrides(configuration: any): string[] {
  const overrides: string[] = [];
  
  // Add common parameters
  overrides.push(`ProjectName=${configuration.projectName}`);
  
  // Add backend-specific parameters
  if (configuration.backendConfiguration) {
    if (configuration.backendConfiguration.runtime) {
      overrides.push(`Runtime=${configuration.backendConfiguration.runtime}`);
    }
    
    if (configuration.backendConfiguration.memorySize) {
      overrides.push(`MemorySize=${configuration.backendConfiguration.memorySize}`);
    }
    
    if (configuration.backendConfiguration.timeout) {
      overrides.push(`Timeout=${configuration.backendConfiguration.timeout}`);
    }
  }
  
  // Add frontend-specific parameters
  if (configuration.frontendConfiguration) {
    if (configuration.frontendConfiguration.indexDocument) {
      overrides.push(`IndexDocument=${configuration.frontendConfiguration.indexDocument}`);
    }
    
    if (configuration.frontendConfiguration.errorDocument) {
      overrides.push(`ErrorDocument=${configuration.frontendConfiguration.errorDocument}`);
    }
  }
  
  return overrides;
}

/**
 * Execute AWS SAM CLI command
 */
async function executeSamCommand(command: string[], cwd: string, statusCallback?: StatusCallback): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    sendStatus(statusCallback, `Executing: sam ${command.join(' ')}`);
    
    const process = spawn('sam', command, { cwd });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      sendStatus(statusCallback, chunk.trim());
    });
    
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      sendStatus(statusCallback, `[ERROR] ${chunk.trim()}`);
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`SAM command failed with exit code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Execute AWS CLI command
 */
async function executeAwsCommand(command: string[], statusCallback?: StatusCallback): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    sendStatus(statusCallback, `Executing: aws ${command.join(' ')}`);
    
    const process = spawn('aws', command);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
    });
    
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      sendStatus(statusCallback, `[ERROR] ${chunk.trim()}`);
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`AWS CLI command failed with exit code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse AWS CLI JSON output
 */
function parseAwsOutputs(output: string): Record<string, string> {
  try {
    const outputs: Record<string, string> = {};
    const parsedOutput = JSON.parse(output);
    
    if (Array.isArray(parsedOutput)) {
      parsedOutput.forEach(item => {
        if (item.OutputKey && item.OutputValue) {
          outputs[item.OutputKey] = item.OutputValue;
        }
      });
    }
    
    return outputs;
  } catch (error) {
    console.error('Error parsing AWS outputs:', error);
    return {};
  }
}

/**
 * Parse CloudFormation outputs into a structured resource list
 */
function parseCloudFormationOutputs(outputs: Record<string, string>): any[] {
  const resources: any[] = [];
  
  // Convert CloudFormation outputs to resource objects
  if (outputs.FunctionName) {
    resources.push({
      type: 'AWS::Lambda::Function',
      name: outputs.FunctionName,
      arn: outputs.FunctionArn
    });
  }
  
  if (outputs.ApiEndpoint) {
    resources.push({
      type: 'AWS::ApiGateway::RestApi',
      name: outputs.ApiName || (outputs.FunctionName ? `${outputs.FunctionName}-api` : 'api'),
      url: outputs.ApiEndpoint
    });
  }
  
  if (outputs.BucketName) {
    resources.push({
      type: 'AWS::S3::Bucket',
      name: outputs.BucketName,
      url: outputs.BucketUrl || `${outputs.BucketName}.s3.amazonaws.com`
    });
  }
  
  if (outputs.CloudFrontDomainName) {
    resources.push({
      type: 'AWS::CloudFront::Distribution',
      name: outputs.CloudFrontDistributionId || 'CloudFrontDistribution',
      url: `https://${outputs.CloudFrontDomainName}`
    });
  }
  
  return resources;
}

/**
 * Validate deployment parameters
 */
function validateDeploymentParams(params: any): void {
  const { deploymentType, source, framework, configuration } = params;
  
  // Check required parameters
  if (!deploymentType) {
    throw new Error('deploymentType is required');
  }
  
  if (!source) {
    throw new Error('source is required');
  }
  
  if (!framework) {
    throw new Error('framework is required');
  }
  
  if (!configuration || !configuration.projectName) {
    throw new Error('configuration.projectName is required');
  }
  
  // Check source
  if (source.path && !fs.existsSync(source.path)) {
    throw new Error(`Source path does not exist: ${source.path}`);
  }
  
  // Validate deployment type
  const validDeploymentTypes = ['backend', 'frontend', 'fullstack'];
  if (!validDeploymentTypes.includes(deploymentType)) {
    throw new Error(`Invalid deploymentType: ${deploymentType}. Must be one of: ${validDeploymentTypes.join(', ')}`);
  }
  
  // Validate framework based on deployment type
  validateFramework(deploymentType, framework);
  
  // Validate configuration based on deployment type
  validateConfiguration(deploymentType, configuration);
}

/**
 * Validate configuration based on deployment type
 */
function validateConfiguration(deploymentType: string, configuration: any): void {
  // Common validation
  if (!configuration.region) {
    configuration.region = 'us-east-1'; // Default region
  }
  
  // Deployment-specific validation
  switch (deploymentType) {
    case 'backend':
      if (!configuration.backendConfiguration) {
        configuration.backendConfiguration = {}; // Use defaults if not provided
      }
      break;
      
    case 'frontend':
      if (!configuration.frontendConfiguration) {
        configuration.frontendConfiguration = {}; // Use defaults if not provided
      }
      
      // Set default values for frontend configuration
      if (!configuration.frontendConfiguration.indexDocument) {
        configuration.frontendConfiguration.indexDocument = 'index.html';
      }
      
      if (!configuration.frontendConfiguration.errorDocument) {
        configuration.frontendConfiguration.errorDocument = 'index.html';
      }
      break;
      
    case 'fullstack':
      // Ensure both backend and frontend configurations exist
      if (!configuration.backendConfiguration) {
        configuration.backendConfiguration = {}; // Use defaults if not provided
      }
      
      if (!configuration.frontendConfiguration) {
        configuration.frontendConfiguration = {
          indexDocument: 'index.html',
          errorDocument: 'index.html'
        };
      }
      break;
  }
}

/**
 * Validate framework based on deployment type
 */
function validateFramework(deploymentType: string, framework: string): void {
  const validFrameworks: Record<string, string[]> = {
    backend: ['express', 'koa', 'fastify', 'nest'],
    frontend: ['react', 'vue', 'angular', 'static'],
    fullstack: ['express-react', 'express-vue', 'nest-react', 'nest-vue']
  };
  
  if (!validFrameworks[deploymentType].includes(framework)) {
    throw new Error(`Invalid framework '${framework}' for deploymentType '${deploymentType}'. Valid frameworks: ${validFrameworks[deploymentType].join(', ')}`);
  }
}

/**
 * Get template name based on deployment type and framework
 */
function getTemplateNameForDeployment(deploymentType: string, framework: string): string {
  // Map deployment type and framework to template name
  const templateMap: Record<string, Record<string, string>> = {
    backend: {
      express: 'express-backend',
      koa: 'express-backend', // Use express template for koa for now
      fastify: 'express-backend', // Use express template for fastify for now
      nest: 'express-backend' // Use express template for nest for now
    },
    frontend: {
      react: 'frontend-website',
      vue: 'frontend-website', // Use same template for vue for now
      angular: 'frontend-website', // Use same template for angular for now
      static: 'static-website'
    },
    fullstack: {
      'express-react': 'express-fullstack',
      'express-vue': 'express-fullstack', // Use same template for vue for now
      'nest-react': 'express-fullstack', // Use same template for nest for now
      'nest-vue': 'express-fullstack' // Use same template for nest-vue for now
    }
  };
  
  const templateName = templateMap[deploymentType]?.[framework];
  
  if (!templateName) {
    throw new Error(`No template found for deploymentType '${deploymentType}' and framework '${framework}'`);
  }
  
  return templateName;
}
