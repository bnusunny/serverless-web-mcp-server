/**
 * Deploy Tool
 * 
 * Handles deployment of web applications to AWS serverless infrastructure.
 */

import { logger } from '../../utils/logger.js';
import { deploy } from '../../deployment/deploy-service.js';
import { DeploymentStatus } from '../../deployment/types.js';

/**
 * Handle deploy tool invocation
 * @param {Object} params - Parameters for the deployment
 * @returns {Promise<Object>} Deployment result
 */
export async function handleDeploy(params) {
  logger.info(`Starting deployment for project: ${params.projectName}`);
  logger.info(`Deployment type: ${params.deploymentType}`);
  
  try {
    // Log deployment parameters for debugging
    logger.debug('Deployment parameters:', JSON.stringify(params, null, 2));
    
    // Start deployment
    const result = await deploy(params);
    
    // Format the response based on deployment status
    switch (result.status) {
      case DeploymentStatus.DEPLOYED:
        logger.info(`Deployment successful for project: ${params.projectName}`);
        return formatSuccessResponse(result, params.deploymentType);
        
      case DeploymentStatus.PARTIAL:
        logger.warn(`Partial deployment for project: ${params.projectName}`);
        return formatPartialResponse(result, params.deploymentType);
        
      case DeploymentStatus.FAILED:
        logger.error(`Deployment failed for project: ${params.projectName}`);
        return formatErrorResponse(result, params.deploymentType);
        
      default:
        logger.warn(`Unknown deployment status: ${result.status}`);
        return {
          success: false,
          message: `Unknown deployment status: ${result.status}`,
          result
        };
    }
  } catch (error) {
    logger.error(`Error in deploy tool: ${error.message}`);
    return {
      success: false,
      message: `Deployment failed: ${error.message}`,
      error: error.message,
      stackTrace: error.stack
    };
  }
}

/**
 * Format a successful deployment response
 * @param {Object} result - Deployment result
 * @param {string} deploymentType - Type of deployment
 * @returns {Object} Formatted response
 */
function formatSuccessResponse(result, deploymentType) {
  const response = {
    success: true,
    message: result.message,
    deploymentType,
    status: result.status
  };
  
  switch (deploymentType) {
    case 'backend':
      return {
        ...response,
        apiUrl: result.url,
        endpoints: {
          api: result.url
        },
        outputs: result.outputs || {}
      };
      
    case 'frontend':
      return {
        ...response,
        websiteUrl: result.url,
        endpoints: {
          website: result.url
        },
        bucketName: result.bucketName,
        distributionUrl: result.distributionUrl
      };
      
    case 'fullstack':
      return {
        ...response,
        endpoints: {
          api: result.backendUrl,
          website: result.frontendUrl
        },
        backend: {
          apiUrl: result.backendUrl,
          outputs: result.backendResult?.outputs || {}
        },
        frontend: {
          websiteUrl: result.frontendUrl,
          bucketName: result.frontendResult?.bucketName,
          distributionUrl: result.frontendResult?.distributionUrl
        }
      };
      
    default:
      return response;
  }
}

/**
 * Format a partial deployment response
 * @param {Object} result - Deployment result
 * @param {string} deploymentType - Type of deployment
 * @returns {Object} Formatted response
 */
function formatPartialResponse(result, deploymentType) {
  const response = {
    success: false,
    partialSuccess: true,
    message: result.message,
    deploymentType,
    status: result.status,
    error: result.error
  };
  
  // Only applicable for fullstack deployments
  if (deploymentType === 'fullstack') {
    return {
      ...response,
      backend: {
        success: result.backendResult?.status === DeploymentStatus.DEPLOYED,
        apiUrl: result.backendResult?.url,
        outputs: result.backendResult?.outputs || {}
      },
      frontend: {
        success: result.frontendResult?.status === DeploymentStatus.DEPLOYED,
        websiteUrl: result.frontendResult?.url,
        bucketName: result.frontendResult?.bucketName,
        distributionUrl: result.frontendResult?.distributionUrl
      }
    };
  }
  
  return response;
}

/**
 * Format an error deployment response
 * @param {Object} result - Deployment result
 * @param {string} deploymentType - Type of deployment
 * @returns {Object} Formatted response
 */
function formatErrorResponse(result, deploymentType) {
  const response = {
    success: false,
    message: result.message,
    deploymentType,
    status: result.status,
    error: result.error
  };
  
  // Add validation results if available
  if (result.validationResult) {
    response.validationErrors = result.validationResult.errors;
    response.validationWarnings = result.validationResult.warnings;
  }
  
  // Add phase information if available
  if (result.phase) {
    response.failedPhase = result.phase;
  }
  
  return response;
}
