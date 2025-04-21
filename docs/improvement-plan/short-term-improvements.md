# Short-Term Improvements Implementation Guide

This document provides detailed implementation guidance for the short-term improvements to the serverless-web-mcp tool. These improvements focus on enhancing error messages, improving documentation, and standardizing output formats.

## 1. Enhanced Error Messages and Diagnostics

### Detailed Implementation Plan

#### 1.1 Create a Validation Layer

The validation layer will check all aspects of deployment configuration before attempting deployment. This helps identify issues early and provides actionable feedback.

**Files to Create/Modify:**
- `src/deployment/validation.ts` (new file)
- `src/deployment/types.ts` (update)
- `src/deployment/deploy-service.ts` (update)

**Implementation Details:**

1. **Define Validation Interfaces:**

```typescript
// In src/deployment/types.ts
export interface ValidationError {
  code: string;        // Error code (e.g., MISSING_STARTUP_SCRIPT)
  message: string;     // Human-readable error message
  path: string;        // Path to the problematic field
  suggestion?: string; // Suggested fix
}

export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;             // Overall validation result
  errors: ValidationError[];  // List of errors
  warnings: ValidationWarning[]; // List of warnings
}
```

2. **Implement Validation Functions:**

```typescript
// In src/deployment/validation.ts
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

// Implement specific validation functions for each aspect
function validateCommonOptions(options: DeployOptions, result: ValidationResult): void {
  // Validate project name, project root, region, etc.
}

function validateBackendOptions(options: DeployOptions, result: ValidationResult): void {
  // Validate runtime, startup script, built artifacts path, etc.
}

// ... other validation functions
```

3. **Format Validation Results:**

```typescript
// In src/deployment/validation.ts
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
```

4. **Integrate with Deployment Process:**

```typescript
// In src/deployment/deploy-service.ts
import { validateDeploymentOptions, formatValidationResult } from './validation.js';

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
    
    // Continue with deployment
    // ...
  } catch (error) {
    // Handle errors
  }
}
```

#### 1.2 Enhance Error Handling

Improve error handling throughout the deployment process to provide more context and actionable information.

**Files to Modify:**
- `src/deployment/deploy-service.ts`
- `src/mcp/tools/deploy.ts`

**Implementation Details:**

1. **Add Phase Tracking:**

```typescript
// In src/deployment/deploy-service.ts
async function deployBackend(options: DeployOptions): Promise<DeploymentResult> {
  try {
    logger.info("Preparing backend deployment...");
    
    try {
      // Generate SAM template
      logger.info("Generating SAM template...");
      const templatePath = await generateSamTemplate(options);
      logger.info(`SAM template generated at: ${templatePath}`);
    } catch (error) {
      error.phase = 'TEMPLATE_GENERATION';
      throw error;
    }
    
    try {
      // Deploy with SAM CLI
      logger.info("Deploying with SAM CLI...");
      await deploySamApplication(options, templatePath);
    } catch (error) {
      error.phase = 'SAM_DEPLOYMENT';
      throw error;
    }
    
    // ... rest of the function
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
```

2. **Extract AWS Error Details:**

```typescript
// In src/deployment/deploy-service.ts
function extractAwsErrorDetails(error: any): { code: string, message: string } {
  const errorMessage = error.message || '';
  
  // Extract AWS error code
  const codeMatch = errorMessage.match(/\(([A-Z][a-zA-Z0-9]+)\)/);
  const code = codeMatch ? codeMatch[1] : 'UnknownError';
  
  // Extract clean message
  const cleanMessage = errorMessage.replace(/\([A-Z][a-zA-Z0-9]+\)/, '').trim();
  
  return {
    code,
    message: cleanMessage || errorMessage
  };
}

// Use in error handling
try {
  // Deployment code
} catch (error) {
  if (error.message && error.message.includes('AWS')) {
    const awsError = extractAwsErrorDetails(error);
    return {
      status: DeploymentStatus.FAILED,
      message: `Deployment failed: ${awsError.message}`,
      error: error.message,
      awsErrorCode: awsError.code,
      phase: error.phase || 'unknown'
    };
  }
  
  // Handle other errors
}
```

#### 1.3 Add Troubleshooting Guidance

Create a troubleshooting module that provides guidance for common errors.

