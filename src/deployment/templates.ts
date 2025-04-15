import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
// Import the CloudFormation schema from yaml-cfn
import { schema } from 'yaml-cfn';
import { logger } from '../utils/logger.js';
import { listTemplates as getTemplatesList, getTemplateInfo as getTemplateByName } from '../template/registry.js';

// Define the directory where templates are stored
const TEMPLATES_DIR = process.env.TEMPLATES_PATH || path.join(process.cwd(), 'templates');

// Define framework to template mapping
const frameworkTemplateMap: Record<string, string> = {
  'express': 'express-backend',
  'react': 'frontend-website',
  'vue': 'frontend-website',
  'angular': 'frontend-website',
  'static': 'static-website',
  'fullstack': 'express-fullstack'
};

/**
 * Get information about a specific template
 */
export async function getTemplateInfo(frameworkOrTemplateName: string): Promise<any> {
  // Map framework name to template name if needed
  const templateName = frameworkTemplateMap[frameworkOrTemplateName.toLowerCase()] || frameworkOrTemplateName;
  
  logger.debug(`Looking for template: ${templateName} (from framework/template: ${frameworkOrTemplateName})`);
  
  // Check multiple possible template paths
  const possiblePaths = [
    path.join(TEMPLATES_DIR, `${templateName}.yaml`),
    path.join(TEMPLATES_DIR, `${templateName}.yml`),
    // Also check for the original name if it was mapped
    path.join(TEMPLATES_DIR, `${frameworkOrTemplateName}.yaml`),
    path.join(TEMPLATES_DIR, `${frameworkOrTemplateName}.yml`)
  ];
  
  // Find the first path that exists
  let templatePath: string | null = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      templatePath = possiblePath;
      break;
    }
  }
  
  if (!templatePath) {
    logger.error(`Template not found for ${frameworkOrTemplateName}. Looked in: ${TEMPLATES_DIR}`);
    logger.debug(`Available templates: ${fs.existsSync(TEMPLATES_DIR) ? fs.readdirSync(TEMPLATES_DIR).join(', ') : 'Templates directory not found'}`);
    throw new Error(`Template not found: ${frameworkOrTemplateName}`);
  }
  
  try {
    // Read the template file
    const templateContent = await fs.promises.readFile(templatePath, 'utf8');
    
    // Parse the YAML content using the CloudFormation schema
    const template = yaml.load(templateContent, { schema }) as any;
    
    logger.debug(`Successfully loaded template: ${templateName} from ${templatePath}`);
    
    // Return template information
    return {
      name: templateName,
      type: template.Type || 'unknown',
      path: path.dirname(templatePath), // Return the directory containing the template
      templateFile: templatePath,       // Also include the full path to the template file
      metadata: template.Metadata || {}
    };
  } catch (error) {
    logger.error(`Error reading template ${templateName}:`, error);
    throw new Error(`Failed to read template: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List all available templates
 */
export async function listTemplates(): Promise<any[]> {
  try {
    // Check if templates directory exists
    if (!fs.existsSync(TEMPLATES_DIR)) {
      logger.error(`Templates directory not found: ${TEMPLATES_DIR}`);
      return [];
    }
    
    // Read all files in the templates directory
    const files = await fs.promises.readdir(TEMPLATES_DIR);
    
    // Filter for YAML files
    const templateFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
    
    logger.info(`Found ${templateFiles.length} template files in ${TEMPLATES_DIR}`);
    
    // Get information for each template
    const templates = await Promise.all(
      templateFiles.map(async file => {
        const templateName = path.basename(file, path.extname(file));
        try {
          return await getTemplateInfo(templateName);
        } catch (error) {
          logger.error(`Error processing template ${templateName}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any null values from errors
    return templates.filter(template => template !== null);
  } catch (error) {
    logger.error('Error listing templates:', error);
    return [];
  }
}
