import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import os from 'os';
import { StatusCallback } from './types.js';
import { uploadFrontendAssets } from './frontend-upload.js';
import { logger } from '../utils/logger.js';
import { getTemplateForDeployment, DeploymentTypes } from '../template/registry.js';
import { processTemplate } from '../template/processor.js';

/**
 * Deploy an application to AWS serverless infrastructure
 */
export async function deployApplication(params: any, statusCallback?: StatusCallback): Promise<any> {
  const { deploymentType, framework, configuration, source } = params;
  
  try {
    // Log deployment start
    logger.info(`Starting deployment of ${configuration.projectName}...`);
    
    // Validate deployment type
    if (!Object.values(DeploymentTypes).includes(deploymentType)) {
      throw new Error(`Invalid deployment type: ${deploymentType}. Valid types are: ${Object.values(DeploymentTypes).join(', ')}`);
    }
    
    // Get template for this deployment type and framework
    const template = await getTemplateForDeployment(deploymentType, framework.toLowerCase());
    logger.debug(`Using template: ${JSON.stringify(template)}`);
    
    // Create temporary directory for deployment
    const tmpDir = path.join(os.tmpdir(), `deployment-${configuration.projectName}-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    
    try {
      // Process the template with configuration
      const outputPath = path.join(tmpDir, 'template.yaml');
      await processTemplate(template.path, configuration, outputPath);
      
      // Create src directory
      const srcDir = path.join(tmpDir, 'src');
      if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
      }
      
      // Copy source files
      await copySourceFiles(source.path, srcDir);
      
      // Deploy using AWS SAM
      const deployResult = await deploySAM(tmpDir, configuration);
      
      // Handle specific deployment type actions
      switch (deploymentType) {
        case DeploymentTypes.FRONTEND:
          // Upload frontend assets
          await uploadFrontendAssets(configuration, deployResult);
          break;
          
        case DeploymentTypes.FULLSTACK:
          // Upload frontend assets
          await uploadFrontendAssets(configuration, deployResult);
          
          // If database configuration is provided, set up database
          if (configuration.databaseConfiguration) {
            await setupDatabase(configuration.databaseConfiguration, deployResult);
          }
          break;
          
        case DeploymentTypes.DATABASE:
          // Additional database setup if needed
          await setupDatabase(configuration, deployResult);
          break;
      }
      
      logger.info(`Deployment completed successfully for ${configuration.projectName}`);
      return deployResult;
      
    } finally {
      // Clean up temporary directory
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (error) {
        logger.error(`Error cleaning up temporary directory: ${error}`);
      }
    }
  } catch (error) {
    logger.error(`Deployment failed for ${configuration.projectName}:`, error);
    throw error;
  }
}

/**
 * Copy source files to deployment directory
 */
async function copySourceFiles(sourcePath: string, targetPath: string): Promise<void> {
  logger.debug(`Copying source files from ${sourcePath} to ${targetPath}`);
  
  return new Promise((resolve, reject) => {
    exec(`cp -r ${sourcePath}/* ${targetPath}/`, (error) => {
      if (error) {
        logger.error(`Failed to copy source files: ${error.message}`);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Deploy using AWS SAM
 */
async function deploySAM(deploymentPath: string, configuration: any): Promise<any> {
  logger.info(`Deploying SAM application from ${deploymentPath}`);
  
  // Build the application
  await new Promise<void>((resolve, reject) => {
    const build = spawn('sam', ['build'], { cwd: deploymentPath });
    
    build.stdout.on('data', (data) => {
      logger.info(`SAM build: ${data}`);
    });
    
    build.stderr.on('data', (data) => {
      logger.error(`SAM build error: ${data}`);
    });
    
    build.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`SAM build failed with code ${code}`));
      }
    });
  });
  
  // Deploy the application
  const deployOutput = await new Promise<string>((resolve, reject) => {
    const deploy = spawn('sam', [
      'deploy',
      '--stack-name', configuration.projectName,
      '--region', configuration.region,
      '--no-confirm-changeset',
      '--capabilities', 'CAPABILITY_IAM',
      '--no-fail-on-empty-changeset'
    ], { cwd: deploymentPath });
    
    let output = '';
    
    deploy.stdout.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      logger.info(`SAM deploy: ${dataStr}`);
    });
    
    deploy.stderr.on('data', (data) => {
      logger.error(`SAM deploy error: ${data.toString()}`);
    });
    
    deploy.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`SAM deploy failed with code ${code}`));
      }
    });
  });
  
  // Parse deployment outputs
  const outputs: Record<string, string> = {};
  const outputRegex = /Key\s+([^\s]+)\s+Description\s+[^\n]+\s+Value\s+([^\n]+)/g;
  let match;
  
  while ((match = outputRegex.exec(deployOutput)) !== null) {
    outputs[match[1]] = match[2].trim();
  }
  
  return { outputs };
}

/**
 * Set up database resources
 */
async function setupDatabase(databaseConfig: any, deployResult: any): Promise<any> {
  logger.info(`Setting up database with configuration: ${JSON.stringify(databaseConfig)}`);
  
  // Database setup logic here
  // This could include:
  // - Creating tables
  // - Setting up indexes
  // - Configuring access policies
  // - Initializing with seed data
  
  return deployResult;
}
