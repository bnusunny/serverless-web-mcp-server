/**
 * Bootstrap Generator for Lambda Web Adapter
 * 
 * This module generates the bootstrap file needed for Lambda Web Adapter
 * based on the framework and project structure.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { BootstrapOptions, PackageJson } from '../types/index.js';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const accessAsync = promisify(fs.access);
const chmodAsync = promisify(fs.chmod);

/**
 * Generate bootstrap file for Lambda Web Adapter
 * 
 * @param options - Configuration options
 * @returns - Path to the generated bootstrap file
 */
export async function generateBootstrap(options: BootstrapOptions): Promise<string> {
  const { framework, entryPoint, projectPath, environment = {} } = options;
  
  // If framework is not specified, try to detect it
  const detectedFramework = framework || await detectFramework(projectPath);
  
  // If entry point is not specified, try to detect it
  const detectedEntryPoint = entryPoint || await detectEntryPoint(detectedFramework, projectPath);
  
  // Generate bootstrap content based on framework
  const bootstrapContent = generateBootstrapContent(detectedFramework, detectedEntryPoint, environment);
  
  // Write bootstrap file
  const bootstrapPath = path.join(projectPath, 'bootstrap');
  await writeFileAsync(bootstrapPath, bootstrapContent);
  
  // Make bootstrap file executable
  await chmodAsync(bootstrapPath, 0o755);
  
  console.log(`Generated bootstrap file for ${detectedFramework} at ${bootstrapPath}`);
  return bootstrapPath;
}

/**
 * Detect framework based on project structure
 * 
 * @param projectPath - Path to the project directory
 * @returns - Detected framework
 */
async function detectFramework(projectPath: string): Promise<string> {
  try {
    // Check for package.json (Node.js)
    const packageJsonPath = path.join(projectPath, 'package.json');
    await accessAsync(packageJsonPath, fs.constants.F_OK);
    
    // Read package.json to determine if it's Express, Next.js, etc.
    const packageJsonContent = await readFileAsync(packageJsonPath, 'utf8');
    const packageJson: PackageJson = JSON.parse(packageJsonContent);
    const dependencies = { 
      ...packageJson.dependencies, 
      ...packageJson.devDependencies 
    };
    
    if (dependencies?.express) {
      return 'express';
    } else if (dependencies?.next) {
      return 'nextjs';
    } else if (dependencies?.koa) {
      return 'koa';
    } else if (dependencies?.fastify) {
      return 'fastify';
    } else {
      return 'nodejs';
    }
  } catch (error) {
    // Not a Node.js project, check for Python
    try {
      const requirementsPath = path.join(projectPath, 'requirements.txt');
      await accessAsync(requirementsPath, fs.constants.F_OK);
      
      // Read requirements.txt to determine if it's Flask, FastAPI, etc.
      const requirements = await readFileAsync(requirementsPath, 'utf8');
      
      if (requirements.includes('flask')) {
        return 'flask';
      } else if (requirements.includes('fastapi')) {
        return 'fastapi';
      } else if (requirements.includes('django')) {
        return 'django';
      } else {
        return 'python';
      }
    } catch (error) {
      // Check for other frameworks
      try {
        const gemfilePath = path.join(projectPath, 'Gemfile');
        await accessAsync(gemfilePath, fs.constants.F_OK);
        return 'ruby';
      } catch (error) {
        // Default to generic
        return 'generic';
      }
    }
  }
}

/**
 * Detect entry point based on framework and project structure
 * 
 * @param framework - Web framework
 * @param projectPath - Path to the project directory
 * @returns - Detected entry point
 */
