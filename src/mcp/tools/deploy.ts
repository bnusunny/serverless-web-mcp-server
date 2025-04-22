/**
 * Deploy Tool
 * 
 * Handles deployment of web applications to AWS serverless infrastructure.
 */

import { z } from 'zod';
import { McpTool } from '../types/mcp-tool.js';
import { deployApplication } from '../../deployment/deploy-service.js';
import { DeployOptions } from '../../deployment/types.js';
import { logger } from '../../utils/logger.js';
import path from 'path';
import fs from 'fs';
import * as os from 'os';

// Define the directory where deployment status files will be stored
const DEPLOYMENT_STATUS_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-deployments');

/**
 * Checks if dependencies appear to be installed in the builtArtifactsPath
 */
function checkDependenciesInstalled(builtArtifactsPath: string, runtime: string): boolean {
  try {
    // For Node.js, check for node_modules directory
    if (runtime.includes('nodejs')) {
      return fs.existsSync(path.join(builtArtifactsPath, 'node_modules'));
    }
    
    // For Python, check for dependencies
    if (runtime.includes('python')) {
      // Check for traditional Python package directories
      if (fs.existsSync(path.join(builtArtifactsPath, 'site-packages')) || 
          fs.existsSync(path.join(builtArtifactsPath, '.venv')) ||
          fs.existsSync(path.join(builtArtifactsPath, 'dist-packages'))) {
        return true;
      }
      
      // Check for pip installed dependencies directly in the directory (using -t .)
      // Look for .dist-info directories which indicate installed packages
      try {
        const files = fs.readdirSync(builtArtifactsPath);
        // If we find any .dist-info directories, we have dependencies
        return files.some(file => file.endsWith('.dist-info'));
      } catch (error) {
        logger.error('Error reading directory for Python dependencies', error);
        return false;
      }
    }
    
    // For Ruby, check for vendor/bundle directory
    if (runtime.includes('ruby')) {
      return fs.existsSync(path.join(builtArtifactsPath, 'vendor/bundle'));
    }
    
    // For other runtimes, assume dependencies are installed
    return true;
  } catch (error) {
    logger.error('Error checking for dependencies', error);
    return false;
  }
}

/**
 * Check if a deployment type change is destructive
 * @param currentType Previous deployment type
 * @param newType New deployment type
 * @returns Object with isDestructive flag and warning message
 */
async function checkDestructiveDeploymentChange(projectName: string, newType: string): Promise<{isDestructive: boolean, warning?: string}> {
  try {
    // Check if there's an existing deployment
    const statusFilePath = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
    
    if (!fs.existsSync(statusFilePath)) {
      // No existing deployment, so not destructive
      return { isDestructive: false };
    }
    
    // Read the existing deployment status
    const statusData = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
    const currentType = statusData.deploymentType;
    
    if (!currentType || currentType === newType) {
      // No type change or same type, not destructive
      return { isDestructive: false };
    }
    
    // Define destructive changes
    const destructiveChanges = [
      { from: 'backend', to: 'frontend' },
      { from: 'frontend', to: 'backend' },
      { from: 'fullstack', to: 'backend' },
      { from: 'fullstack', to: 'frontend' }
    ];
    
    // Check if this is a destructive change
    const isDestructive = destructiveChanges.some(change => 
      change.from === currentType && change.to === newType
    );
    
    if (isDestructive) {
      let recommendation = '';
      
      // Provide specific recommendations based on the change
      if (currentType === 'backend' && newType === 'frontend') {
        recommendation = "Consider using 'fullstack' deployment type instead, which can maintain your backend while adding frontend capabilities.";
      } else if (currentType === 'frontend' && newType === 'backend') {
        recommendation = "Consider using 'fullstack' deployment type instead, which can maintain your frontend while adding backend capabilities.";
      } else if (currentType === 'fullstack') {
        recommendation = "Consider keeping the 'fullstack' deployment type and simply updating the configuration you need.";
      }
      
      return {
        isDestructive: true,
        warning: `WARNING: Changing deployment type from ${currentType} to ${newType} is destructive and will delete existing resources, potentially causing data loss. ${recommendation}`
      };
    }
    
    return { isDestructive: false };
  } catch (error) {
    logger.error('Error checking for destructive deployment change', error);
    return { isDestructive: false }; // Default to non-destructive on error
  }
}

