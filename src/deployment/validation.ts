/**
 * Deployment Validation Service
 * 
 * Provides comprehensive validation for deployment configurations and prerequisites.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { 
  DeployOptions, 
  BackendDeployOptions, 
  FrontendDeployOptions,
  FullstackDeployOptions,
  DeploymentConfiguration
} from '../types/index.js';

/**
 * ValidationResult interface for structured validation results
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * ValidationError interface for structured validation errors
 */
export interface ValidationError {
  code: string;
  message: string;
  path: string;
  suggestion?: string;
}

/**
 * ValidationWarning interface for structured validation warnings
 */
export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  suggestion?: string;
}

// Supported Lambda runtimes
const SUPPORTED_RUNTIMES = [
  'nodejs18.x',
  'nodejs16.x',
  'python3.9',
  'python3.8',
  'java11',
  'java8.al2',
  'dotnet6',
  'ruby2.7'
];

/**
 * Validate deployment options
 * @param {DeployOptions} options - Deployment options
 * @returns {ValidationResult} Validation result
 */
export function validateDeployOptions(options: DeployOptions): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  // Validate common options
  validateCommonOptions(options, result);
  
  // Validate specific deployment type options
  switch (options.deploymentType) {
    case 'backend':
      validateBackendOptions(options, result);
      break;
    case 'frontend':
      validateFrontendOptions(options, result);
      break;
    case 'fullstack':
      validateFullstackOptions(options, result);
      break;
    default:
      result.errors.push({
        code: 'INVALID_DEPLOYMENT_TYPE',
        message: `Invalid deployment type: ${options.deploymentType}`,
        path: 'deploymentType',
        suggestion: 'Use one of: backend, frontend, fullstack'
      });
  }
  
  // Set valid flag based on errors
  result.valid = result.errors.length === 0;
  
  return result;
}

/**
 * Validate deployment configuration
 * @param {DeploymentConfiguration} config - Deployment configuration
 * @param {string} deploymentType - Deployment type
 * @returns {void}
 * @throws {Error} If validation fails
 */
export function validateConfiguration(config: DeploymentConfiguration, deploymentType: string): void {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  // Validate project name
  if (!config.projectName) {
    result.errors.push({
      code: 'MISSING_PROJECT_NAME',
      message: 'Project name is required',
      path: 'projectName',
      suggestion: 'Provide a unique project name for your deployment'
    });
  }
  
  // Validate specific deployment type configuration
  switch (deploymentType) {
    case 'backend':
      validateBackendConfiguration(config.backendConfiguration, result);
      break;
    case 'frontend':
      validateFrontendConfiguration(config.frontendConfiguration, result);
      break;
    case 'fullstack':
      validateBackendConfiguration(config.backendConfiguration, result);
      validateFrontendConfiguration(config.frontendConfiguration, result);
      break;
    default:
      result.errors.push({
        code: 'INVALID_DEPLOYMENT_TYPE',
        message: `Invalid deployment type: ${deploymentType}`,
        path: 'deploymentType',
        suggestion: 'Use one of: backend, frontend, fullstack'
      });
  }
  
  // If validation failed, throw an error with the formatted result
  if (result.errors.length > 0) {
    throw new Error(formatValidationResult(result));
  }
}

/**
 * Validate common deployment options
 * @param {DeployOptions} options - Deployment options
 * @param {ValidationResult} result - Validation result to update
 */
