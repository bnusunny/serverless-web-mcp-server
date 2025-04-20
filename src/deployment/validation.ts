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
  FullstackDeployOptions
} from './types.js';

/**
 * ValidationResult interface for structured validation results
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * ValidationError interface for structured error information
 */
export interface ValidationError {
  code: string;
  message: string;
  path: string;
  suggestion?: string;
}

/**
 * ValidationWarning interface for structured warning information
 */
export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  suggestion?: string;
}

/**
 * Supported runtimes for Lambda functions
 */
const SUPPORTED_RUNTIMES = [
  'nodejs18.x', 'nodejs16.x', 'nodejs14.x',
  'python3.9', 'python3.8', 'python3.7',
  'java11', 'java8.al2', 'java8',
  'dotnet6', 'dotnet5.0', 'dotnet3.1',
  'go1.x',
  'ruby2.7'
];

/**
 * Validate deployment options before deployment
 * @param {DeployOptions} options - Deployment options
 * @returns {ValidationResult} Validation result with errors and warnings
 */
export function validateDeploymentOptions(options: DeployOptions): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  // Validate common options
  validateCommonOptions(options, result);

  // Validate based on deployment type
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
  } else if (!fs.existsSync(options.projectRoot)) {
    result.errors.push({
      code: 'INVALID_PROJECT_ROOT',
      message: `Project root directory does not exist: ${options.projectRoot}`,
      path: 'projectRoot',
      suggestion: 'Provide a valid path to your project root directory'
    });
  }

  // Validate region
  if (options.region && !/^[a-z]{2}-[a-z]+-\d+$/.test(options.region)) {
    result.errors.push({
      code: 'INVALID_REGION',
      message: `Invalid AWS region format: ${options.region}`,
      path: 'region',
      suggestion: 'Use a valid AWS region format (e.g., us-east-1)'
    });
  }
}

/**
 * Validate backend deployment options
 * @param {DeployOptions} options - Deployment options
 * @param {ValidationResult} result - Validation result to update
 */
function validateBackendOptions(options: DeployOptions, result: ValidationResult): void {
  const backendConfig = options.backendConfiguration;
  
  // Check if backend configuration exists
  if (!backendConfig) {
    result.errors.push({
      code: 'MISSING_BACKEND_CONFIG',
      message: 'Backend configuration is required for backend deployment',
      path: 'backendConfiguration',
      suggestion: 'Provide backendConfiguration with required parameters'
    });
    return;
  }

  // Validate built artifacts path
  validateBuiltArtifactsPath(backendConfig, result);
  
  // Validate runtime
  validateRuntime(backendConfig, result);
  
  // Validate startup script
  validateStartupScript(backendConfig, result);
  
  // Validate database configuration if provided
  if (backendConfig.databaseConfiguration) {
    validateDatabaseConfiguration(backendConfig.databaseConfiguration, result);
  }
}

/**
 * Validate frontend deployment options
 * @param {DeployOptions} options - Deployment options
 * @param {ValidationResult} result - Validation result to update
 */
function validateFrontendOptions(options: DeployOptions, result: ValidationResult): void {
  const frontendConfig = options.frontendConfiguration;
  
  // Check if frontend configuration exists
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
  
  if (!fs.existsSync(config.builtArtifactsPath)) {
    result.errors.push({
      code: 'INVALID_ARTIFACTS_PATH',
      message: `Built artifacts path does not exist: ${config.builtArtifactsPath}`,
      path: 'backendConfiguration.builtArtifactsPath',
      suggestion: 'Build your application first or check the path to your built artifacts'
    });
    return;
  }
  
  // Check if the artifacts directory is empty
  const files = fs.readdirSync(config.builtArtifactsPath);
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
    
    if (!fs.existsSync(entryPointPath)) {
      result.errors.push({
        code: 'ENTRY_POINT_NOT_FOUND',
        message: `Entry point file not found: ${entryPointPath}`,
        path: 'backendConfiguration.entryPoint',
        suggestion: 'Check that your entry point file is included in your built artifacts'
      });
    }
    
    return;
  }
  
  // Otherwise, validate startupScript as before
  if (!config.startupScript) {
    result.errors.push({
      code: 'MISSING_STARTUP_SCRIPT',
      message: 'Either startupScript or entryPoint with generateStartupScript=true is required',
      path: 'backendConfiguration.startupScript',
      suggestion: 'Provide a startup script name or set entryPoint and generateStartupScript=true'
    });
    return;
  }
  
  const startupScriptPath = path.join(config.builtArtifactsPath, config.startupScript);
  
  if (!fs.existsSync(startupScriptPath)) {
    result.errors.push({
      code: 'STARTUP_SCRIPT_NOT_FOUND',
      message: `Startup script not found: ${startupScriptPath}`,
      path: 'backendConfiguration.startupScript',
      suggestion: 'Check that your startup script is included in your built artifacts'
    });
    return;
  }
  
  try {
    fs.accessSync(startupScriptPath, fs.constants.X_OK);
  } catch (err) {
    result.errors.push({
      code: 'STARTUP_SCRIPT_NOT_EXECUTABLE',
      message: `Startup script is not executable: ${startupScriptPath}`,
      path: 'backendConfiguration.startupScript',
      suggestion: `Run 'chmod +x ${startupScriptPath}' to make the script executable`
    });
  }
}

