// Renamed from template-registry.ts
import fs from 'fs/promises';
import path from 'path';
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
 * Get the templates directory path
 * Priority:
 * 1. TEMPLATES_PATH environment variable
 * 2. config.templates.path from config.json
 * 3. Default paths based on installation method
 */
function getTemplatesPath(): string {
  // Check environment variable first
  if (process.env.TEMPLATES_PATH) {
    logger.debug(`Using templates path from environment: ${process.env.TEMPLATES_PATH}`);
    return process.env.TEMPLATES_PATH;
  }
  
  // Try to find templates in standard locations
  // The order is important - we want to prioritize the templates that come with the package
  const possiblePaths = [
    // 1. When running from source (development mode)
    path.resolve(__dirname, '..', '..', 'templates'),
    
    // 2. When installed as a local dependency (most common for projects)
    path.resolve(process.cwd(), 'node_modules', 'serverless-web-mcp-server', 'templates'),
    
    // 3. When installed globally
    path.join(process.execPath, '..', '..', 'lib', 'node_modules', 'serverless-web-mcp-server', 'templates'),
    
    // 4. Try another common global installation path
    '/usr/lib/node_modules/serverless-web-mcp-server/templates',
    
    // 5. Check if there's a templates directory in the current working directory (least preferred)
    path.resolve(process.cwd(), 'templates')
  ];
  
  logger.debug(`Searching for templates in possible paths: ${possiblePaths.join(', ')}`);
  
  for (const possiblePath of possiblePaths) {
    try {
      // Use synchronous check here since this is initialization code
      if (require('fs').existsSync(possiblePath)) {
        // Check if the directory actually contains template files
        const files = require('fs').readdirSync(possiblePath);
        const hasTemplates = files.some((file: string) => 
          file.endsWith('.hbs') || file.endsWith('.yaml') || file.endsWith('.yml')
        );
        
        if (hasTemplates) {
          logger.debug(`Found templates at: ${possiblePath}`);
          return possiblePath;
        } else {
          logger.debug(`Directory exists but contains no templates: ${possiblePath}`);
        }
      }
    } catch (error) {
      // Ignore errors and try next path
      logger.debug(`Error checking path ${possiblePath}: ${error}`);
    }
  }
  
  // Default to templates in current directory as last resort
  const defaultPath = path.resolve(process.cwd(), 'templates');
  logger.warn(`Could not find templates directory, using current directory: ${defaultPath}`);
  return defaultPath;
}

/**
 * Get the appropriate template for a deployment
 */
export async function getTemplateForDeployment(deploymentType: DeploymentTypes, framework?: string): Promise<Template> {
  const templatesPath = getTemplatesPath();
  logger.debug(`Looking for template with deployment type: ${deploymentType}, framework: ${framework || 'none'}`);
  
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
    path.join(templatesPath, `${deploymentType}.yaml`)
  ].filter(Boolean) as string[];
  
  logger.debug(`Search paths: ${searchPaths.join(', ')}`);
  
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
      logger.debug(`Template not found at ${templatePath}`);
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
  const templatesPath = getTemplatesPath();
  logger.debug(`Discovering templates in ${templatesPath}`);
  
  try {
    const files = await fs.readdir(templatesPath);
    const templates: Template[] = [];
    
    logger.debug(`Found ${files.length} files in templates directory`);
    
    for (const file of files) {
      const ext = path.extname(file);
      if (ext === '.hbs' || ext === '.yaml' || ext === '.yml') {
        const name = path.basename(file, ext);
        const parts = name.split('-');
        
        // Skip files that don't match our naming convention
        if (parts.length === 0) {
          logger.debug(`Skipping file ${file} - doesn't match naming convention`);
          continue;
        }
        
        // Try to determine the deployment type
        let type: DeploymentTypes;
        const typeStr = parts[0].toLowerCase();
        
        if (Object.values(DeploymentTypes).includes(typeStr as DeploymentTypes)) {
          type = typeStr as DeploymentTypes;
        } else {
          // Skip files that don't start with a valid deployment type
          logger.debug(`Skipping file ${file} - invalid deployment type: ${typeStr}`);
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
        
        logger.debug(`Added template: ${name}, type: ${type}, framework: ${framework || 'none'}`);
      }
    }
    
    logger.debug(`Discovered ${templates.length} templates in ${templatesPath}`);
    return templates;
  } catch (error) {
    logger.error(`Error discovering templates in ${templatesPath}: ${error}`);
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
