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
    
    return {
      success: validationResult.valid,
      message: validationResult.valid ? 'Validation successful' : 'Validation failed',
      formattedResult,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      valid: validationResult.valid
    };
  } catch (error) {
    logger.error(`Error in validation help tool: ${error.message}`);
    return {
      success: false,
      message: `Validation failed: ${error.message}`,
      error: error.message,
      stackTrace: error.stack
    };
  }
}
