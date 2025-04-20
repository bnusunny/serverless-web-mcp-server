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
          content: [
            {
              title: "Deployment Status",
              content: `Unknown deployment status: ${result.status}`
            }
          ],
          result
        };
    }
  } catch (error) {
    logger.error(`Error in deploy tool: ${error.message}`);
    return {
      success: false,
      message: `Deployment failed: ${error.message}`,
      content: [
        {
          title: "Error",
          content: error.message
        },
        {
          title: "Stack Trace",
          content: error.stack || "No stack trace available"
        }
      ],
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
    status: result.status,
    content: [
      {
        title: "Deployment Status",
        content: "Deployment completed successfully"
      }
    ]
  };
  
  switch (deploymentType) {
    case 'backend':
      response.apiUrl = result.url;
      response.endpoints = {
        api: result.url
      };
      response.outputs = result.outputs || {};
      
      // Add API URL to content
      if (result.url) {
        response.content.push({
          title: "API URL",
          content: result.url
        });
      }
      
      // Add outputs to content if available
      if (result.outputs && Object.keys(result.outputs).length > 0) {
        response.content.push({
          title: "Outputs",
          content: JSON.stringify(result.outputs, null, 2)
        });
      }
      
      return response;
      
    case 'frontend':
      response.websiteUrl = result.url;
      response.endpoints = {
        website: result.url
      };
      response.bucketName = result.bucketName;
      response.distributionUrl = result.distributionUrl;
      
      // Add website URL to content
      if (result.url) {
        response.content.push({
          title: "Website URL",
          content: result.url
        });
      }
      
      // Add bucket info to content
      if (result.bucketName) {
        response.content.push({
          title: "S3 Bucket",
          content: result.bucketName
        });
      }
      
      return response;
      
    case 'fullstack':
      response.endpoints = {
        api: result.backendUrl,
        website: result.frontendUrl
      };
      response.backend = {
        apiUrl: result.backendUrl,
        outputs: result.backendResult?.outputs || {}
      };
      response.frontend = {
        websiteUrl: result.frontendUrl,
        bucketName: result.frontendResult?.bucketName,
        distributionUrl: result.frontendResult?.distributionUrl
      };
      
      // Add backend URL to content
      if (result.backendUrl) {
        response.content.push({
          title: "API URL",
          content: result.backendUrl
        });
      }
      
      // Add frontend URL to content
      if (result.frontendUrl) {
        response.content.push({
          title: "Website URL",
          content: result.frontendUrl
        });
      }
      
      return response;
      
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
    error: result.error,
    content: [
      {
        title: "Partial Deployment",
        content: "Some components were deployed successfully, but others failed."
      },
      {
        title: "Error",
        content: result.error || "Unknown error"
      }
    ]
  };
  
  // Only applicable for fullstack deployments
  if (deploymentType === 'fullstack') {
    response.backend = {
      success: result.backendResult?.status === DeploymentStatus.DEPLOYED,
      apiUrl: result.backendResult?.url,
      outputs: result.backendResult?.outputs || {}
    };
    response.frontend = {
      success: result.frontendResult?.status === DeploymentStatus.DEPLOYED,
      websiteUrl: result.frontendResult?.url,
      bucketName: result.frontendResult?.bucketName,
      distributionUrl: result.frontendResult?.distributionUrl
    };
    
    // Add backend status to content
    response.content.push({
      title: "Backend Status",
      content: result.backendResult?.status === DeploymentStatus.DEPLOYED ? 
        "Deployed successfully" : "Deployment failed"
    });
    
    // Add frontend status to content
    response.content.push({
      title: "Frontend Status",
      content: result.frontendResult?.status === DeploymentStatus.DEPLOYED ? 
        "Deployed successfully" : "Deployment failed"
    });
    
    // Add URLs if available
    if (result.backendResult?.url) {
      response.content.push({
        title: "API URL",
        content: result.backendResult.url
      });
    }
    
    if (result.frontendResult?.url) {
      response.content.push({
        title: "Website URL",
        content: result.frontendResult.url
      });
    }
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
    error: result.error,
    content: [
      {
        title: "Deployment Failed",
        content: result.message
      },
      {
        title: "Error",
        content: result.error || "Unknown error"
      }
    ]
  };
  
  // Add validation results if available
  if (result.validationResult) {
    response.validationErrors = result.validationResult.errors;
    response.validationWarnings = result.validationResult.warnings;
    
    // Add validation errors to content
    if (result.validationResult.errors && result.validationResult.errors.length > 0) {
      const errorsContent = result.validationResult.errors.map(err => 
        `- ${err.message}${err.suggestion ? `\n  Suggestion: ${err.suggestion}` : ''}`
      ).join('\n');
      
      response.content.push({
        title: "Validation Errors",
        content: errorsContent
      });
    }
    
    // Add validation warnings to content
    if (result.validationResult.warnings && result.validationResult.warnings.length > 0) {
      const warningsContent = result.validationResult.warnings.map(warn => 
        `- ${warn.message}${warn.suggestion ? `\n  Suggestion: ${warn.suggestion}` : ''}`
      ).join('\n');
      
      response.content.push({
        title: "Validation Warnings",
        content: warningsContent
      });
    }
  }
  
  // Add phase information if available
  if (result.phase) {
    response.failedPhase = result.phase;
    response.content.push({
      title: "Failed Phase",
      content: result.phase
    });
  }
  
  return response;
}
