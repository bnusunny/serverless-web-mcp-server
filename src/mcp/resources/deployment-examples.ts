/**
 * Deployment Examples Resource
 * 
 * Provides examples and templates for deployment configurations
 */

import { McpResource } from './index.js';

/**
 * Handle deployment examples resource requests
 * @returns {Object} Deployment examples and templates
 */
function handleDeploymentExamples() {
  return {
    nodejs: {
      backend: {
        buildCommand: "npm run build",
        typicalArtifactsPath: "./dist",
        startupScriptExample: `#!/usr/bin/env node
require('./app.js');`,
        preparationSteps: [
          "1. Ensure your package.json has a build script",
          "2. Build your application: npm run build",
          "3. Create a startup script in your dist folder",
          "4. Make it executable: chmod +x dist/app.js",
          "5. Deploy with the correct paths"
        ],
        tsconfig: {
          "compilerOptions": {
            "target": "es2018",
            "module": "commonjs",
            "outDir": "./dist",
            "rootDir": "./src",
            "strict": true,
            "esModuleInterop": true
          },
          "include": ["src/**/*"],
          "exclude": ["node_modules"]
        },
        packageJson: {
          "scripts": {
            "build": "tsc && cp package.json dist/ && cd dist && npm install --production"
          }
        },
        deploymentConfig: {
          "deploymentType": "backend",
          "projectName": "nodejs-api",
          "projectRoot": "/path/to/project",
          "backendConfiguration": {
            "builtArtifactsPath": "/path/to/project/dist",
            "runtime": "nodejs18.x",
            "startupScript": "app.js"
          }
        }
      },
      frontend: {
        buildCommand: "npm run build",
        typicalArtifactsPath: "./build",
        preparationSteps: [
          "1. Ensure your package.json has a build script",
          "2. Build your application: npm run build",
          "3. Deploy with the path to your built assets"
        ],
        packageJson: {
          "scripts": {
            "build": "react-scripts build"
          }
        },
        deploymentConfig: {
          "deploymentType": "frontend",
          "projectName": "nodejs-website",
          "projectRoot": "/path/to/project",
          "frontendConfiguration": {
            "builtAssetsPath": "/path/to/project/build",
            "indexDocument": "index.html"
          }
        }
      },
      fullstack: {
        preparationSteps: [
          "1. Build both backend and frontend",
          "2. Ensure backend startup script is executable",
          "3. Deploy with paths to both backend and frontend artifacts"
        ],
        deploymentConfig: {
          "deploymentType": "fullstack",
          "projectName": "nodejs-fullstack",
          "projectRoot": "/path/to/project",
          "backendConfiguration": {
            "builtArtifactsPath": "/path/to/project/backend/dist",
            "runtime": "nodejs18.x",
            "startupScript": "app.js"
          },
          "frontendConfiguration": {
            "builtAssetsPath": "/path/to/project/frontend/build",
            "indexDocument": "index.html"
          }
        }
      }
    },
    python: {
      backend: {
        buildCommand: "pip install -r requirements.txt -t ./package",
        typicalArtifactsPath: "./package",
        startupScriptExample: `#!/usr/bin/env python3
import app
app.handler()`,
        preparationSteps: [
          "1. Create a requirements.txt file with your dependencies",
          "2. Package your dependencies: pip install -r requirements.txt -t ./package",
          "3. Copy your application code to the package directory: cp *.py ./package/",
          "4. Create a startup script in your package folder",
          "5. Make it executable: chmod +x package/app.py",
          "6. Deploy with the correct paths"
        ],
        deploymentConfig: {
          "deploymentType": "backend",
          "projectName": "python-api",
          "projectRoot": "/path/to/project",
          "backendConfiguration": {
            "builtArtifactsPath": "/path/to/project/package",
            "runtime": "python3.9",
            "startupScript": "app.py"
          }
        }
      }
    },
    java: {
      backend: {
        buildCommand: "./gradlew build",
        typicalArtifactsPath: "./build/libs",
        startupScriptExample: `#!/bin/bash
java -jar app.jar`,
        preparationSteps: [
          "1. Build your application: ./gradlew build",
          "2. Create a startup script in your build/libs folder",
          "3. Make it executable: chmod +x build/libs/start.sh",
          "4. Deploy with the correct paths"
        ],
        deploymentConfig: {
          "deploymentType": "backend",
          "projectName": "java-api",
          "projectRoot": "/path/to/project",
          "backendConfiguration": {
            "builtArtifactsPath": "/path/to/project/build/libs",
            "runtime": "java11",
            "startupScript": "start.sh"
          }
        }
      }
    },
    troubleshooting: {
      commonIssues: [
        {
          issue: "Startup script not found",
          solution: "Check that the path to your startup script is correct and that it exists in your built artifacts directory"
        },
        {
          issue: "Startup script is not executable",
          solution: "Run 'chmod +x' on your startup script to make it executable"
        },
        {
          issue: "Missing dependencies",
          solution: "Ensure all dependencies are included in your built artifacts directory"
        },
        {
          issue: "Incorrect runtime",
          solution: "Make sure the runtime you specified is compatible with your application"
        },
        {
          issue: "Deployment fails with no specific error",
          solution: "Check CloudWatch logs for more details about the failure"
        }
      ]
    }
  };
}

/**
 * Deployment examples resource
 */
const deploymentExamples: McpResource = {
  name: 'Deployment Examples',
  uri: 'deployment:examples',
  description: 'Examples and templates for deployment configurations',
  handler: async () => {
    return handleDeploymentExamples();
  }
};

export default deploymentExamples;
