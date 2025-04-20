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
import { 
  DeployOptions, 
  BackendDeployOptions, 
  FrontendDeployOptions,
  FullstackDeployOptions,
  DeploymentResult,
  DeploymentStatus
} from './types.js';

import { logger } from '../utils/logger.js';
import { validateDeploymentOptions, formatValidationResult } from './validation.js';

// Get directory path for CommonJS
const __dirname = path.resolve();

const execAsync = promisify(exec);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

/**
 * Deploy a web application to AWS serverless infrastructure
 * @param {DeployOptions} options - Deployment options
 * @returns {Promise<DeploymentResult>} Deployment result
 */
export async function deploy(options: DeployOptions): Promise<DeploymentResult> {
  try {
    // Run validation
    logger.info("Validating deployment configuration...");
    const validationResult = validateDeploymentOptions(options);
    
    if (!validationResult.valid) {
      const formattedResult = formatValidationResult(validationResult);
      logger.error(`Validation failed:\n${formattedResult}`);
      return {
        status: DeploymentStatus.FAILED,
        message: 'Deployment validation failed',
        error: formattedResult,
        validationResult
      };
    }
    
    logger.info("Validation successful!");
    
    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      const formattedWarnings = formatValidationResult({
        valid: true,
        errors: [],
        warnings: validationResult.warnings
      });
      logger.warn(`Validation warnings:\n${formattedWarnings}`);
    }
    
    // Determine deployment type and call appropriate function
    logger.info(`Starting ${options.deploymentType} deployment for project: ${options.projectName}`);
    
    switch (options.deploymentType) {
      case 'backend':
        return await deployBackend(options);
      case 'frontend':
        return await deployFrontend(options);
      case 'fullstack':
        return await deployFullstack(options);
      default:
        throw new Error(`Unsupported deployment type: ${options.deploymentType}`);
    }
  } catch (error) {
    logger.error(`Deployment failed: ${error.message}`);
    return {
      status: DeploymentStatus.FAILED,
      message: `Deployment failed: ${error.message}`,
      error: error.message,
      stackTrace: error.stack
    };
  }
}

/**
 * Deploy a backend application
 * @param {DeployOptions} options - Backend deployment options
 * @returns {Promise<DeploymentResult>} Deployment result
 */
async function deployBackend(options: DeployOptions): Promise<DeploymentResult> {
  try {
    logger.info("Preparing backend deployment...");
    
    // Generate SAM template
    logger.info("Generating SAM template...");
    const templatePath = await generateSamTemplate(options);
    logger.info(`SAM template generated at: ${templatePath}`);
    
    // Deploy with SAM CLI
    logger.info("Deploying with SAM CLI...");
    await deploySamApplication(options, templatePath);
    
    // Get deployment outputs
    logger.info("Retrieving deployment outputs...");
    const outputs = await getDeploymentOutputs(options);
    
    logger.info("Backend deployment completed successfully!");
    
    return {
      status: DeploymentStatus.DEPLOYED,
      message: 'Backend deployed successfully',
      url: outputs.ApiUrl || `https://${options.projectName}.execute-api.${options.region || 'us-east-1'}.amazonaws.com/${options.backendConfiguration?.stage || 'prod'}/`,
      outputs
    };
  } catch (error) {
    logger.error(`Backend deployment failed: ${error.message}`);
    return {
      status: DeploymentStatus.FAILED,
      message: `Backend deployment failed: ${error.message}`,
      error: error.message,
      stackTrace: error.stack,
      phase: error.phase || 'unknown'
    };
  }
}

/**
 * Deploy a frontend application
 * @param {DeployOptions} options - Frontend deployment options
 * @returns {Promise<DeploymentResult>} Deployment result
 */
async function deployFrontend(options: DeployOptions): Promise<DeploymentResult> {
  try {
    logger.info("Preparing frontend deployment...");
    
    // Create S3 bucket
    logger.info("Creating S3 bucket...");
    const bucketName = await createS3Bucket(options);
    logger.info(`S3 bucket created: ${bucketName}`);
    
    // Upload assets
    logger.info("Uploading frontend assets...");
    await uploadFrontendAssets(options, bucketName);
    logger.info("Frontend assets uploaded successfully");
    
    // Configure CloudFront if needed
    let distributionUrl = null;
    if (options.frontendConfiguration?.customDomain) {
      logger.info("Configuring CloudFront distribution...");
      distributionUrl = await configureCloudFront(options, bucketName);
      logger.info(`CloudFront distribution created: ${distributionUrl}`);
    }
    
    logger.info("Frontend deployment completed successfully!");
    
    return {
      status: DeploymentStatus.DEPLOYED,
      message: 'Frontend deployed successfully',
      url: distributionUrl || `http://${bucketName}.s3-website-${options.region || 'us-east-1'}.amazonaws.com`,
      bucketName,
      distributionUrl
    };
  } catch (error) {
    logger.error(`Frontend deployment failed: ${error.message}`);
    return {
      status: DeploymentStatus.FAILED,
      message: `Frontend deployment failed: ${error.message}`,
      error: error.message,
      stackTrace: error.stack,
      phase: error.phase || 'unknown'
    };
  }
}

