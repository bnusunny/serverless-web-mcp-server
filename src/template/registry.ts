// Renamed from template-registry.ts
import fs from 'fs/promises';
import path from 'path';
import { Config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Deployment types supported by the MCP server
 */
export enum DeploymentTypes {
  BACKEND = 'backend',
  FRONTEND = 'frontend',
  FULLSTACK = 'fullstack',
  DATABASE = 'database'
}

/**
 * Template information
 */
export interface Template {
  name: string;
  path: string;
  type: DeploymentTypes;
  framework?: string;
}

/**
 * Get the appropriate template for a deployment
 */
export async function getTemplateForDeployment(deploymentType: DeploymentTypes, framework?: string): Promise<Template> {
  const templatesPath = process.env.TEMPLATES_PATH || path.join(process.cwd(), 'templates');
  
  // Define the search order based on the documentation
  const searchPaths = [
    // 1. Specific template for this deployment type and framework
    framework ? path.join(templatesPath, `${deploymentType}-${framework}.hbs`) : null,
    framework ? path.join(templatesPath, `${deploymentType}-${framework}.yaml`) : null,
    
    // 2. Default template for this deployment type
    path.join(templatesPath, `${deploymentType}-default.hbs`),
    path.join(templatesPath, `${deploymentType}-default.yaml`),
    
    // 3. Generic template for this deployment type
    path.join(templatesPath, `${deploymentType}.hbs`),
    path.join(templatesPath, `${deploymentType}.yaml`),
    
    // 4. Special case for backend - always use backend-api.yaml
    deploymentType === DeploymentTypes.BACKEND ? path.join(templatesPath, 'backend-api.yaml') : null
  ].filter(Boolean) as string[];
  
  // Try each path in order
  for (const templatePath of searchPaths) {
    try {
      await fs.access(templatePath);
      logger.debug(`Found template at ${templatePath}`);
      
      return {
        name: path.basename(templatePath, path.extname(templatePath)),
        path: templatePath,
        type: deploymentType,
        framework
      };
    } catch (error) {
      // Template doesn't exist, try the next one
      continue;
    }
  }
  
  // If we get here, no template was found
  logger.error(`No template found for deployment type: ${deploymentType}${framework ? ` and framework: ${framework}` : ''}`);
  logger.error(`Searched in: ${searchPaths.join(', ')}`);
  throw new Error(`No template found for deployment type: ${deploymentType}${framework ? ` and framework: ${framework}` : ''}`);
}

/**
 * Discover all available templates
 */
export async function discoverTemplates(): Promise<Template[]> {
  const templatesPath = process.env.TEMPLATES_PATH || path.join(process.cwd(), 'templates');
  
  try {
    const files = await fs.readdir(templatesPath);
    const templates: Template[] = [];
    
    for (const file of files) {
      const ext = path.extname(file);
      if (ext === '.hbs' || ext === '.yaml' || ext === '.yml') {
        const name = path.basename(file, ext);
        const parts = name.split('-');
        
        // Skip files that don't match our naming convention
        if (parts.length === 0) continue;
        
        // Try to determine the deployment type
        let type: DeploymentTypes;
        const typeStr = parts[0].toLowerCase();
        
        if (Object.values(DeploymentTypes).includes(typeStr as DeploymentTypes)) {
          type = typeStr as DeploymentTypes;
        } else {
          // Skip files that don't start with a valid deployment type
          continue;
        }
        
        // Determine the framework if present
        let framework: string | undefined;
        if (parts.length > 1 && parts[1] !== 'default') {
          framework = parts.slice(1).join('-');
        }
        
        templates.push({
          name,
          path: path.join(templatesPath, file),
          type,
          framework
        });
      }
    }
    
    logger.debug(`Discovered ${templates.length} templates`);
    return templates;
  } catch (error) {
    logger.error(`Error discovering templates: ${error}`);
    throw new Error(`Failed to discover templates: ${error}`);
  }
}

/**
 * List all available templates
 */
export async function listTemplates(): Promise<Template[]> {
  return discoverTemplates();
}

/**
 * Get information about a specific template
 */
export async function getTemplateInfo(templateName: string): Promise<Template> {
  const templates = await discoverTemplates();
  const template = templates.find(t => t.name === templateName);
  
  if (!template) {
    throw new Error(`Template not found: ${templateName}`);
  }
  
  return template;
}
