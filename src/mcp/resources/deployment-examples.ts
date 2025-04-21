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
  const examples = {
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
            "build": "tsc && cp package.json dist/"
          }
        },
        deploymentConfig: {
          "deploymentType": "backend",
          "projectName": "nodejs-api",
          "projectRoot": "/path/to/project",
          "region": "us-east-1",
          "backendConfiguration": {
            "builtArtifactsPath": "dist",
            "runtime": "nodejs18.x",
            "entryPoint": "app.js",
            "generateStartupScript": true,
            "environment": {
              "NODE_ENV": "production"
            },
            "databaseConfiguration": {
              "tableName": "Users",
              "attributeDefinitions": [
                { "name": "id", "type": "S" },
                { "name": "email", "type": "S" }
              ],
              "keySchema": [
                { "name": "id", "type": "HASH" },
                { "name": "email", "type": "RANGE" }
              ],
              "billingMode": "PAY_PER_REQUEST"
            }
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
          "region": "us-east-1",
          "frontendConfiguration": {
            "builtAssetsPath": "build",
            "indexDocument": "index.html",
            "errorDocument": "index.html"
          }
        }
      },
      fullstack: {
        preparationSteps: [
          "1. Build both backend and frontend",
          "2. Deploy with paths to both backend and frontend artifacts"
        ],
        deploymentConfig: {
          "deploymentType": "fullstack",
          "projectName": "nodejs-fullstack",
          "projectRoot": "/path/to/project",
          "region": "us-east-1",
          "backendConfiguration": {
            "builtArtifactsPath": "backend/dist",
            "runtime": "nodejs18.x",
            "entryPoint": "app.js",
            "generateStartupScript": true,
            "environment": {
              "NODE_ENV": "production"
            },
            "databaseConfiguration": {
              "tableName": "Products",
              "attributeDefinitions": [
                { "name": "id", "type": "S" },
                { "name": "category", "type": "S" }
              ],
              "keySchema": [
                { "name": "id", "type": "HASH" },
                { "name": "category", "type": "RANGE" }
              ],
              "billingMode": "PAY_PER_REQUEST"
            }
          },
          "frontendConfiguration": {
            "builtAssetsPath": "frontend/build",
            "indexDocument": "index.html",
            "errorDocument": "index.html"
          }
        }
      }
    },
    python: {
      backend: {
        buildCommand: "pip install -r requirements.txt",
        typicalArtifactsPath: "./app",
        preparationSteps: [
          "1. Create a requirements.txt file with your dependencies",
          "2. Create your application code",
          "3. Deploy with the path to your application directory"
        ],
        deploymentConfig: {
          "deploymentType": "backend",
          "projectName": "python-api",
          "projectRoot": "/path/to/project",
          "region": "us-east-1",
          "backendConfiguration": {
            "builtArtifactsPath": "app",
            "runtime": "python3.9",
            "entryPoint": "app.py",
            "generateStartupScript": true,
            "environment": {
              "PYTHONPATH": "/var/task"
            },
            "databaseConfiguration": {
              "tableName": "Tasks",
              "attributeDefinitions": [
                { "name": "taskId", "type": "S" },
                { "name": "userId", "type": "S" }
              ],
              "keySchema": [
                { "name": "taskId", "type": "HASH" },
                { "name": "userId", "type": "RANGE" }
              ],
              "billingMode": "PAY_PER_REQUEST"
            }
          }
        }
      }
    },
    ruby: {
      backend: {
        buildCommand: "bundle install --path vendor/bundle",
        typicalArtifactsPath: "./app",
        preparationSteps: [
          "1. Create a Gemfile with your dependencies",
          "2. Run bundle install",
          "3. Create your application code",
          "4. Deploy with the path to your application directory"
        ],
        deploymentConfig: {
          "deploymentType": "backend",
          "projectName": "ruby-api",
          "projectRoot": "/path/to/project",
          "region": "us-east-1",
          "backendConfiguration": {
            "builtArtifactsPath": "app",
            "runtime": "ruby2.7",
            "entryPoint": "app.rb",
            "generateStartupScript": true,
            "environment": {
              "RACK_ENV": "production"
            }
          }
        }
      }
    },
    java: {
      backend: {
        buildCommand: "./gradlew build",
        typicalArtifactsPath: "./build/libs",
        preparationSteps: [
          "1. Build your application: ./gradlew build",
          "2. Deploy with the path to your built JAR file"
        ],
        deploymentConfig: {
          "deploymentType": "backend",
          "projectName": "java-api",
          "projectRoot": "/path/to/project",
          "region": "us-east-1",
          "backendConfiguration": {
            "builtArtifactsPath": "build/libs",
            "runtime": "java11",
            "entryPoint": "app.jar",
            "generateStartupScript": true,
            "memorySize": 1024,
            "timeout": 60
          }
        }
      }
    },
    database: {
      dynamodb: {
        simpleTable: {
          description: "Simple DynamoDB table with just a partition key",
          config: {
            "tableName": "SimpleTable",
            "attributeDefinitions": [
              { "name": "id", "type": "S" }
            ],
            "keySchema": [
              { "name": "id", "type": "HASH" }
            ],
            "billingMode": "PAY_PER_REQUEST"
          }
        },
        compositeKeyTable: {
          description: "DynamoDB table with composite key (partition + sort key)",
          config: {
            "tableName": "CompositeKeyTable",
            "attributeDefinitions": [
              { "name": "userId", "type": "S" },
              { "name": "createdAt", "type": "S" }
            ],
            "keySchema": [
              { "name": "userId", "type": "HASH" },
              { "name": "createdAt", "type": "RANGE" }
            ],
            "billingMode": "PAY_PER_REQUEST"
          }
        },
        provisionedCapacityTable: {
          description: "DynamoDB table with provisioned capacity",
          config: {
            "tableName": "ProvisionedTable",
            "attributeDefinitions": [
              { "name": "id", "type": "S" }
            ],
            "keySchema": [
              { "name": "id", "type": "HASH" }
            ],
            "billingMode": "PROVISIONED",
            "readCapacity": 5,
            "writeCapacity": 5
          }
        }
      }
    },
    frameworks: {
      express: {
        description: "Node.js Express framework",
        entryPoint: "app.js",
        sampleCode: `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});

module.exports = app;`
      },
      flask: {
        description: "Python Flask framework",
        entryPoint: "app.py",
        sampleCode: `from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify({"message": "Hello from Flask!"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))`
      },
      fastapi: {
        description: "Python FastAPI framework",
        entryPoint: "app.py",
        sampleCode: `from fastapi import FastAPI
import uvicorn
import os

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))`
      },
      react: {
        description: "React frontend framework",
        buildCommand: "npm run build",
        sampleCode: `import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);`
      }
    },
    troubleshooting: {
      commonIssues: [
        {
          issue: "Missing dependencies",
          solution: "The server now automatically handles dependencies for backend deployments. You only need to provide your compiled code, and the deployment process will handle the rest."
        },
        {
          issue: "Startup script issues",
          solution: "Use the new generateStartupScript=true option with entryPoint to automatically generate a startup script based on your runtime and entry point."
        },
        {
          issue: "Deployment fails with no specific error",
          solution: "Check CloudWatch logs for more details about the failure. You can use the get-logs tool to retrieve logs."
        },
        {
          issue: "CORS issues with API",
          solution: "CORS is enabled by default. You can disable it by setting cors: false in your backendConfiguration."
        },
        {
          issue: "Lambda timeout",
          solution: "Increase the timeout value in your backendConfiguration (default is 30 seconds)."
        },
        {
          issue: "Path resolution issues",
          solution: "Remember that builtArtifactsPath and builtAssetsPath can be relative to projectRoot. For example, if projectRoot is '/home/user/project', then builtArtifactsPath: 'dist' will resolve to '/home/user/project/dist'."
        }
      ]
    },
    pathResolution: {
      description: "How paths are resolved in deployment parameters",
      examples: [
        {
          scenario: "Absolute paths",
          projectRoot: "/home/user/project",
          builtArtifactsPath: "/home/user/project/dist",
          explanation: "When builtArtifactsPath is absolute, it's used as-is"
        },
        {
          scenario: "Relative paths",
          projectRoot: "/home/user/project",
          builtArtifactsPath: "dist",
          resolvedPath: "/home/user/project/dist",
          explanation: "When builtArtifactsPath is relative, it's resolved against projectRoot"
        },
        {
          scenario: "Nested project structure",
          projectRoot: "/home/user/project",
          builtArtifactsPath: "backend/dist",
          resolvedPath: "/home/user/project/backend/dist",
          explanation: "Works with nested directories too"
        }
      ]
    }
  };

  // Create content items for each example category
  const contents = [
    {
      uri: "deployment:examples:nodejs",
      text: JSON.stringify(examples.nodejs, null, 2)
    },
    {
      uri: "deployment:examples:python",
      text: JSON.stringify(examples.python, null, 2)
    },
    {
      uri: "deployment:examples:ruby",
      text: JSON.stringify(examples.ruby, null, 2)
    },
    {
      uri: "deployment:examples:java",
      text: JSON.stringify(examples.java, null, 2)
    },
    {
      uri: "deployment:examples:database",
      text: JSON.stringify(examples.database, null, 2)
    },
    {
      uri: "deployment:examples:frameworks",
      text: JSON.stringify(examples.frameworks, null, 2)
    },
    {
      uri: "deployment:examples:troubleshooting",
      text: JSON.stringify(examples.troubleshooting, null, 2)
    },
    {
      uri: "deployment:examples:pathResolution",
      text: JSON.stringify(examples.pathResolution, null, 2)
    }
  ];

  return {
    contents: contents,
    metadata: {
      count: contents.length
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
