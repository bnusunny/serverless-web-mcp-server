import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
// Import the CloudFormation schema from yaml-cfn
import { schema } from 'yaml-cfn';

// Define the directory where templates are stored
const TEMPLATES_DIR = process.env.TEMPLATES_PATH || path.join(process.cwd(), 'templates');

/**
 * Get information about a specific template
 */
export async function getTemplateInfo(templateName: string): Promise<any> {
  // Check if template exists
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.yaml`);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateName}`);
  }
  
  try {
    // Read the template file
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Parse the YAML content using the CloudFormation schema
    const template = yaml.load(templateContent, { schema }) as any;
    
    // Return template information
    return {
      name: templateName,
      type: template.Type || 'unknown',
      path: templatePath,
      metadata: template.Metadata || {}
    };
  } catch (error) {
    console.error(`Error reading template ${templateName}:`, error);
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
      console.error(`Templates directory not found: ${TEMPLATES_DIR}`);
      return [];
    }
    
    // Read all files in the templates directory
    const files = fs.readdirSync(TEMPLATES_DIR);
    
    // Filter for YAML files
    const templateFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
    
    // Get information for each template
    const templates = await Promise.all(
      templateFiles.map(async file => {
        const templateName = path.basename(file, path.extname(file));
        try {
          return await getTemplateInfo(templateName);
        } catch (error) {
          console.error(`Error processing template ${templateName}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any null values from errors
    return templates.filter(template => template !== null);
  } catch (error) {
    console.error('Error listing templates:', error);
    return [];
  }
}