/**
 * Validate database configuration
 * @param {any} dbConfig - Database configuration
 * @param {ValidationResult} result - Validation result to update
 */
function validateDatabaseConfiguration(dbConfig: any, result: ValidationResult): void {
  // Validate table name
  if (!dbConfig.tableName) {
    result.errors.push({
      code: 'MISSING_TABLE_NAME',
      message: 'Table name is required for database configuration',
      path: 'backendConfiguration.databaseConfiguration.tableName',
      suggestion: 'Provide a name for your DynamoDB table'
    });
  } else if (!/^[a-zA-Z0-9_.-]+$/.test(dbConfig.tableName)) {
    result.errors.push({
      code: 'INVALID_TABLE_NAME',
      message: 'Table name contains invalid characters',
      path: 'backendConfiguration.databaseConfiguration.tableName',
      suggestion: 'Use only letters, numbers, underscores, hyphens, and periods in your table name'
    });
  }
  
  // Validate attribute definitions
  if (!dbConfig.attributeDefinitions || !Array.isArray(dbConfig.attributeDefinitions) || dbConfig.attributeDefinitions.length === 0) {
    result.errors.push({
      code: 'MISSING_ATTRIBUTE_DEFINITIONS',
      message: 'Attribute definitions are required for database configuration',
      path: 'backendConfiguration.databaseConfiguration.attributeDefinitions',
      suggestion: 'Provide at least one attribute definition for your DynamoDB table'
    });
  } else {
    // Check each attribute definition
    dbConfig.attributeDefinitions.forEach((attr: any, index: number) => {
      if (!attr.name) {
        result.errors.push({
          code: 'MISSING_ATTRIBUTE_NAME',
          message: `Attribute name is missing in attribute definition at index ${index}`,
          path: `backendConfiguration.databaseConfiguration.attributeDefinitions[${index}].name`,
          suggestion: 'Provide a name for each attribute definition'
        });
      }
      
      if (!attr.type) {
        result.errors.push({
          code: 'MISSING_ATTRIBUTE_TYPE',
          message: `Attribute type is missing in attribute definition at index ${index}`,
          path: `backendConfiguration.databaseConfiguration.attributeDefinitions[${index}].type`,
          suggestion: 'Provide a type (S, N, or B) for each attribute definition'
        });
      } else if (!['S', 'N', 'B'].includes(attr.type)) {
        result.errors.push({
          code: 'INVALID_ATTRIBUTE_TYPE',
          message: `Invalid attribute type '${attr.type}' in attribute definition at index ${index}`,
          path: `backendConfiguration.databaseConfiguration.attributeDefinitions[${index}].type`,
          suggestion: 'Use S for String, N for Number, or B for Binary'
        });
      }
    });
  }
  
  // Validate key schema
  if (!dbConfig.keySchema || !Array.isArray(dbConfig.keySchema) || dbConfig.keySchema.length === 0) {
    result.errors.push({
      code: 'MISSING_KEY_SCHEMA',
      message: 'Key schema is required for database configuration',
      path: 'backendConfiguration.databaseConfiguration.keySchema',
      suggestion: 'Provide at least one key schema entry for your DynamoDB table'
    });
  } else {
    // Check each key schema entry
    dbConfig.keySchema.forEach((key: any, index: number) => {
      if (!key.name) {
        result.errors.push({
          code: 'MISSING_KEY_NAME',
          message: `Key name is missing in key schema at index ${index}`,
          path: `backendConfiguration.databaseConfiguration.keySchema[${index}].name`,
          suggestion: 'Provide a name for each key schema entry'
        });
      }
      
      if (!key.type) {
        result.errors.push({
          code: 'MISSING_KEY_TYPE',
          message: `Key type is missing in key schema at index ${index}`,
          path: `backendConfiguration.databaseConfiguration.keySchema[${index}].type`,
          suggestion: 'Provide a type (HASH or RANGE) for each key schema entry'
        });
      } else if (!['HASH', 'RANGE'].includes(key.type)) {
        result.errors.push({
          code: 'INVALID_KEY_TYPE',
          message: `Invalid key type '${key.type}' in key schema at index ${index}`,
          path: `backendConfiguration.databaseConfiguration.keySchema[${index}].type`,
          suggestion: 'Use HASH for partition key or RANGE for sort key'
        });
      }
    });
    
    // Check if there's exactly one HASH key
    const hashKeys = dbConfig.keySchema.filter((key: any) => key.type === 'HASH');
    if (hashKeys.length === 0) {
      result.errors.push({
        code: 'MISSING_HASH_KEY',
        message: 'Key schema must include exactly one HASH (partition) key',
        path: 'backendConfiguration.databaseConfiguration.keySchema',
        suggestion: 'Add a key with type HASH to your key schema'
      });
    } else if (hashKeys.length > 1) {
      result.errors.push({
        code: 'MULTIPLE_HASH_KEYS',
        message: 'Key schema must include exactly one HASH (partition) key',
        path: 'backendConfiguration.databaseConfiguration.keySchema',
        suggestion: 'Remove extra HASH keys from your key schema'
      });
    }
    
    // Check if there's at most one RANGE key
    const rangeKeys = dbConfig.keySchema.filter((key: any) => key.type === 'RANGE');
    if (rangeKeys.length > 1) {
      result.errors.push({
        code: 'MULTIPLE_RANGE_KEYS',
        message: 'Key schema must include at most one RANGE (sort) key',
        path: 'backendConfiguration.databaseConfiguration.keySchema',
        suggestion: 'Remove extra RANGE keys from your key schema'
      });
    }
  }
  
  // Validate billing mode
  if (dbConfig.billingMode && !['PROVISIONED', 'PAY_PER_REQUEST'].includes(dbConfig.billingMode)) {
    result.errors.push({
      code: 'INVALID_BILLING_MODE',
      message: `Invalid billing mode: ${dbConfig.billingMode}`,
      path: 'backendConfiguration.databaseConfiguration.billingMode',
      suggestion: 'Use PROVISIONED or PAY_PER_REQUEST for billing mode'
    });
  }
  
  // Validate provisioned capacity if billing mode is PROVISIONED
  if (dbConfig.billingMode === 'PROVISIONED') {
    if (typeof dbConfig.readCapacity !== 'number' || dbConfig.readCapacity < 1) {
      result.errors.push({
        code: 'INVALID_READ_CAPACITY',
        message: 'Read capacity must be a number greater than or equal to 1 when using PROVISIONED billing mode',
        path: 'backendConfiguration.databaseConfiguration.readCapacity',
        suggestion: 'Provide a valid read capacity value (minimum 1)'
      });
    }
    
    if (typeof dbConfig.writeCapacity !== 'number' || dbConfig.writeCapacity < 1) {
      result.errors.push({
        code: 'INVALID_WRITE_CAPACITY',
        message: 'Write capacity must be a number greater than or equal to 1 when using PROVISIONED billing mode',
        path: 'backendConfiguration.databaseConfiguration.writeCapacity',
        suggestion: 'Provide a valid write capacity value (minimum 1)'
      });
    }
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
  
  if (!fs.existsSync(config.builtAssetsPath)) {
    result.errors.push({
      code: 'INVALID_ASSETS_PATH',
      message: `Built assets path does not exist: ${config.builtAssetsPath}`,
      path: 'frontendConfiguration.builtAssetsPath',
      suggestion: 'Build your frontend application first or check the path to your built assets'
    });
    return;
  }
  
  // Check if the assets directory is empty
  const files = fs.readdirSync(config.builtAssetsPath);
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
  const indexPath = path.join(config.builtAssetsPath, indexDocument);
  
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
  if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(config.customDomain)) {
    result.errors.push({
      code: 'INVALID_CUSTOM_DOMAIN',
      message: `Invalid custom domain format: ${config.customDomain}`,
      path: 'frontendConfiguration.customDomain',
      suggestion: 'Provide a valid domain name (e.g., example.com)'
    });
  }
  
  if (config.customDomain && !config.certificateArn) {
    result.warnings.push({
      code: 'MISSING_CERTIFICATE_ARN',
      message: 'Custom domain specified without certificate ARN',
      path: 'frontendConfiguration.certificateArn',
      suggestion: 'Provide a certificate ARN for your custom domain or a certificate will be created automatically'
    });
  }
}

/**
 * Format validation result as a user-friendly message
 * @param {ValidationResult} result - Validation result
 * @returns {string} Formatted message
 */
export function formatValidationResult(result: ValidationResult): string {
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
