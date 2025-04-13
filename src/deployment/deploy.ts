import fs from 'fs';
import path from 'path';
import { getTemplateInfo } from './templates.js';

/**
 * Deploy an application to AWS serverless infrastructure
 */
export async function deployApplication(params: any): Promise<any> {
  const { deploymentType, framework, configuration } = params;
  
  try {
    // Validate parameters
    validateDeploymentParams(params);
    
    // Get appropriate template based on deployment type and framework
    const templateName = getTemplateNameForDeployment(deploymentType, framework);
    
    console.log(`Using template: ${templateName}`);
    
    // Get template information
    const templateInfo = await getTemplateInfo(templateName);
    
    // Generate appropriate resources based on deployment type
    const resources = generateResourcesForDeployment(deploymentType, configuration);
    
    // In a real implementation, this would use AWS SAM CLI to deploy the application
    // For now, we're returning a mock deployment result with appropriate resources
    return {
      status: 'deployed',
      deploymentType,
      framework,
      projectName: configuration.projectName,
      template: templateInfo,
      resources
    };
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

/**
 * Generate appropriate AWS resources based on deployment type
 */
function generateResourcesForDeployment(deploymentType: string, configuration: any): any[] {
  const projectName = configuration.projectName;
  const region = configuration.region || 'us-east-1';
  
  switch (deploymentType) {
    case 'backend':
      return [
        {
          type: 'AWS::Lambda::Function',
          name: `${projectName}-function`,
          arn: `arn:aws:lambda:${region}:123456789012:function:${projectName}-function`
        },
        {
          type: 'AWS::ApiGateway::RestApi',
          name: `${projectName}-api`,
          url: `https://abcdef1234.execute-api.${region}.amazonaws.com/prod`
        }
      ];
      
    case 'frontend':
      return [
        {
          type: 'AWS::S3::Bucket',
          name: `${projectName}-bucket`,
          url: `${projectName}-bucket.s3.amazonaws.com`
        },
        {
          type: 'AWS::CloudFront::Distribution',
          name: `${projectName}-distribution`,
          url: `d1234abcdef.cloudfront.net`
        }
      ];
      
    case 'fullstack':
      return [
        {
          type: 'AWS::Lambda::Function',
          name: `${projectName}-backend-function`,
          arn: `arn:aws:lambda:${region}:123456789012:function:${projectName}-backend-function`
        },
        {
          type: 'AWS::ApiGateway::RestApi',
          name: `${projectName}-api`,
          url: `https://abcdef1234.execute-api.${region}.amazonaws.com/prod`
        },
        {
          type: 'AWS::S3::Bucket',
          name: `${projectName}-frontend-bucket`,
          url: `${projectName}-frontend-bucket.s3.amazonaws.com`
        },
        {
          type: 'AWS::CloudFront::Distribution',
          name: `${projectName}-frontend-distribution`,
          url: `d1234abcdef.cloudfront.net`
        }
      ];
      
    default:
      throw new Error(`Unsupported deployment type: ${deploymentType}`);
  }
}

/**
 * Validate deployment parameters
 */
function validateDeploymentParams(params: any): void {
  const { deploymentType, source, framework, configuration } = params;
  
  // Check required parameters
  if (!deploymentType) {
    throw new Error('deploymentType is required');
  }
  
  if (!source) {
    throw new Error('source is required');
  }
  
  if (!framework) {
    throw new Error('framework is required');
  }
  
  if (!configuration || !configuration.projectName) {
    throw new Error('configuration.projectName is required');
  }
  
  // Check source
  if (source.path && !fs.existsSync(source.path)) {
    throw new Error(`Source path does not exist: ${source.path}`);
  }
  
  // Validate deployment type
  const validDeploymentTypes = ['backend', 'frontend', 'fullstack'];
  if (!validDeploymentTypes.includes(deploymentType)) {
    throw new Error(`Invalid deploymentType: ${deploymentType}. Must be one of: ${validDeploymentTypes.join(', ')}`);
  }
  
  // Validate framework based on deployment type
  validateFramework(deploymentType, framework);
  
  // Validate configuration based on deployment type
  validateConfiguration(deploymentType, configuration);
}

/**
 * Validate configuration based on deployment type
 */
function validateConfiguration(deploymentType: string, configuration: any): void {
  // Common validation
  if (!configuration.region) {
    configuration.region = 'us-east-1'; // Default region
  }
  
  // Deployment-specific validation
  switch (deploymentType) {
    case 'backend':
      if (!configuration.backendConfiguration) {
        configuration.backendConfiguration = {}; // Use defaults if not provided
      }
      break;
      
    case 'frontend':
      if (!configuration.frontendConfiguration) {
        configuration.frontendConfiguration = {}; // Use defaults if not provided
      }
      
      // Set default values for frontend configuration
      if (!configuration.frontendConfiguration.indexDocument) {
        configuration.frontendConfiguration.indexDocument = 'index.html';
      }
      
      if (!configuration.frontendConfiguration.errorDocument) {
        configuration.frontendConfiguration.errorDocument = 'index.html';
      }
      break;
      
    case 'fullstack':
      // Ensure both backend and frontend configurations exist
      if (!configuration.backendConfiguration) {
        configuration.backendConfiguration = {}; // Use defaults if not provided
      }
      
      if (!configuration.frontendConfiguration) {
        configuration.frontendConfiguration = {
          indexDocument: 'index.html',
          errorDocument: 'index.html'
        };
      }
      break;
  }
}

/**
 * Validate framework based on deployment type
 */
function validateFramework(deploymentType: string, framework: string): void {
  const validFrameworks: Record<string, string[]> = {
    backend: ['express', 'koa', 'fastify', 'nest'],
    frontend: ['react', 'vue', 'angular', 'static'],
    fullstack: ['express-react', 'express-vue', 'nest-react', 'nest-vue']
  };
  
  if (!validFrameworks[deploymentType].includes(framework)) {
    throw new Error(`Invalid framework '${framework}' for deploymentType '${deploymentType}'. Valid frameworks: ${validFrameworks[deploymentType].join(', ')}`);
  }
}

/**
 * Get template name based on deployment type and framework
 */
function getTemplateNameForDeployment(deploymentType: string, framework: string): string {
  // Map deployment type and framework to template name
  const templateMap: Record<string, Record<string, string>> = {
    backend: {
      express: 'express-backend',
      koa: 'express-backend', // Use express template for koa for now
      fastify: 'express-backend', // Use express template for fastify for now
      nest: 'express-backend' // Use express template for nest for now
    },
    frontend: {
      react: 'frontend-website',
      vue: 'frontend-website', // Use same template for vue for now
      angular: 'frontend-website', // Use same template for angular for now
      static: 'static-website'
    },
    fullstack: {
      'express-react': 'express-fullstack',
      'express-vue': 'express-fullstack', // Use same template for vue for now
      'nest-react': 'express-fullstack', // Use same template for nest for now
      'nest-vue': 'express-fullstack' // Use same template for nest-vue for now
    }
  };
  
  const templateName = templateMap[deploymentType]?.[framework];
  
  if (!templateName) {
    throw new Error(`No template found for deploymentType '${deploymentType}' and framework '${framework}'`);
  }
  
  return templateName;
}
