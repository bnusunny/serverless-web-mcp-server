import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

// Register basic helpers
Handlebars.registerHelper('ifEquals', function(this: any, arg1: any, arg2: any, options: Handlebars.HelperOptions) {
  return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('ifExists', function(this: any, value: any, options: Handlebars.HelperOptions) {
  return value ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('eachInObject', function(obj: Record<string, any>, options: Handlebars.HelperOptions) {
  let result = '';
  for (const [key, value] of Object.entries(obj || {})) {
    result += options.fn({ key, value });
  }
  return result;
});

// Helper for CloudFormation intrinsic functions
Handlebars.registerHelper('cf', function(functionName: string, ...args: any[]) {
  // Remove the last argument which is the Handlebars options object
  const options = args.pop();
  
  // Handle different intrinsic functions
  switch (functionName) {
    case 'Ref':
      return new Handlebars.SafeString(`!Ref ${args[0]}`);
    case 'GetAtt':
      return new Handlebars.SafeString(`!GetAtt ${args[0]} ${args[1]}`);
    case 'Sub':
      return new Handlebars.SafeString(`!Sub ${args[0]}`);
    default:
      return new Handlebars.SafeString(`!${functionName} ${args.join(' ')}`);
  }
});

/**
 * Process a template with Handlebars
 */
export async function processTemplate(templatePath: string, config: Record<string, any>, outputPath: string): Promise<string> {
  try {
    logger.debug(`Processing template: ${templatePath}`);
    logger.debug(`With configuration: ${JSON.stringify(config)}`);
    
    // Read template file
    const templateContent = await fs.readFile(templatePath, 'utf8');
    
    // Determine template type based on extension
    const extension = path.extname(templatePath);
    let processableTemplate = templateContent;
    
    if (extension === '.yaml' || extension === '.yml') {
      // Convert CloudFormation variable syntax to Handlebars syntax
      processableTemplate = templateContent.replace(/\$\{([^}]+)\}/g, '{{$1}}');
      
      // Remove AWS::ServerlessRepo::Application if present
      processableTemplate = processableTemplate.replace(
        /Metadata:\s+AWS::ServerlessRepo::Application:[\s\S]*?(?=\n\w|\Z)/m,
        'Metadata:'
      );
    }
    
    // Compile the template
    const template = Handlebars.compile(processableTemplate);
    
    // Process the template with configuration
    const processedContent = template(config);
    
    // Write the processed template
    await fs.writeFile(outputPath, processedContent);
    logger.info(`Template processed and written to: ${outputPath}`);
    
    return processedContent;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing template: ${errorMessage}`);
    throw error;
  }
}