async function detectEntryPoint(framework: string, projectPath: string): Promise<string> {
  switch (framework) {
    case 'express':
    case 'nodejs':
    case 'koa':
    case 'fastify':
      // Check common Node.js entry points
      const nodeEntryPoints = ['app.js', 'index.js', 'server.js', 'main.js'];
      for (const entryPoint of nodeEntryPoints) {
        try {
          await accessAsync(path.join(projectPath, entryPoint), fs.constants.F_OK);
          return entryPoint;
        } catch (error) {
          // File doesn't exist, try next one
        }
      }
      return 'app.js'; // Default for Node.js
      
    case 'nextjs':
      return 'server.js'; // Default for Next.js
      
    case 'flask':
      // Check common Flask entry points
      const flaskEntryPoints = ['app.py', 'main.py', 'wsgi.py'];
      for (const entryPoint of flaskEntryPoints) {
        try {
          await accessAsync(path.join(projectPath, entryPoint), fs.constants.F_OK);
          return entryPoint;
        } catch (error) {
          // File doesn't exist, try next one
        }
      }
      return 'app.py'; // Default for Flask
      
    case 'fastapi':
      // Check common FastAPI entry points
      const fastapiEntryPoints = ['main.py', 'app.py', 'api.py'];
      for (const entryPoint of fastapiEntryPoints) {
        try {
          await accessAsync(path.join(projectPath, entryPoint), fs.constants.F_OK);
          const content = await readFileAsync(path.join(projectPath, entryPoint), 'utf8');
          // Look for FastAPI app instance
          const match = content.match(/(\w+)\s*=\s*FastAPI\(/);
          if (match) {
            return `${entryPoint.replace('.py', '')}:${match[1]}`;
          }
        } catch (error) {
          // File doesn't exist or doesn't contain FastAPI app, try next one
        }
      }
      return 'main:app'; // Default for FastAPI
      
    case 'django':
      return 'wsgi.py'; // Default for Django
      
    case 'ruby':
      return 'config.ru'; // Default for Ruby/Rails
      
    default:
      return 'app.js'; // Default fallback
  }
}

/**
 * Generate bootstrap content based on framework and entry point
 * 
 * @param framework - Web framework
 * @param entryPoint - Entry point file or module
 * @param environment - Environment variables
 * @returns - Bootstrap file content
 */
function generateBootstrapContent(
  framework: string, 
  entryPoint: string, 
  environment: Record<string, string>
): string {
  // Common environment variables setup
  const envSetup = Object.entries(environment)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join('\n');
  
  switch (framework) {
    case 'express':
    case 'nodejs':
    case 'koa':
    case 'fastify':
      return `#!/bin/bash
# Bootstrap script for ${framework} application
set -e

# Set environment variables
export NODE_ENV=production
${envSetup}

# Start the application
exec node ${entryPoint}
`;
      
    case 'nextjs':
      return `#!/bin/bash
# Bootstrap script for Next.js application
set -e

# Set environment variables
export NODE_ENV=production
${envSetup}

# Start the application
exec node ${entryPoint}
`;
      
    case 'flask':
      return `#!/bin/bash
# Bootstrap script for Flask application
set -e

# Set environment variables
export FLASK_APP=${entryPoint}
export FLASK_ENV=production
${envSetup}

# Start the application
exec python -m flask run --host=0.0.0.0 --port=$PORT
`;
      
    case 'fastapi':
      return `#!/bin/bash
# Bootstrap script for FastAPI application
set -e

# Set environment variables
${envSetup}

# Start the application
exec uvicorn ${entryPoint} --host=0.0.0.0 --port=$PORT
`;
      
    case 'django':
      return `#!/bin/bash
# Bootstrap script for Django application
set -e

# Set environment variables
export DJANGO_SETTINGS_MODULE=config.settings.production
${envSetup}

# Start the application
exec gunicorn --bind=0.0.0.0:$PORT ${entryPoint.replace('.py', '')}
`;
      
    case 'ruby':
      return `#!/bin/bash
# Bootstrap script for Ruby application
set -e

# Set environment variables
export RACK_ENV=production
${envSetup}

# Start the application
exec bundle exec rackup -p $PORT -o 0.0.0.0
`;
      
    default:
      return `#!/bin/bash
# Bootstrap script for web application
set -e

# Set environment variables
${envSetup}

# Start the application (customize this line for your specific application)
exec ${entryPoint}
`;
  }
}

export default {
  generateBootstrap,
  detectFramework,
  detectEntryPoint
};
