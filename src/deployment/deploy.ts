import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getTemplateInfo } from './templates.js';

// Type for status update callback
type StatusCallback = (status: string) => void;

/**
 * Deploy an application to AWS serverless infrastructure
 */
export async function deployApplication(params: any, statusCallback?: StatusCallback): Promise<any> {
  const { deploymentType, framework, configuration, source } = params;
  
  try {
    // Send status update
    sendStatus(statusCallback, `Starting deployment of ${configuration.projectName}...`);
    
    // Validate parameters
    validateDeploymentParams(params);
    
    // Get appropriate template based on deployment type and framework
    const templateName = getTemplateNameForDeployment(deploymentType, framework);
    
    sendStatus(statusCallback, `Using template: ${templateName}`);
    
    // Get template information
    const templateInfo = await getTemplateInfo(templateName);
    
    // Create a temporary directory for the deployment
    sendStatus(statusCallback, `Preparing deployment files...`);
    const deploymentDir = await prepareDeploymentDirectory(source.path, templateInfo.path, configuration);
    
    // Deploy using AWS SAM CLI
    sendStatus(statusCallback, `Starting AWS SAM deployment...`);
    const deploymentResult = await deployWithSAM(deploymentDir, configuration, statusCallback);
    
    // Parse the outputs from CloudFormation to get the deployed resources
    sendStatus(statusCallback, `Deployment completed. Processing results...`);
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

/**
 * Send a status update via the callback if provided
 */
function sendStatus(callback?: StatusCallback, message?: string): void {
  if (callback && message) {
    callback(message);
    console.log(message); // Also log to console
  }
}

/**
 * Prepare a deployment directory with the source code and template
 */
async function prepareDeploymentDirectory(sourcePath: string, templatePath: string, configuration: any): Promise<string> {
  // In a real implementation, this would:
  // 1. Create a temporary directory
  // 2. Copy the source code to the directory
  // 3. Copy and customize the template for the specific deployment
  // 4. Return the path to the prepared directory
  
  // For now, we'll just return the source path
  console.log(`Preparing deployment directory for ${configuration.projectName}...`);
  console.log(`Source path: ${sourcePath}`);
  console.log(`Template path: ${templatePath}`);
  
  // Check if the template file exists
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }
  
  // Check if the source directory exists
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source directory not found: ${sourcePath}`);
  }
  
  return sourcePath;
}

/**
 * Deploy the application using AWS SAM CLI
 */
async function deployWithSAM(deploymentDir: string, configuration: any, statusCallback?: StatusCallback): Promise<any> {
  return new Promise((resolve, reject) => {
    sendStatus(statusCallback, `Deploying ${configuration.projectName} with AWS SAM CLI...`);
    
    // In a real implementation, this would spawn the AWS SAM CLI process
    // and stream the output to the client
    
    // Mock deployment stages with status updates
    setTimeout(() => {
      sendStatus(statusCallback, `Building application...`);
      
      setTimeout(() => {
        sendStatus(statusCallback, `Packaging artifacts...`);
        
        setTimeout(() => {
          sendStatus(statusCallback, `Uploading to S3...`);
          
          setTimeout(() => {
            sendStatus(statusCallback, `Creating CloudFormation stack...`);
            
            setTimeout(() => {
              sendStatus(statusCallback, `Waiting for CloudFormation stack creation...`);
              
              setTimeout(() => {
                sendStatus(statusCallback, `CloudFormation stack creation completed.`);
                
                // Mock CloudFormation outputs based on deployment type
                const outputs = mockCloudFormationOutputs(configuration);
                
                sendStatus(statusCallback, `Deployment of ${configuration.projectName} completed successfully.`);
                
                resolve({
                  success: true,
                  outputs
                });
              }, 1000);
            }, 1000);
          }, 500);
        }, 500);
      }, 500);
    }, 500); // Simulate deployment stages with delays
  });
}

/**
 * Execute AWS SAM CLI command
 * This would be used in a real implementation
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
 * Mock CloudFormation outputs for different deployment types
 */
function mockCloudFormationOutputs(configuration: any): Record<string, string> {
  const projectName = configuration.projectName;
  const region = configuration.region || 'us-east-1';
  
  // Determine deployment type from configuration
  let deploymentType = 'backend';
  if (configuration.frontendConfiguration && !configuration.backendConfiguration) {
    deploymentType = 'frontend';
  } else if (configuration.frontendConfiguration && configuration.backendConfiguration) {
    deploymentType = 'fullstack';
  }
  
  // Generate mock outputs based on deployment type
  switch (deploymentType) {
    case 'backend':
      return {
        'ApiEndpoint': `https://abcdef1234.execute-api.${region}.amazonaws.com/prod`,
        'FunctionArn': `arn:aws:lambda:${region}:123456789012:function:${projectName}-function`,
        'FunctionName': `${projectName}-function`
      };
      
    case 'frontend':
      return {
        'BucketName': `${projectName}-bucket`,
        'BucketUrl': `${projectName}-bucket.s3.amazonaws.com`,
        'CloudFrontDistributionId': 'E1A2B3C4D5E6F7',
        'CloudFrontDomainName': `d1234abcdef.cloudfront.net`
      };
      
    case 'fullstack':
      return {
        'ApiEndpoint': `https://abcdef1234.execute-api.${region}.amazonaws.com/prod`,
        'FunctionArn': `arn:aws:lambda:${region}:123456789012:function:${projectName}-backend-function`,
        'FunctionName': `${projectName}-backend-function`,
        'BucketName': `${projectName}-frontend-bucket`,
        'BucketUrl': `${projectName}-frontend-bucket.s3.amazonaws.com`,
        'CloudFrontDistributionId': 'E1A2B3C4D5E6F7',
        'CloudFrontDomainName': `d1234abcdef.cloudfront.net`
      };
      
    default:
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
      name: outputs.FunctionName ? `${outputs.FunctionName}-api` : 'api',
      url: outputs.ApiEndpoint
    });
  }
  
  if (outputs.BucketName) {
    resources.push({
      type: 'AWS::S3::Bucket',
      name: outputs.BucketName,
      url: outputs.BucketUrl
    });
  }
  
  if (outputs.CloudFrontDomainName) {
    resources.push({
      type: 'AWS::CloudFront::Distribution',
      name: outputs.CloudFrontDistributionId,
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