**Files to Create/Modify:**
- `src/deployment/troubleshooting.ts` (new file)
- `src/mcp/tools/deployment-help.ts` (update)

**Implementation Details:**

1. **Create Troubleshooting Module:**

```typescript
// In src/deployment/troubleshooting.ts
export interface TroubleshootingSuggestion {
  description: string;
  command?: string;
  link?: string;
}

export function getTroubleshootingSuggestions(errorCode: string): TroubleshootingSuggestion[] {
  const suggestions: Record<string, TroubleshootingSuggestion[]> = {
    'MISSING_STARTUP_SCRIPT': [
      {
        description: 'Check that your startup script exists in the built artifacts directory',
        command: 'ls -la ${builtArtifactsPath}'
      },
      {
        description: 'Make sure your startup script is executable',
        command: 'chmod +x ${builtArtifactsPath}/${startupScript}'
      }
    ],
    'STARTUP_SCRIPT_NOT_EXECUTABLE': [
      {
        description: 'Make your startup script executable',
        command: 'chmod +x ${builtArtifactsPath}/${startupScript}'
      }
    ],
    // Add more error codes and suggestions
  };
  
  return suggestions[errorCode] || [
    {
      description: 'Check the AWS CloudFormation console for more details',
      link: 'https://console.aws.amazon.com/cloudformation'
    }
  ];
}
```

2. **Integrate with Deployment Help Tool:**

```typescript
// In src/mcp/tools/deployment-help.ts
import { getTroubleshootingSuggestions } from '../../deployment/troubleshooting.js';

export async function handleDeploymentHelp(params: { topic: string, errorCode?: string }) {
  if (params.errorCode) {
    const suggestions = getTroubleshootingSuggestions(params.errorCode);
    return {
      errorCode: params.errorCode,
      suggestions
    };
  }
  
  // Existing help content handling
}
```

## 2. Documentation Improvements

### Detailed Implementation Plan

#### 2.1 Schema Documentation

Create comprehensive schema documentation for all parameters.

**Files to Create/Modify:**
- `src/mcp/resources/schema-documentation.ts` (new file)
- `src/mcp/resources/index.ts` (update)

**Implementation Details:**

1. **Create Schema Documentation Resource:**

```typescript
// In src/mcp/resources/schema-documentation.ts
import { McpResource } from './index.js';
import { toolDefinitions } from '../tools/index.js';
import { z } from 'zod';

function generateSchemaDocumentation() {
  const documentation: Record<string, any> = {};
  
  // Generate documentation for each tool
  toolDefinitions.forEach(tool => {
    const schema = tool.parameters;
    documentation[tool.name] = {
      description: tool.description,
      parameters: extractSchemaDetails(schema)
    };
  });
  
  return documentation;
}

function extractSchemaDetails(schema: z.ZodType<any>): any {
  // Extract schema details from Zod schema
  // This is a simplified version - would need to handle different Zod types
  const def = schema._def;
  
  if (def.typeName === 'ZodObject') {
    const shape = def.shape();
    const result: Record<string, any> = {};
    
    Object.entries(shape).forEach(([key, value]) => {
      result[key] = {
        type: getZodTypeName(value),
        description: value.description,
        required: !value.isOptional(),
        default: value._def.defaultValue?.(),
        // Add more details based on the type
      };
    });
    
    return result;
  }
  
  return {
    type: getZodTypeName(schema),
    description: schema.description
  };
}

function getZodTypeName(schema: z.ZodType<any>): string {
  const typeName = schema._def.typeName;
  
  // Map Zod type names to more user-friendly names
  const typeMap: Record<string, string> = {
    'ZodString': 'string',
    'ZodNumber': 'number',
    'ZodBoolean': 'boolean',
    'ZodArray': 'array',
    'ZodObject': 'object',
    'ZodEnum': 'enum',
    // Add more mappings as needed
  };
  
  return typeMap[typeName] || typeName;
}

const schemaDocumentation: McpResource = {
  name: 'Schema Documentation',
  uri: 'schema:documentation',
  description: 'Comprehensive schema documentation for deployment parameters',
  handler: async () => {
    return generateSchemaDocumentation();
  }
};

export default schemaDocumentation;
```

2. **Register Schema Documentation Resource:**

