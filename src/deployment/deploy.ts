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
    
    // For now, just return a mock deployment result
    // In a real implementation, this would use AWS SAM CLI to deploy the application
    return {
      status: 'deployed',
      deploymentType,
      framework,
      projectName: configuration.projectName,
      template: templateInfo,
      resources: [
        {
          type: 'AWS::Lambda::Function',
          name: `${configuration.projectName}-function`,
          arn: `arn:aws:lambda:${configuration.region}:123456789012:function:${configuration.projectName}-function`
        },
        {
          type: 'AWS::ApiGateway::RestApi',
          name: `${configuration.projectName}-api`,
          url: `https://abcdef1234.execute-api.${configuration.region}.amazonaws.com/prod`
        }
      ]
    };
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
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