function validateCommonOptions(options: DeployOptions, result: ValidationResult): void {
  // Validate project name
  if (!options.projectName) {
    result.errors.push({
      code: 'MISSING_PROJECT_NAME',
      message: 'Project name is required',
      path: 'projectName',
      suggestion: 'Provide a unique project name for your deployment'
    });
  } else if (!/^[a-zA-Z0-9-]+$/.test(options.projectName)) {
    result.errors.push({
      code: 'INVALID_PROJECT_NAME',
      message: 'Project name contains invalid characters',
      path: 'projectName',
      suggestion: 'Use only letters, numbers, and hyphens in your project name'
    });
  }

  // Validate project root
  if (!options.projectRoot) {
    result.errors.push({
      code: 'MISSING_PROJECT_ROOT',
      message: 'Project root directory is required',
      path: 'projectRoot',
      suggestion: 'Provide the path to your project root directory'
    });
  } else {
    // Convert relative path to absolute for validation
    const absoluteProjectRoot = path.isAbsolute(options.projectRoot) 
      ? options.projectRoot 
      : path.resolve(process.cwd(), options.projectRoot);
      
    if (!fs.existsSync(absoluteProjectRoot)) {
      result.errors.push({
        code: 'INVALID_PROJECT_ROOT',
        message: `Project root directory does not exist: ${options.projectRoot}`,
        path: 'projectRoot',
        suggestion: 'Check that the project root directory exists'
      });
    }
  }
}

/**
 * Validate backend deployment options
 * @param {DeployOptions} options - Deployment options
 * @param {ValidationResult} result - Validation result to update
 */
function validateBackendOptions(options: DeployOptions, result: ValidationResult): void {
  // Validate backend configuration
  if (!options.backendConfiguration) {
    result.errors.push({
      code: 'MISSING_BACKEND_CONFIG',
      message: 'Backend configuration is required for backend deployment',
      path: 'backendConfiguration',
      suggestion: 'Provide backendConfiguration with required parameters'
    });
    return;
  }
  
  // Validate built artifacts path
  validateBuiltArtifactsPath(options.backendConfiguration, result);
  
  // Validate runtime
  validateRuntime(options.backendConfiguration, result);
  
  // Validate startup script if not generating one
  if (!options.backendConfiguration.generateStartupScript) {
    validateStartupScript(options.backendConfiguration, result);
  }
  
  // Validate database configuration if provided
  if (options.backendConfiguration.databaseConfiguration) {
    validateDatabaseConfiguration(options.backendConfiguration.databaseConfiguration, result);
  }
}

/**
 * Validate frontend deployment options
 * @param {DeployOptions} options - Deployment options
 * @param {ValidationResult} result - Validation result to update
 */
function validateFrontendOptions(options: DeployOptions, result: ValidationResult): void {
  // Validate frontend configuration
  const frontendConfig = options.frontendConfiguration;
  if (!frontendConfig) {
    result.errors.push({
      code: 'MISSING_FRONTEND_CONFIG',
      message: 'Frontend configuration is required for frontend deployment',
      path: 'frontendConfiguration',
      suggestion: 'Provide frontendConfiguration with required parameters'
    });
    return;
  }

  // Validate built assets path
  validateBuiltAssetsPath(frontendConfig, result);
  
  // Validate index document
  validateIndexDocument(frontendConfig, result);
  
  // Validate custom domain if provided
  if (frontendConfig.customDomain) {
    validateCustomDomain(frontendConfig, result);
  }
}

/**
 * Validate fullstack deployment options
 * @param {DeployOptions} options - Deployment options
 * @param {ValidationResult} result - Validation result to update
 */
function validateFullstackOptions(options: DeployOptions, result: ValidationResult): void {
  // Validate backend configuration
  if (!options.backendConfiguration) {
    result.errors.push({
      code: 'MISSING_BACKEND_CONFIG',
      message: 'Backend configuration is required for fullstack deployment',
      path: 'backendConfiguration',
      suggestion: 'Provide backendConfiguration with required parameters'
    });
  } else {
    validateBackendOptions(options, result);
  }
  
  // Validate frontend configuration
  if (!options.frontendConfiguration) {
    result.errors.push({
      code: 'MISSING_FRONTEND_CONFIG',
      message: 'Frontend configuration is required for fullstack deployment',
      path: 'frontendConfiguration',
      suggestion: 'Provide frontendConfiguration with required parameters'
    });
  } else {
    validateFrontendOptions(options, result);
  }
}