```typescript
// In src/mcp/resources/index.ts
import schemaDocumentation from './schema-documentation.js';

// Add to exports
export { schemaDocumentation };

// Add to resources array
const resources: McpResource[] = [
  // Existing resources
  schemaDocumentation
];
```

#### 2.2 Examples Library

Expand the examples library to cover more frameworks and use cases.

**Files to Create/Modify:**
- `src/mcp/resources/deployment-examples.ts` (update)

**Implementation Details:**

1. **Expand Deployment Examples:**

```typescript
// In src/mcp/resources/deployment-examples.ts
function handleDeploymentExamples() {
  return {
    // Existing examples
    
    // Add more framework examples
    frameworks: {
      express: {
        description: 'Express.js API example',
        buildCommand: 'npm run build',
        deploymentConfig: {
          deploymentType: 'backend',
          projectName: 'express-api',
          projectRoot: '/path/to/project',
          backendConfiguration: {
            builtArtifactsPath: '/path/to/project/dist',
            runtime: 'nodejs18.x',
            startupScript: 'app.js',
            environment: {
              NODE_ENV: 'production'
            }
          }
        },
        projectStructure: {
          // Example project structure
        },
        commonIssues: [
          // Common issues and solutions
        ]
      },
      flask: {
        description: 'Flask API example',
        buildCommand: 'pip install -r requirements.txt -t ./package',
        deploymentConfig: {
          deploymentType: 'backend',
          projectName: 'flask-api',
          projectRoot: '/path/to/project',
          backendConfiguration: {
            builtArtifactsPath: '/path/to/project/package',
            runtime: 'python3.9',
            startupScript: 'app.py',
            environment: {
              FLASK_ENV: 'production'
            }
          }
        },
        projectStructure: {
          // Example project structure
        },
        commonIssues: [
          // Common issues and solutions
        ]
      },
      // Add more frameworks
    },
    
    // Add more database examples
    databases: {
      dynamodb: {
        // Existing examples
        
        // Add more examples
        gsi: {
          description: 'DynamoDB table with Global Secondary Index',
          config: {
            tableName: 'GSITable',
            attributeDefinitions: [
              { name: 'id', type: 'S' },
              { name: 'category', type: 'S' },
              { name: 'date', type: 'S' }
            ],
            keySchema: [
              { name: 'id', type: 'HASH' }
            ],
            globalSecondaryIndexes: [
              {
                indexName: 'CategoryDateIndex',
                keySchema: [
                  { name: 'category', type: 'HASH' },
                  { name: 'date', type: 'RANGE' }
                ],
                projection: {
                  projectionType: 'ALL'
                }
              }
            ],
            billingMode: 'PAY_PER_REQUEST'
          }
        }
      }
    }
  };
}
```

#### 2.3 Parameter Descriptions

Enhance parameter descriptions in the tool definitions.

**Files to Modify:**
- `src/mcp/tools/index.ts`

**Implementation Details:**

1. **Enhance Parameter Descriptions:**

```typescript
// In src/mcp/tools/index.ts
export const toolDefinitions = [
  {
    name: 'deploy',
    description: 'Deploy web applications to AWS serverless infrastructure. Can also create and configure database resources like DynamoDB tables.',
    handler: handleDeploy,
    parameters: z.object({
      deploymentType: z.enum(['backend', 'frontend', 'fullstack']).describe('Type of deployment (backend for API/services, frontend for static websites, fullstack for both)'),
      projectName: z.string().describe('Project name - must be unique within your AWS account and contain only letters, numbers, and hyphens'),
      projectRoot: z.string().describe('Absolute path to the project root directory where SAM template will be generated (e.g., /home/user/projects/my-app)'),
      region: z.string().optional().default('us-east-1').describe('AWS region where resources will be deployed (e.g., us-east-1, eu-west-1)'),
      backendConfiguration: z.object({
        builtArtifactsPath: z.string().describe('Absolute path to pre-built backend artifacts directory containing all dependencies and executable code (e.g., /home/user/projects/my-app/dist)'),
        framework: z.string().optional().describe('Backend framework name for informational purposes (e.g., express, flask)'),
        runtime: z.string().describe('AWS Lambda runtime identifier (e.g., nodejs18.x, python3.9, java11) - must match your application language'),
        startupScript: z.string().describe('Name of the startup script file within the artifacts directory that will be executed when Lambda is invoked - must be executable (chmod +x) in Linux environment'),
        // ... other parameters with enhanced descriptions
      }).optional().describe('Backend configuration required for backend and fullstack deployments'),
      // ... other parameters with enhanced descriptions
    })
  },
  // ... other tools with enhanced descriptions
];
```

