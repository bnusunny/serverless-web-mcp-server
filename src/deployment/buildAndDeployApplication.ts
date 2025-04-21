/**
 * Build and deploy the application using SAM CLI
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import { DeploymentConfiguration } from '../types/index.js';

/**
 * Build and deploy the application using SAM CLI
 * @param {string} projectRoot - Project root directory
 * @param {DeploymentConfiguration} configuration - Deployment configuration
 * @param {string} deploymentType - Deployment type
 * @returns {Promise<void>}
 */
export async function buildAndDeployApplication(
  projectRoot: string,
  configuration: DeploymentConfiguration,
  deploymentType: string
): Promise<void> {
  logger.info('Building and deploying application...');
  
  const stackName = `${configuration.projectName}-${Date.now().toString().slice(-6)}`;
  
  try {
    // Build the SAM application
    logger.info('Building SAM application...');
    await new Promise<void>((resolve, reject) => {
      const samBuild = spawn('sam', ['build', '--template-file', path.join(projectRoot, 'template.yaml')], {
        cwd: projectRoot,
        stdio: 'inherit'
      });
      
      samBuild.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`SAM build failed with code ${code}`));
        }
      });
      
      samBuild.on('error', (err) => {
        reject(err);
      });
    });
    
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
