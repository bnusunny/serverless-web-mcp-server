import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config.js';

/**
 * Get information about available deployment templates
 */
export async function getTemplateInfo(templateName?: string): Promise<any> {
  const config = loadConfig();
  const templatesPath = path.resolve(config.templates.path);
  
  try {
    // Ensure templates directory exists
    if (!fs.existsSync(templatesPath)) {
      throw new Error(`Templates directory not found: ${templatesPath}`);
    }
    
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
    throw new Error(`Template not found: ${templateName}`);
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
