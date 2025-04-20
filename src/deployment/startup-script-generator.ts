/**
 * Startup Script Generator
 * 
 * Automatically generates appropriate startup scripts for different runtimes
 * to work with Lambda Web Adapter.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const writeFileAsync = promisify(fs.writeFile);
const chmodAsync = promisify(fs.chmod);

export interface StartupScriptOptions {
  runtime: string;
  entryPoint: string;
  builtArtifactsPath: string;
  startupScriptName?: string;
  additionalEnv?: Record<string, string>;
}

/**
 * Custom error class for entry point not found errors
 */
export class EntryPointNotFoundError extends Error {
  constructor(entryPoint: string, builtArtifactsPath: string) {
    super(`Entry point file not found: ${path.join(builtArtifactsPath, entryPoint)}`);
    this.name = 'EntryPointNotFoundError';
  }
}

/**
 * Generate a startup script based on runtime and entry point
 * @param options - Options for generating the startup script
 * @returns Path to the generated startup script
 * @throws EntryPointNotFoundError if the entry point file doesn't exist
 */
export async function generateStartupScript(options: StartupScriptOptions): Promise<string> {
  const { runtime, entryPoint, builtArtifactsPath } = options;
  const startupScriptName = options.startupScriptName || getDefaultStartupScriptName(runtime);
  const scriptPath = path.join(builtArtifactsPath, startupScriptName);
  const entryPointPath = path.join(builtArtifactsPath, entryPoint);
  
  logger.info(`Generating startup script for runtime: ${runtime}, entry point: ${entryPoint}`);
  
  // Check if entry point exists
  if (!fs.existsSync(entryPointPath)) {
    const error = new EntryPointNotFoundError(entryPoint, builtArtifactsPath);
    logger.error(error.message);
    
    // Provide helpful suggestions
    logger.info('Available files in the artifacts directory:');
    try {
      const files = fs.readdirSync(builtArtifactsPath);
      if (files.length === 0) {
        logger.info('  (directory is empty)');
      } else {
        files.forEach(file => logger.info(`  - ${file}`));
      }
    } catch (err) {
      logger.error(`Could not read directory: ${builtArtifactsPath}`);
    }
    
    throw error;
  }
  
  // Generate script content based on runtime
  const scriptContent = generateScriptContent(runtime, entryPoint, options.additionalEnv);
  
  // Write script to file
  await writeFileAsync(scriptPath, scriptContent, 'utf8');
  
  // Make script executable
  await chmodAsync(scriptPath, 0o755);
  
  logger.info(`Startup script generated at: ${scriptPath}`);
  
  return startupScriptName;
}

/**
 * Get default startup script name for a runtime
 * @param runtime - Lambda runtime
 * @returns Default startup script name
 */
function getDefaultStartupScriptName(runtime: string): string {
  // Lambda expects a file named "bootstrap" for custom runtimes
  return 'bootstrap';
}

/**
 * Generate script content based on runtime and entry point
 * @param runtime - Lambda runtime
 * @param entryPoint - Application entry point
 * @param additionalEnv - Additional environment variables
 * @returns Script content
 */
function generateScriptContent(runtime: string, entryPoint: string, additionalEnv?: Record<string, string>): string {
  // Generate environment variables setup
  const envSetup = additionalEnv ? 
    Object.entries(additionalEnv)
      .map(([key, value]) => `export ${key}="${value}"`)
      .join('\n') + '\n\n' 
    : '';
  
  if (runtime.startsWith('nodejs')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec node ${entryPoint}
`;
  } else if (runtime.startsWith('python')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec python ${entryPoint}
`;
  } else if (runtime.startsWith('java')) {
    // Determine if it's a JAR file or a class
    const isJar = entryPoint.toLowerCase().endsWith('.jar');
    
    if (isJar) {
      return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec java -jar ${entryPoint}
`;
    } else {
      return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec java ${entryPoint}
`;
    }
  } else if (runtime.startsWith('dotnet')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec dotnet ${entryPoint}
`;
  } else if (runtime.startsWith('go')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec ./${entryPoint}
`;
  } else if (runtime.startsWith('ruby')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec ruby ${entryPoint}
`;
  } else {
    // Generic script for unknown runtimes
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec ${entryPoint}
`;
  }
}
