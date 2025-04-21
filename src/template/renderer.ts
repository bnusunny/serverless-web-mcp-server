/**
 * Template Renderer
 * 
 * Handles rendering of Handlebars templates for CloudFormation/SAM deployments.
 */

import fs from 'fs/promises';
import Handlebars from 'handlebars';
import { logger } from '../utils/logger.js';
import { DeployOptions } from '../deployment/types.js';
import { DeploymentTypes, getTemplateForDeployment } from './registry.js';

/**
 * Register Handlebars helpers
 */
function registerHelpers() {
  // Helper to check if two values are equal
  Handlebars.registerHelper('ifEquals', function(this: any, arg1: any, arg2: any, options: any) {
    return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
  });

  // Helper to check if a value exists
  Handlebars.registerHelper('ifExists', function(this: any, value: any, options: any) {
    return (value !== undefined && value !== null && value !== '') ? options.fn(this) : options.inverse(this);
  });

  // Helper to iterate over object properties
  Handlebars.registerHelper('eachInObject', function(this: any, object: any, options: any) {
    let result = '';
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        result += options.fn({ key, value: object[key] });
      }
    }
    return result;
  });

  // Helper for CloudFormation intrinsic functions
  Handlebars.registerHelper('cf', function(this: any, fnName: string, ...args: any[]) {
    const options = args.pop();
    switch (fnName) {
      case 'Ref':
        return `{ "Ref": "${args[0]}" }`;
      case 'GetAtt':
        return `{ "Fn::GetAtt": ["${args[0]}", "${args[1]}"] }`;
      case 'Sub':
        return `{ "Fn::Sub": "${args[0]}" }`;
      default:
        return `{ "Fn::${fnName}": ${JSON.stringify(args)} }`;
    }
  });
}

/**
 * Render a template with the given parameters
 * 
 * @param params - Deployment parameters
 * @returns Rendered template as a string
 */
export async function renderTemplate(params: DeployOptions): Promise<string> {
  // Register Handlebars helpers
  registerHelpers();
  
  // Determine the deployment type
  const deploymentType = params.deploymentType.toLowerCase() as DeploymentTypes;
  
  // Get the appropriate framework
  let framework: string | undefined;
  if (deploymentType === DeploymentTypes.BACKEND && params.backendConfiguration?.framework) {
    framework = params.backendConfiguration.framework;
  } else if (deploymentType === DeploymentTypes.FRONTEND && params.frontendConfiguration?.framework) {
    framework = params.frontendConfiguration.framework;
  } else if (deploymentType === DeploymentTypes.FULLSTACK) {
    // For fullstack, we might use a combined framework name
    const backendFramework = params.backendConfiguration?.framework;
    const frontendFramework = params.frontendConfiguration?.framework;
    if (backendFramework && frontendFramework) {
      framework = `${backendFramework}-${frontendFramework}`;
    }
  }
  
  // Get the template for this deployment
  const template = await getTemplateForDeployment(deploymentType, framework);
  logger.debug(`Using template: ${template.name} at ${template.path}`);
  
  try {
    // Read the template file
    const templateContent = await fs.readFile(template.path, 'utf8');
    
    // Create a description for the template
    const description = `${params.projectName} - ${deploymentType} deployment`;
    
    // Compile the template
    const compiledTemplate = Handlebars.compile(templateContent);
    
    // Render the template with parameters
    const renderedTemplate = compiledTemplate({
      ...params,
      description
    });
    
    logger.debug('Template rendered successfully');
    return renderedTemplate;
  } catch (error) {
    logger.error(`Error rendering template: ${error}`);
    throw new Error(`Failed to render template: ${error instanceof Error ? error.message : String(error)}`);
  }
}