/**
 * Validate backend configuration
 * @param {BackendDeployOptions} config - Backend configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateBackendConfiguration(config: BackendDeployOptions | undefined, result: ValidationResult): void {
  if (!config) {
    result.errors.push({
      code: 'MISSING_BACKEND_CONFIG',
      message: 'Backend configuration is required',
      path: 'backendConfiguration',
      suggestion: 'Provide backendConfiguration with required parameters'
    });
    return;
  }
  
  // Validate built artifacts path
  validateBuiltArtifactsPath(config, result);
  
  // Validate runtime
  validateRuntime(config, result);
  
  // Validate startup script if not generating one
  if (!config.generateStartupScript) {
    validateStartupScript(config, result);
  }
  
  // Validate database configuration if provided
  if (config.databaseConfiguration) {
    validateDatabaseConfiguration(config.databaseConfiguration, result);
  }
}

/**
 * Validate frontend configuration
 * @param {FrontendDeployOptions} config - Frontend configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateFrontendConfiguration(config: FrontendDeployOptions | undefined, result: ValidationResult): void {
  if (!config) {
    result.errors.push({
      code: 'MISSING_FRONTEND_CONFIG',
      message: 'Frontend configuration is required',
      path: 'frontendConfiguration',
      suggestion: 'Provide frontendConfiguration with required parameters'
    });
    return;
  }
  
  // Validate built assets path
  validateBuiltAssetsPath(config, result);
  
  // Validate index document
  validateIndexDocument(config, result);
  
  // Validate custom domain if provided
  if (config.customDomain) {
    validateCustomDomain(config, result);
  }
}

/**
 * Validate runtime
 * @param {BackendDeployOptions} config - Backend configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateRuntime(config: BackendDeployOptions, result: ValidationResult): void {
  if (!config.runtime) {
    result.errors.push({
      code: 'MISSING_RUNTIME',
      message: 'Runtime is required',
      path: 'backendConfiguration.runtime',
      suggestion: 'Provide a valid Lambda runtime (e.g., nodejs18.x, python3.9)'
    });
    return;
  }
  
  if (!SUPPORTED_RUNTIMES.includes(config.runtime)) {
    result.warnings.push({
      code: 'UNSUPPORTED_RUNTIME',
      message: `Runtime '${config.runtime}' may not be supported by AWS Lambda`,
      path: 'backendConfiguration.runtime',
      suggestion: `Supported runtimes include: ${SUPPORTED_RUNTIMES.join(', ')}`
    });
  }
}

/**
 * Validate startup script
 * @param {BackendDeployOptions} config - Backend configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateStartupScript(config: BackendDeployOptions, result: ValidationResult): void {
  // If generateStartupScript is true and entryPoint is provided, we don't need to validate startupScript
  if (config.generateStartupScript && config.entryPoint) {
    // Validate entryPoint instead
    const entryPointPath = path.join(config.builtArtifactsPath, config.entryPoint);
    
    logger.debug(`Checking entry point file: ${entryPointPath}`);
    
    if (!fs.existsSync(entryPointPath)) {
      result.errors.push({
        code: 'ENTRY_POINT_NOT_FOUND',
        message: `Entry point file not found: ${entryPointPath}`,
        path: 'backendConfiguration.entryPoint',
        suggestion: 'Check that your entry point file exists in the built artifacts directory'
      });
    }
    return;
  }
  
  // If not generating a startup script, validate that the startup script exists
  if (!config.startupScript) {
    result.errors.push({
      code: 'MISSING_STARTUP_SCRIPT',
      message: 'Startup script is required',
      path: 'backendConfiguration.startupScript',
      suggestion: 'Provide a startup script or set generateStartupScript to true and provide an entryPoint'
    });
    return;
  }
  
  const startupScriptPath = path.join(config.builtArtifactsPath, config.startupScript);
  if (!fs.existsSync(startupScriptPath)) {
    result.errors.push({
      code: 'STARTUP_SCRIPT_NOT_FOUND',
      message: `Startup script not found: ${startupScriptPath}`,
      path: 'backendConfiguration.startupScript',
      suggestion: 'Check that your startup script exists in the built artifacts directory or set generateStartupScript to true'
    });
  }
}

/**
 * Validate built artifacts path
 * @param {BackendDeployOptions} config - Backend configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateBuiltArtifactsPath(config: BackendDeployOptions, result: ValidationResult): void {
  if (!config.builtArtifactsPath) {
    result.errors.push({
      code: 'MISSING_ARTIFACTS_PATH',
      message: 'Built artifacts path is required',
      path: 'backendConfiguration.builtArtifactsPath',
      suggestion: 'Provide the path to your built backend artifacts'
    });
    return;
  }
  
  // Convert relative path to absolute for validation
  const absoluteArtifactsPath = path.isAbsolute(config.builtArtifactsPath) 
    ? config.builtArtifactsPath 
    : path.resolve(process.cwd(), config.builtArtifactsPath);
  
  logger.debug(`Checking built artifacts path: ${absoluteArtifactsPath}`);
  
  if (!fs.existsSync(absoluteArtifactsPath)) {
    result.errors.push({
      code: 'INVALID_ARTIFACTS_PATH',
      message: `Built artifacts path does not exist: ${config.builtArtifactsPath}`,
      path: 'backendConfiguration.builtArtifactsPath',
      suggestion: 'Build your application first or check the path to your built artifacts'
    });
    return;
  }
  
  // Check if the artifacts directory is empty
  const files = fs.readdirSync(absoluteArtifactsPath);
  if (files.length === 0) {
    result.errors.push({
      code: 'EMPTY_ARTIFACTS_PATH',
      message: `Built artifacts directory is empty: ${config.builtArtifactsPath}`,
      path: 'backendConfiguration.builtArtifactsPath',
      suggestion: 'Build your application first or check that files are being output to the correct directory'
    });
  }
}

/**
 * Validate built assets path
 * @param {FrontendDeployOptions} config - Frontend configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateBuiltAssetsPath(config: FrontendDeployOptions, result: ValidationResult): void {
  if (!config.builtAssetsPath) {
    result.errors.push({
      code: 'MISSING_ASSETS_PATH',
      message: 'Built assets path is required',
      path: 'frontendConfiguration.builtAssetsPath',
      suggestion: 'Provide the path to your built frontend assets'
    });
    return;
  }
  
  // Convert relative path to absolute for validation
  const absoluteAssetsPath = path.isAbsolute(config.builtAssetsPath) 
    ? config.builtAssetsPath 
    : path.resolve(process.cwd(), config.builtAssetsPath);
  
  logger.debug(`Checking built assets path: ${absoluteAssetsPath}`);
  
  if (!fs.existsSync(absoluteAssetsPath)) {
    result.errors.push({
      code: 'INVALID_ASSETS_PATH',
      message: `Built assets path does not exist: ${config.builtAssetsPath}`,
      path: 'frontendConfiguration.builtAssetsPath',
      suggestion: 'Build your frontend application first or check the path to your built assets'
    });
    return;
  }
  
  // Check if the assets directory is empty
  const files = fs.readdirSync(absoluteAssetsPath);
  if (files.length === 0) {
    result.errors.push({
      code: 'EMPTY_ASSETS_PATH',
      message: `Built assets directory is empty: ${config.builtAssetsPath}`,
      path: 'frontendConfiguration.builtAssetsPath',
      suggestion: 'Build your frontend application first or check that files are being output to the correct directory'
    });
  }
}

/**
 * Validate index document
 * @param {FrontendDeployOptions} config - Frontend configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateIndexDocument(config: FrontendDeployOptions, result: ValidationResult): void {
  const indexDocument = config.indexDocument || 'index.html';
  
  // Convert relative path to absolute for validation
  const absoluteAssetsPath = path.isAbsolute(config.builtAssetsPath) 
    ? config.builtAssetsPath 
    : path.resolve(process.cwd(), config.builtAssetsPath);
  
  const indexPath = path.join(absoluteAssetsPath, indexDocument);
  
  logger.debug(`Checking index document: ${indexPath}`);
  
  if (!fs.existsSync(indexPath)) {
    result.errors.push({
      code: 'INDEX_DOCUMENT_NOT_FOUND',
      message: `Index document not found: ${indexPath}`,
      path: 'frontendConfiguration.indexDocument',
      suggestion: 'Check that your index document is included in your built assets or specify the correct index document name'
    });
  }
}

/**
 * Validate custom domain
 * @param {FrontendDeployOptions} config - Frontend configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateCustomDomain(config: FrontendDeployOptions, result: ValidationResult): void {
  if (!config.customDomain) {
    return;
  }
  
  // Validate domain name format
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
  if (!domainRegex.test(config.customDomain)) {
    result.errors.push({
      code: 'INVALID_DOMAIN_NAME',
      message: `Invalid domain name format: ${config.customDomain}`,
      path: 'frontendConfiguration.customDomain',
      suggestion: 'Provide a valid domain name (e.g., example.com)'
    });
  }
  
  // If certificate ARN is provided, validate its format
  if (config.certificateArn) {
    const arnRegex = /^arn:aws:acm:[a-z0-9-]+:\d{12}:certificate\/[a-f0-9-]+$/;
    if (!arnRegex.test(config.certificateArn)) {
      result.errors.push({
        code: 'INVALID_CERTIFICATE_ARN',
        message: `Invalid certificate ARN format: ${config.certificateArn}`,
        path: 'frontendConfiguration.certificateArn',
        suggestion: 'Provide a valid ACM certificate ARN'
      });
    }
  } else {
    // If no certificate ARN is provided, add a warning
    result.warnings.push({
      code: 'MISSING_CERTIFICATE_ARN',
      message: 'No certificate ARN provided for custom domain',
      path: 'frontendConfiguration.certificateArn',
      suggestion: 'Provide a certificate ARN or a new certificate will be created'
    });
  }
}

/**
 * Validate database configuration
 * @param {any} config - Database configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateDatabaseConfiguration(config: any, result: ValidationResult): void {
  // Basic validation for now
  if (!config.tableName) {
    result.errors.push({
      code: 'MISSING_TABLE_NAME',
      message: 'Table name is required for database configuration',
      path: 'backendConfiguration.databaseConfiguration.tableName',
      suggestion: 'Provide a table name for your DynamoDB table'
    });
  }
  
  // Validate attribute definitions
  if (!config.attributeDefinitions || !Array.isArray(config.attributeDefinitions) || config.attributeDefinitions.length === 0) {
    result.errors.push({
      code: 'MISSING_ATTRIBUTE_DEFINITIONS',
      message: 'Attribute definitions are required for database configuration',
      path: 'backendConfiguration.databaseConfiguration.attributeDefinitions',
      suggestion: 'Provide attribute definitions for your DynamoDB table'
    });
  }
  
  // Validate key schema
  if (!config.keySchema || !Array.isArray(config.keySchema) || config.keySchema.length === 0) {
    result.errors.push({
      code: 'MISSING_KEY_SCHEMA',
      message: 'Key schema is required for database configuration',
      path: 'backendConfiguration.databaseConfiguration.keySchema',
      suggestion: 'Provide a key schema for your DynamoDB table'
    });
  }
}

/**
 * Format validation result as a user-friendly message
 * @param {ValidationResult} result - Validation result
 * @returns {string} Formatted message
 */
function formatValidationResult(result: ValidationResult): string {
  let message = '';
  
  if (result.valid) {
    message = 'Validation successful! Your deployment configuration is valid.\n';
  } else {
    message = 'Validation failed. Please fix the following errors:\n\n';
    
    result.errors.forEach((error, index) => {
      message += `ERROR ${index + 1}: ${error.message}\n`;
      message += `  Path: ${error.path}\n`;
      if (error.suggestion) {
        message += `  Suggestion: ${error.suggestion}\n`;
      }
      message += '\n';
    });
  }
  
  if (result.warnings.length > 0) {
    message += '\nWarnings:\n\n';
    
    result.warnings.forEach((warning, index) => {
      message += `WARNING ${index + 1}: ${warning.message}\n`;
      message += `  Path: ${warning.path}\n`;
      if (warning.suggestion) {
        message += `  Suggestion: ${warning.suggestion}\n`;
      }
      message += '\n';
    });
  }
  
  return message;
}

export { formatValidationResult };