/**
 * Handler for the deploy tool
 */
export async function handleDeploy(params: DeployOptions): Promise<any> {
  try {
    logger.debug('Deploy tool called with params', { params });
    
    // Validate that projectRoot is provided and is an absolute path or convert it
    if (!params.projectRoot) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: "Project root is required",
              error: "Missing required parameter: projectRoot"
            }, null, 2)
          }
        ]
      };
    }
    
    // Check if this is a destructive deployment type change
    const destructiveCheck = await checkDestructiveDeploymentChange(params.projectName, params.deploymentType);
    if (destructiveCheck.isDestructive) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: "Destructive deployment type change detected",
              warning: destructiveCheck.warning,
              error: "Destructive change requires confirmation",
              action: "Please reconsider your deployment strategy based on the recommendation above."
            }, null, 2)
          }
        ]
      };
    }
    
    // Check for dependencies if this is a backend deployment
    if ((params.deploymentType === 'backend' || params.deploymentType === 'fullstack') && 
        params.backendConfiguration) {
      
      // Determine the full path to artifacts directory
      let fullArtifactsPath = params.backendConfiguration.builtArtifactsPath;
      
      // If builtArtifactsPath is not an absolute path, resolve it against projectRoot
      if (!path.isAbsolute(fullArtifactsPath)) {
        fullArtifactsPath = path.resolve(params.projectRoot, params.backendConfiguration.builtArtifactsPath);
      }
      
      const depsInstalled = checkDependenciesInstalled(
        fullArtifactsPath,
        params.backendConfiguration.runtime
      );
      
      if (!depsInstalled) {
        let instructions = "";
        
        if (params.backendConfiguration.runtime.includes('nodejs')) {
          instructions = `1. Copy package.json to ${params.backendConfiguration.builtArtifactsPath}\n2. Run 'npm install --omit-dev' in ${params.backendConfiguration.builtArtifactsPath}`;
        } else if (params.backendConfiguration.runtime.includes('python')) {
          instructions = `1. Copy requirements.txt to ${params.backendConfiguration.builtArtifactsPath}\n2. Run 'pip install -r requirements.txt -t .' in ${params.backendConfiguration.builtArtifactsPath}`;
        } else if (params.backendConfiguration.runtime.includes('ruby')) {
          instructions = `1. Copy Gemfile to ${params.backendConfiguration.builtArtifactsPath}\n2. Run 'bundle install' in ${params.backendConfiguration.builtArtifactsPath}`;
        } else {
          instructions = `Install all required dependencies in ${params.backendConfiguration.builtArtifactsPath}`;
        }
        
        const errorMessage = `
IMPORTANT: Dependencies not found in builtArtifactsPath (${params.backendConfiguration.builtArtifactsPath}).

For ${params.backendConfiguration.runtime}, please:

${instructions}

Please install dependencies and try again.
        `;
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                message: "Dependencies not found in builtArtifactsPath",
                error: "Missing dependencies",
                instructions: errorMessage
              }, null, 2)
            }
          ]
        };
      }
    }
    
    // Start the deployment process in the background with setTimeout(0)
    setTimeout(() => {
      deployApplication(params)
        .then(result => {
          logger.info(`Background deployment completed for ${params.projectName} with result: ${JSON.stringify(result)}`);
        })
        .catch(error => {
          logger.error(`Background deployment failed for ${params.projectName}:`, error);
        });
    }, 0);
    
    // Return an immediate response
    const responseText = JSON.stringify({
      success: true,
      message: `Deployment of ${params.projectName} initiated successfully.`,
      status: 'INITIATED',
      note: `The deployment process is running in the background and may take several minutes to complete.`,
      checkStatus: `To check the status of your deployment, use the resource: deployment:${params.projectName}`
    }, null, 2);
    
    const response = {
      content: [
        {
          type: "text",
          text: responseText
        }
      ]
    };
    
    logger.debug('Deploy tool response', { response });
    return response;
  } catch (error: any) {
    logger.error('Deploy tool error', { error: error.message, stack: error.stack });
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            message: `Deployment failed: ${error.message}`,
            error: error.message
          }, null, 2)
        }
      ]
    };
  }
}