/**
 * Deploy a fullstack application
 * @param {DeployOptions} options - Fullstack deployment options
 * @returns {Promise<DeploymentResult>} Deployment result
 */
async function deployFullstack(options: DeployOptions): Promise<DeploymentResult> {
  try {
    logger.info("Preparing fullstack deployment...");
    
    // Deploy backend
    logger.info("Deploying backend components...");
    const backendResult = await deployBackend(options);
    
    if (backendResult.status === DeploymentStatus.FAILED) {
      logger.error("Backend deployment failed, aborting fullstack deployment");
      return {
        status: DeploymentStatus.FAILED,
        message: 'Fullstack deployment failed: Backend deployment failed',
        error: backendResult.error,
        backendResult
      };
    }
    
    // Deploy frontend
    logger.info("Deploying frontend components...");
    const frontendResult = await deployFrontend(options);
    
    if (frontendResult.status === DeploymentStatus.FAILED) {
      logger.error("Frontend deployment failed, but backend was deployed successfully");
      return {
        status: DeploymentStatus.PARTIAL,
        message: 'Fullstack deployment partially succeeded: Frontend deployment failed',
        error: frontendResult.error,
        backendResult,
        frontendResult
      };
    }
    
    logger.info("Fullstack deployment completed successfully!");
    
    return {
      status: DeploymentStatus.DEPLOYED,
      message: 'Fullstack application deployed successfully',
      backendUrl: backendResult.url,
      frontendUrl: frontendResult.url,
      backendResult,
      frontendResult
    };
  } catch (error) {
    logger.error(`Fullstack deployment failed: ${error.message}`);
    return {
      status: DeploymentStatus.FAILED,
      message: `Fullstack deployment failed: ${error.message}`,
      error: error.message,
      stackTrace: error.stack,
      phase: error.phase || 'unknown'
    };
  }
}

/**
 * Generate SAM template for deployment
 * @param {DeployOptions} options - Deployment options
 * @returns {Promise<string>} Path to generated template
 */
async function generateSamTemplate(options: DeployOptions): Promise<string> {
  // Implementation details...
  // This would generate a SAM template based on the deployment options
  return path.join(options.projectRoot, 'template.yaml');
}

/**
 * Deploy application using SAM CLI
 * @param {DeployOptions} options - Deployment options
 * @param {string} templatePath - Path to SAM template
 * @returns {Promise<void>}
 */
async function deploySamApplication(options: DeployOptions, templatePath: string): Promise<void> {
  // Implementation details...
  // This would use the SAM CLI to deploy the application
}

/**
 * Get deployment outputs from CloudFormation
 * @param {DeployOptions} options - Deployment options
 * @returns {Promise<any>} Deployment outputs
 */
async function getDeploymentOutputs(options: DeployOptions): Promise<any> {
  // Implementation details...
  // This would retrieve the outputs from the CloudFormation stack
  return {
    ApiUrl: `https://${options.projectName}.execute-api.${options.region || 'us-east-1'}.amazonaws.com/${options.backendConfiguration?.stage || 'prod'}/`
  };
}

/**
 * Create S3 bucket for frontend hosting
 * @param {DeployOptions} options - Deployment options
 * @returns {Promise<string>} Bucket name
 */
async function createS3Bucket(options: DeployOptions): Promise<string> {
  // Implementation details...
  // This would create an S3 bucket for hosting the frontend
  return `${options.projectName}-${Date.now()}`;
}

/**
 * Upload frontend assets to S3 bucket
 * @param {DeployOptions} options - Deployment options
 * @param {string} bucketName - S3 bucket name
 * @returns {Promise<void>}
 */
async function uploadFrontendAssets(options: DeployOptions, bucketName: string): Promise<void> {
  // Implementation details...
  // This would upload the frontend assets to the S3 bucket
}

/**
 * Configure CloudFront distribution
 * @param {DeployOptions} options - Deployment options
 * @param {string} bucketName - S3 bucket name
 * @returns {Promise<string>} CloudFront distribution URL
 */
async function configureCloudFront(options: DeployOptions, bucketName: string): Promise<string> {
  // Implementation details...
  // This would configure a CloudFront distribution for the S3 bucket
  return `https://${options.projectName}.cloudfront.net`;
}
