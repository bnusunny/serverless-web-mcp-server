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
      
      case 'error': // Handle legacy 'error' status
        logger.error(`Deployment failed for project: ${params.projectName}`);
        // Convert to proper DeploymentStatus.FAILED
        result.status = DeploymentStatus.FAILED;
        return formatErrorResponse(result, params.deploymentType);
        
      default:
        logger.warn(`Unknown deployment status: ${result.status}`);
        return {
          success: false,
          message: `Unknown deployment status: ${result.status}`,
          content: [
            {
              type: "text",
              text: `Unknown deployment status: ${result.status}`
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
          type: "text",
          text: `Deployment failed: ${error.message}\n\nStack Trace:\n${error.stack || "No stack trace available"}`
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
  let responseText = `Deployment completed successfully!\n\n`;
  
  switch (deploymentType) {
    case 'backend':
      responseText += `Deployment Type: Backend\n`;
      if (result.url) {
        responseText += `API URL: ${result.url}\n\n`;
      }
      
      if (result.outputs && Object.keys(result.outputs).length > 0) {
        responseText += `Outputs:\n${JSON.stringify(result.outputs, null, 2)}\n`;
      }
      
      return {
        success: true,
        message: result.message,
        deploymentType,
        status: result.status,
        apiUrl: result.url,
        endpoints: {
          api: result.url
        },
        outputs: result.outputs || {},
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };
      
    case 'frontend':
      responseText += `Deployment Type: Frontend\n`;
      if (result.url) {
        responseText += `Website URL: ${result.url}\n`;
      }
      if (result.bucketName) {
        responseText += `S3 Bucket: ${result.bucketName}\n`;
      }
      if (result.distributionUrl) {
        responseText += `CloudFront Distribution: ${result.distributionUrl}\n`;
      }
      
      return {
        success: true,
        message: result.message,
        deploymentType,
        status: result.status,
        websiteUrl: result.url,
        endpoints: {
          website: result.url
        },
        bucketName: result.bucketName,
        distributionUrl: result.distributionUrl,
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };
      
    case 'fullstack':
      responseText += `Deployment Type: Fullstack\n`;
      if (result.backendUrl) {
        responseText += `API URL: ${result.backendUrl}\n`;
      }
      if (result.frontendUrl) {
        responseText += `Website URL: ${result.frontendUrl}\n`;
      }
      
      if (result.backendResult?.outputs && Object.keys(result.backendResult.outputs).length > 0) {
        responseText += `\nBackend Outputs:\n${JSON.stringify(result.backendResult.outputs, null, 2)}\n`;
      }
      
      return {
        success: true,
        message: result.message,
        deploymentType,
        status: result.status,
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
        },
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };
      
    default:
      return {
        success: true,
        message: result.message,
        deploymentType,
        status: result.status,
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };
  }
}

/**
 * Format a partial deployment response
 * @param {Object} result - Deployment result
 * @param {string} deploymentType - Type of deployment
 * @returns {Object} Formatted response
 */
function formatPartialResponse(result, deploymentType) {
  let responseText = `Partial Deployment: Some components were deployed successfully, but others failed.\n\n`;
  responseText += `Error: ${result.error || "Unknown error"}\n\n`;
  
  // Only applicable for fullstack deployments
  if (deploymentType === 'fullstack') {
    const backendSuccess = result.backendResult?.status === DeploymentStatus.DEPLOYED;
    const frontendSuccess = result.frontendResult?.status === DeploymentStatus.DEPLOYED;
    
    responseText += `Backend Status: ${backendSuccess ? "Deployed successfully" : "Deployment failed"}\n`;
    responseText += `Frontend Status: ${frontendSuccess ? "Deployed successfully" : "Deployment failed"}\n\n`;
    
    if (result.backendResult?.url) {
      responseText += `API URL: ${result.backendResult.url}\n`;
    }
    
    if (result.frontendResult?.url) {
      responseText += `Website URL: ${result.frontendResult.url}\n`;
    }
    
    return {
      success: false,
      partialSuccess: true,
      message: result.message,
      deploymentType,
      status: result.status,
      error: result.error,
      backend: {
        success: backendSuccess,
        apiUrl: result.backendResult?.url,
        outputs: result.backendResult?.outputs || {}
      },
      frontend: {
        success: frontendSuccess,
        websiteUrl: result.frontendResult?.url,
        bucketName: result.frontendResult?.bucketName,
        distributionUrl: result.frontendResult?.distributionUrl
      },
      content: [
        {
          type: "text",
          text: responseText
        }
      ]
    };
  }
  
  return {
    success: false,
    partialSuccess: true,
    message: result.message,
    deploymentType,
    status: result.status,
    error: result.error,
    content: [
      {
        type: "text",
        text: responseText
      }
    ]
  };
}

/**
 * Format an error deployment response
 * @param {Object} result - Deployment result
 * @param {string} deploymentType - Type of deployment
 * @returns {Object} Formatted response
 */
function formatErrorResponse(result, deploymentType) {
  let responseText = `Deployment Failed: ${result.message}\n\n`;
  responseText += `Error: ${result.error || "Unknown error"}\n\n`;
  
  // Add validation results if available
  if (result.validationResult) {
    if (result.validationResult.errors && result.validationResult.errors.length > 0) {
      responseText += `Validation Errors:\n`;
      result.validationResult.errors.forEach(err => {
        responseText += `- ${err.message}\n`;
        if (err.suggestion) {
          responseText += `  Suggestion: ${err.suggestion}\n`;
        }
      });
      responseText += `\n`;
    }
    
    if (result.validationResult.warnings && result.validationResult.warnings.length > 0) {
      responseText += `Validation Warnings:\n`;
      result.validationResult.warnings.forEach(warn => {
        responseText += `- ${warn.message}\n`;
        if (warn.suggestion) {
          responseText += `  Suggestion: ${warn.suggestion}\n`;
        }
      });
      responseText += `\n`;
    }
  }
  
  // Add phase information if available
  if (result.phase) {
    responseText += `Failed Phase: ${result.phase}\n`;
  }
  
  return {
    success: false,
    message: result.message,
    deploymentType,
    status: result.status,
    error: result.error,
    validationErrors: result.validationResult?.errors,
    validationWarnings: result.validationResult?.warnings,
    failedPhase: result.phase,
    content: [
      {
        type: "text",
        text: responseText
      }
    ]
  };
}
