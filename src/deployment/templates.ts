import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from '../config.js';

/**
 * Find the templates directory using multiple resolution strategies
 */
function findTemplatesDirectory(configPath: string): string {
  const possiblePaths = [
    // 1. Use the configured path
    configPath,
    
    // 2. Use path relative to current file
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates'),
    
    // 3. Use path relative to current working directory
    path.resolve(process.cwd(), 'templates'),
    
    // 4. Check if installed as a package
    path.resolve(process.cwd(), 'node_modules/serverless-web-mcp-server/templates'),
    
    // 5. Check common global installation paths
    path.resolve(process.env.HOME || '', 'node_modules/serverless-web-mcp-server/templates'),
    path.resolve('/usr/local/lib/node_modules/serverless-web-mcp-server/templates'),
    path.resolve('/usr/lib/node_modules/serverless-web-mcp-server/templates')
  ];
  
  // Use environment variable if provided
  if (process.env.TEMPLATES_PATH) {
    possiblePaths.unshift(process.env.TEMPLATES_PATH);
  }
  
  // Try each path until we find one that exists
  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      console.error(`Found templates directory at: ${templatePath}`);
      return templatePath;
    }
  }
  
  // If we get here, we couldn't find the templates directory
  throw new Error(`Templates directory not found. Tried: ${possiblePaths.join(', ')}`);
}

/**
 * Get information about available deployment templates
 */
export async function getTemplateInfo(templateName?: string): Promise<any> {
  const config = loadConfig();
  const configuredPath = path.resolve(config.templates.path);
  
  try {
    // Find templates directory using multiple resolution strategies
    const templatesPath = findTemplatesDirectory(configuredPath);
    
    if (templateName) {
      // Get information about a specific template
      return getSpecificTemplateInfo(templateName, templatesPath);
    } else {
      // List all available templates
      return getAllTemplatesInfo(templatesPath);
    }
  } catch (error) {
    console.error('Failed to get template information:', error);
    throw error;
  }
}

/**
 * Get information about a specific template
 */
function getSpecificTemplateInfo(templateName: string, templatesPath: string): any {
  // Look for template file with .yaml or .yml extension
  const templateFile = findTemplateFile(templateName, templatesPath);
  
  if (!templateFile) {
    throw new Error(`Template not found: ${templateName}.yaml or ${templateName}.yml. Searched in: ${templatesPath}`);
  }
  
  // Read template content
  const templateContent = fs.readFileSync(templateFile, 'utf8');
  
  // Parse template metadata
  const metadata = parseTemplateMetadata(templateContent);
  
  // Get template type
  const templateType = getTemplateType(templateName);
  
  return {
    name: templateName,
    type: templateType,
    path: templateFile,
    metadata
  };
}

/**
 * Get information about all available templates
 */
function getAllTemplatesInfo(templatesPath: string): any {
  const templates: any[] = [];
  
  // Read all files in templates directory
  const files = fs.readdirSync(templatesPath);
  
  for (const file of files) {
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const templateName = file.replace(/\.(yaml|yml)$/, '');
      
      try {
        // Get template information
        const templateInfo = getSpecificTemplateInfo(templateName, templatesPath);
        templates.push(templateInfo);
      } catch (error) {
        console.warn(`Skipping template ${templateName}:`, error);
      }
    }
  }
  
  // Group templates by type
  const groupedTemplates: Record<string, any[]> = {};
  
  for (const template of templates) {
    if (!groupedTemplates[template.type]) {
      groupedTemplates[template.type] = [];
    }
    
    groupedTemplates[template.type].push(template);
  }
  
  return groupedTemplates;
}

/**
 * Find a template file by name
 */
function findTemplateFile(templateName: string, templatesPath: string): string | null {
  const yamlFile = path.join(templatesPath, `${templateName}.yaml`);
  const ymlFile = path.join(templatesPath, `${templateName}.yml`);
  
  if (fs.existsSync(yamlFile)) {
    return yamlFile;
  } else if (fs.existsSync(ymlFile)) {
    return ymlFile;
  }
  
  return null;
}

/**
 * Parse template metadata from content
 */
function parseTemplateMetadata(templateContent: string): any {
  const metadata: any = {};
  
  // Look for metadata comments in the template
  const metadataRegex = /# Metadata: ([a-zA-Z0-9_]+): (.+)/g;
  let match;
  
  while ((match = metadataRegex.exec(templateContent)) !== null) {
    const key = match[1];
    const value = match[2];
    metadata[key] = value;
  }
  
  // Extract resources from template
  const resourcesRegex = /Resources:\s*([a-zA-Z0-9_]+):\s*Type:\s*([a-zA-Z0-9:]+)/g;
  const resources: any[] = [];
  
  while ((match = resourcesRegex.exec(templateContent)) !== null) {
    resources.push({
      name: match[1],
      type: match[2]
    });
  }
  
  metadata.resources = resources;
  
  return metadata;
}

/**
 * Determine template type from name
 */
function getTemplateType(templateName: string): string {
  if (templateName.endsWith('-api')) {
    return 'api';
  } else if (templateName.endsWith('-fullstack')) {
    return 'fullstack';
  } else if (templateName === 'static-website') {
    return 'static';
  }
  
  // Default to api type
  return 'api';
}
