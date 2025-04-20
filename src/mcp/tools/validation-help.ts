/**
 * Validation Help Tool
 * 
 * Provides validation for deployment configurations without actually deploying.
 */

import { logger } from '../../utils/logger.js';
import { validateDeploymentOptions, formatValidationResult } from '../../deployment/validation.js';

/**
 * Handle validation help tool invocation
 * @param {Object} params - Parameters for the validation
 * @returns {Promise<Object>} Validation result
 */
export async function handleValidationHelp(params) {
  logger.info(`Validating configuration for project: ${params.projectName}`);
  logger.info(`Deployment type: ${params.deploymentType}`);
  
  try {
    // Log validation parameters for debugging
    logger.debug('Validation parameters:', JSON.stringify(params, null, 2));
    
    // Validate the deployment options
    const validationResult = validateDeploymentOptions(params);
    const formattedResult = formatValidationResult(validationResult);
    
    logger.info(`Validation ${validationResult.valid ? 'successful' : 'failed'} for project: ${params.projectName}`);
    
    // Create a formatted text response
    let responseText = `Validation ${validationResult.valid ? 'successful' : 'failed'} for project: ${params.projectName}\n\n`;
    
    if (validationResult.errors && validationResult.errors.length > 0) {
      responseText += `Errors:\n`;
      validationResult.errors.forEach((error, index) => {
        responseText += `${index + 1}. ${error.message}\n`;
        if (error.suggestion) {
          responseText += `   Suggestion: ${error.suggestion}\n`;
        }
        responseText += `   Path: ${error.path}\n`;
      });
      responseText += `\n`;
    }
    
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      responseText += `Warnings:\n`;
      validationResult.warnings.forEach((warning, index) => {
        responseText += `${index + 1}. ${warning.message}\n`;
        if (warning.suggestion) {
          responseText += `   Suggestion: ${warning.suggestion}\n`;
        }
        responseText += `   Path: ${warning.path}\n`;
      });
      responseText += `\n`;
    }
    
    if (validationResult.valid) {
      responseText += `Your deployment configuration is valid and ready for deployment.`;
    } else {
      responseText += `Please fix the errors above before attempting to deploy.`;
    }
    
    return {
      success: validationResult.valid,
      message: validationResult.valid ? 'Validation successful' : 'Validation failed',
      formattedResult,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      valid: validationResult.valid,
      content: [
        {
          type: "text",
          text: responseText
        }
      ]
    };
  } catch (error) {
    logger.error(`Error in validation help tool: ${error.message}`);
    return {
      success: false,
      message: `Validation failed: ${error.message}`,
      error: error.message,
      stackTrace: error.stack,
      content: [
        {
          type: "text",
          text: `Validation failed: ${error.message}\n\nStack Trace:\n${error.stack || "No stack trace available"}`
        }
      ]
    };
  }
}