## 3. Standardized Output Formats

### Detailed Implementation Plan

#### 3.1 Define Standard Response Formats

Create interfaces for different response types.

**Files to Modify:**
- `src/deployment/types.ts`

**Implementation Details:**

1. **Define Standard Response Interfaces:**

```typescript
// In src/deployment/types.ts
export enum DeploymentStatus {
  DEPLOYED = 'DEPLOYED',
  FAILED = 'FAILED',
  IN_PROGRESS = 'IN_PROGRESS',
  PARTIAL = 'PARTIAL'
}

export interface DeploymentResult {
  status: DeploymentStatus;
  message: string;
  error?: string;
  stackTrace?: string;
  phase?: string;
  validationResult?: ValidationResult;
  [key: string]: any;
}

export interface BackendDeploymentResult extends DeploymentResult {
  url?: string;
  outputs?: Record<string, any>;
}

export interface FrontendDeploymentResult extends DeploymentResult {
  url?: string;
  bucketName?: string;
  distributionUrl?: string;
}

export interface FullstackDeploymentResult extends DeploymentResult {
  backendUrl?: string;
  frontendUrl?: string;
  backendResult?: BackendDeploymentResult;
  frontendResult?: FrontendDeploymentResult;
}
```

#### 3.2 Enhance Result Formatting

Create formatter functions for different result types.

**Files to Modify:**
- `src/mcp/tools/deploy.ts`

**Implementation Details:**

1. **Implement Result Formatters:**

```typescript
// In src/mcp/tools/deploy.ts
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
```

2. **Use Formatters in Tool Handler:**

```typescript
// In src/mcp/tools/deploy.ts
export async function handleDeploy(params) {
  logger.info(`Starting deployment for project: ${params.projectName}`);
  logger.info(`Deployment type: ${params.deploymentType}`);
  
  try {
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
```

#### 3.3 Add Validation Tool

Create a new tool for validating deployment configurations without deploying.

**Files to Create/Modify:**
- `src/mcp/tools/validation-help.ts` (new file)
- `src/mcp/tools/index.ts` (update)

**Implementation Details:**

1. **Create Validation Tool:**

```typescript
// In src/mcp/tools/validation-help.ts
import { logger } from '../../utils/logger.js';
import { validateDeploymentOptions, formatValidationResult } from '../../deployment/validation.js';

export async function handleValidationHelp(params) {
  logger.info(`Validating configuration for project: ${params.projectName}`);
  logger.info(`Deployment type: ${params.deploymentType}`);
  
  try {
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
```

2. **Register Validation Tool:**

```typescript
// In src/mcp/tools/index.ts
import { handleValidationHelp } from './validation-help.js';

// Export tool handlers
export {
  // Existing exports
  handleValidationHelp
};

// Define tool definitions
export const toolDefinitions = [
  // Existing tools
  {
    name: 'validate_deployment',
    description: 'Validate deployment configuration without actually deploying',
    handler: handleValidationHelp,
    parameters: z.object({
      // Same parameters as deploy tool
    })
  }
];
```

## Integration Strategy

To ensure these improvements integrate well with the existing codebase:

1. **Preserve Working Functionality:**
   - Keep the existing deployment logic intact
   - Add validation as a pre-deployment step
   - Ensure error handling doesn't interfere with successful paths

2. **Incremental Implementation:**
   - Implement one improvement at a time
   - Test thoroughly after each implementation
   - Commit changes with clear messages

3. **Testing Strategy:**
   - Test validation with various valid and invalid configurations
   - Test error handling with simulated errors
   - Test output formatting with different deployment scenarios

## Conclusion

This detailed implementation guide provides a roadmap for implementing the short-term improvements to the serverless-web-mcp tool. By following this guide, we can enhance error messages, improve documentation, and standardize output formats while preserving the existing functionality.