/**
 * Deploy tool definition
 */
const deployTool: McpTool = {
  name: 'deploy',
  description: 'Deploy web applications to AWS, including database resources like DynamoDB tables.',
  parameters: {
    deploymentType: z.enum(['backend', 'frontend', 'fullstack']).describe('Type of deployment'),
    projectName: z.string().describe('Project name'),
    projectRoot: z.string().describe('Absolute path to the project root directory'),
    region: z.string().optional().default('us-east-1').describe('AWS region'),
    backendConfiguration: z.object({
      builtArtifactsPath: z.string().describe('Path to pre-built backend artifacts. Can be absolute or relative to projectRoot'),
      framework: z.string().optional().describe('Backend framework'),
      runtime: z.string().describe('Lambda runtime (e.g. nodejs22.x, nodejs20.x, nodejs18.x, python3.13, python3.12, python3.11, python3.10, python3.9)'),
      startupScript: z.string().optional().describe('Startup script that must be executable in Linux environment (chmod +x) and take no parameters. Required unless entryPoint and generateStartupScript are provided.'),
      entryPoint: z.string().optional().describe('Application entry point file (e.g., app.js, app.py). If provided with generateStartupScript=true, a startup script will be automatically generated.'),
      generateStartupScript: z.boolean().optional().default(false).describe('Whether to automatically generate a startup script based on the runtime and entry point'),
      architecture: z.enum(['x86_64', 'arm64']).optional().default('x86_64').describe('Lambda architecture'),
      memorySize: z.number().optional().default(512).describe('Lambda memory size'),
      timeout: z.number().optional().default(30).describe('Lambda timeout'),
      stage: z.string().optional().default('prod').describe('API Gateway stage'),
      cors: z.boolean().optional().default(true).describe('Enable CORS'),
      port: z.number().describe('Port on which the web application runs'),
      environment: z.record(z.string()).optional().describe('Environment variables'),
      databaseConfiguration: z.object({
        tableName: z.string().describe('DynamoDB table name'),
        attributeDefinitions: z.array(
          z.object({
            name: z.string().describe('Attribute name'),
            type: z.enum(['S', 'N', 'B']).describe('Attribute type (S=String, N=Number, B=Binary)')
          })
        ).describe('DynamoDB attribute definitions'),
        keySchema: z.array(
          z.object({
            name: z.string().describe('Attribute name'),
            type: z.enum(['HASH', 'RANGE']).describe('Key type (HASH=partition key, RANGE=sort key)')
          })
        ).describe('DynamoDB key schema'),
        billingMode: z.enum(['PROVISIONED', 'PAY_PER_REQUEST']).optional().default('PAY_PER_REQUEST').describe('DynamoDB billing mode'),
        readCapacity: z.number().optional().describe('Read capacity units (for PROVISIONED)'),
        writeCapacity: z.number().optional().describe('Write capacity units (for PROVISIONED)')
      }).optional().describe('Database configuration for creating DynamoDB tables')
    }).optional().describe('Backend configuration'),
    frontendConfiguration: z.object({
      builtAssetsPath: z.string().describe('Path to pre-built frontend assets. Can be absolute or relative to projectRoot'),
      framework: z.string().optional().describe('Frontend framework'),
      indexDocument: z.string().optional().default('index.html').describe('Index document'),
      errorDocument: z.string().optional().describe('Error document'),
      customDomain: z.string().optional().describe('Custom domain'),
      certificateArn: z.string().optional().describe('ACM certificate ARN')
    }).optional().describe('Frontend configuration')
  },
  handler: handleDeploy
};

export default deployTool;
