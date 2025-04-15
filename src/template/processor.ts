// Renamed from template-processor.ts
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import { logger } from '../utils/logger.js';

/**
 * Process a template with the given configuration
 */
export async function processTemplate(templatePath: string, configuration: any, outputPath: string): Promise<void> {
  try {
    // Read template file
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    
    // Register helpers
    registerHandlebarsHelpers();
    
    // Compile template
    const template = Handlebars.compile(templateContent);
    
    // Process template with configuration
    const processedTemplate = template(configuration);
    
    // Write processed template to output path
    await fs.writeFile(outputPath, processedTemplate, 'utf-8');
    
    logger.debug(`Template processed successfully: ${templatePath} -> ${outputPath}`);
  } catch (error) {
    logger.error(`Error processing template: ${error}`);
    throw new Error(`Failed to process template: ${error}`);
  }
}

/**
 * Register custom Handlebars helpers
 */
function registerHandlebarsHelpers() {
  // Helper to check if a value exists
  Handlebars.registerHelper('ifExists', function(this: any, value: any, options: Handlebars.HelperOptions) {
    return value !== undefined && value !== null ? options.fn(this) : options.inverse(this);
  });
  
  // Helper to check if two values are equal
  Handlebars.registerHelper('ifEquals', function(this: any, value1: any, value2: any, options: Handlebars.HelperOptions) {
    return value1 === value2 ? options.fn(this) : options.inverse(this);
  });
  
  // Helper to iterate over object properties
  Handlebars.registerHelper('eachInObject', function(object: Record<string, any>, options: Handlebars.HelperOptions) {
    if (!object || typeof object !== 'object') {
      return '';
    }
    
    let result = '';
    for (const [key, value] of Object.entries(object)) {
      result += options.fn({ key, value });
    }
    
    return result;
  });
  
  // Helper to join array values
  Handlebars.registerHelper('join', function(array: any[], separator: string) {
    if (!Array.isArray(array)) {
      return '';
    }
    
    return array.join(separator);
  });
  
  // Helper to convert object to JSON string
  Handlebars.registerHelper('toJson', function(object: any) {
    return JSON.stringify(object);
  });
  
  // Helper to get nested property
  Handlebars.registerHelper('get', function(object: Record<string, any>, path: string) {
    if (!object || typeof object !== 'object' || !path) {
      return undefined;
    }
    
    const parts = path.split('.');
    let current = object;
    
    for (const part of parts) {
      if (current[part] === undefined) {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
  });
}
