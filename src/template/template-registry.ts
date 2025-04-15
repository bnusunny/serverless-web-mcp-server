import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

// Define the default templates directory
const DEFAULT_TEMPLATES_DIR = path.join(process.cwd(), 'templates');

// Define valid deployment types
export enum DeploymentType {
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
  FULLSTACK = 'FULLSTACK',
  DATABASE = 'DATABASE'
}

// Template information interface
export interface TemplateInfo {
  path: string;
  name: string;
  extension: string;
}

/**
 * Get template directory path, prioritizing custom path if provided
 */
export function getTemplatesDir(): string {
  // Check for custom template path in environment variable
  const customPath = process.env.TEMPLATES_PATH;
  if (customPath) {
    logger.debug(`Using custom templates directory: ${customPath}`);
    return customPath;
  }
  
  logger.debug(`Using default templates directory: ${DEFAULT_TEMPLATES_DIR}`);
  return DEFAULT_TEMPLATES_DIR;
}

/**
 * Get the template path for a deployment type and framework
 */
export async function getTemplateForDeployment(deploymentType: string, framework: string): Promise<TemplateInfo> {
  const templatesDir = getTemplatesDir();
  
  // Convert deployment type to lowercase for file naming
  const deploymentTypeLower = deploymentType.toLowerCase();
  const frameworkLower = framework.toLowerCase();
  
  // Try specific framework template first: {deploymentType}-{framework}.hbs
  const specificTemplate = `${deploymentTypeLower}-${frameworkLower}`;
  
  // Try default template for deployment type: {deploymentType}-default.hbs
  const defaultTemplate = `${deploymentTypeLower}-default`;
  
  // Try generic deployment type template: {deploymentType}.hbs
  const genericTemplate = deploymentTypeLower;
  
  // List of template names to try, in order of preference
  const templateNames = [specificTemplate, defaultTemplate, genericTemplate];
  
  // List of extensions to try, in order of preference
  const extensions = ['.hbs', '.yaml', '.yml'];
  
  logger.debug(`Looking for template for deployment type: ${deploymentType}, framework: ${framework}`);
  logger.debug(`Will try templates in this order: ${templateNames.join(', ')}`);
  
  // Try each template name with each extension
  for (const templateName of templateNames) {
    for (const extension of extensions) {
      const templatePath = path.join(templatesDir, templateName + extension);
      
      try {
        await fs.access(templatePath);
        logger.debug(`Found template: ${templatePath}`);
        return {
          path: templatePath,
          name: templateName,
          extension: extension
        };
      } catch (error) {
        // Template doesn't exist, try next one
        logger.debug(`Template not found: ${templatePath}`);
      }
    }
  }
  
  // If we get here, no template was found
  logger.error(`No template found for deployment type: ${deploymentType}, framework: ${framework}`);
  logger.debug(`Available templates: ${await listTemplateFiles()}`);
  throw new Error(`Template not found for deployment type: ${deploymentType}, framework: ${framework}`);
}

/**
 * List all template files in the templates directory
 */
async function listTemplateFiles(): Promise<string> {
  try {
    const templatesDir = getTemplatesDir();
    const files = await fs.readdir(templatesDir);
    return files.filter(file => 
      file.endsWith('.hbs') || file.endsWith('.yaml') || file.endsWith('.yml')
    ).join(', ');
  } catch (error) {
    return 'Could not read templates directory';
  }
}

// Template list item interface
export interface TemplateListItem {
  name: string;
  path: string;
  extension: string;
  deploymentType: string;
  framework: string;
}

/**
 * List all available templates
 */
export async function listTemplates(): Promise<TemplateListItem[]> {
  try {
    const templatesDir = getTemplatesDir();
    const files = await fs.readdir(templatesDir);
    
    // Filter for template files
    const templateFiles = files.filter(file => 
      file.endsWith('.hbs') || file.endsWith('.yaml') || file.endsWith('.yml')
    );
    
    logger.info(`Found ${templateFiles.length} template files in ${templatesDir}`);
    
    return templateFiles.map(file => {
      const extension = path.extname(file);
      const fullName = path.basename(file, extension);
      
      // Try to extract deployment type and framework from filename
      const parts = fullName.split('-');
      let deploymentType, framework;
      
      if (parts.length >= 2) {
        deploymentType = parts[0].toUpperCase();
        framework = parts.slice(1).join('-');
      } else {
        deploymentType = fullName.toUpperCase();
        framework = 'default';
      }
      
      return {
        name: fullName,
        path: path.join(templatesDir, file),
        extension: extension.substring(1),
        deploymentType,
        framework
      };
    });
  } catch (error) {
    logger.error('Error listing templates:', error);
    return [];
  }
}
