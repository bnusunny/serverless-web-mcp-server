/**
 * Deployment Help Tool
 * 
 * Provides guidance and examples for deployment requirements
 */

import { logger } from '../../utils/logger.js';

/**
 * Handle deployment help requests
 * @param {Object} params - Parameters for the help request
 * @param {string} params.topic - The help topic to retrieve information about
 * @returns {Object} Help information for the requested topic
 */
export async function handleDeploymentHelp(params: { topic: string }) {
  logger.info(`Getting deployment help for topic: ${params.topic}`);
  
  // Define help content for different topics
  switch (params.topic) {
    case 'startup_script':
      return {
        topic: 'startup_script',
        title: 'Lambda Web Adapter Startup Script',
        description: 'The startup script is a critical component for running web applications on AWS Lambda with Lambda Web Adapter.',
        sections: [
          {
            title: 'Automatic Generation',
            content: 'You can now automatically generate a startup script by providing:\n\n1. The `entryPoint` parameter pointing to your application\'s main file\n2. Setting `generateStartupScript` to `true`\n\nExample:\n```json\n{\n  "backendConfiguration": {\n    "runtime": "nodejs18.x",\n    "entryPoint": "app.js",\n    "generateStartupScript": true\n  }\n}\n```'
          },
          {
            title: 'Manual Creation',
            content: 'If you prefer to create the startup script manually, it should:\n\n1. Be executable (`chmod +x`)\n2. Set the PORT environment variable\n3. Start your application\n\nExample for Node.js:\n```bash\n#!/bin/bash\nexport PORT=8080\nexec node app.js\n```'
          },
          {
            title: 'Common Issues',
            content: '- **Entry point not found**: Ensure your entry point file exists in the built artifacts directory\n- **Script not executable**: If creating manually, run `chmod +x bootstrap`\n- **Wrong runtime**: Make sure you\'re using the correct runtime for your application'
          },
          {
            title: 'Supported Runtimes',
            content: '- Node.js: nodejs14.x, nodejs16.x, nodejs18.x\n- Python: python3.7, python3.8, python3.9\n- Java: java8, java8.al2, java11\n- .NET: dotnet3.1, dotnet5.0, dotnet6\n- Go: go1.x\n- Ruby: ruby2.7'
          }
        ],
        examples: [
          {
            title: 'Node.js Express Application',
            content: '```json\n{\n  "deploymentType": "backend",\n  "projectName": "express-api",\n  "projectRoot": "/path/to/project",\n  "backendConfiguration": {\n    "builtArtifactsPath": "/path/to/project/dist",\n    "runtime": "nodejs18.x",\n    "entryPoint": "app.js",\n    "generateStartupScript": true\n  }\n}\n```'
          },
          {
            title: 'Python Flask Application',
            content: '```json\n{\n  "deploymentType": "backend",\n  "projectName": "flask-api",\n  "projectRoot": "/path/to/project",\n  "backendConfiguration": {\n    "builtArtifactsPath": "/path/to/project/package",\n    "runtime": "python3.9",\n    "entryPoint": "app.py",\n    "generateStartupScript": true\n  }\n}\n```'
          }
        ]
      };
      
    case 'artifacts_path':
      return {
        topic: 'artifacts_path',
        title: 'Built Artifacts Requirements',
        description: 'The built artifacts path should contain all the files needed to run your application.',
        sections: [
          {
            title: 'Requirements',
            content: '- Must include all dependencies\n- Must be built for the target runtime\n- Must include the startup script or entry point file\n- Must be ready for execution without additional build steps'
          },
          {
            title: 'Node.js Example',
            content: 'Build commands:\n```bash\nnpm install\nnpm run build\n```\n\nTypical path: `./dist`\n\npackage.json:\n```json\n{\n  "scripts": {\n    "build": "tsc && cp package.json dist/ && cd dist && npm install --production"\n  }\n}\n```'
          },
          {
            title: 'Python Example',
            content: 'Build commands:\n```bash\npip install -r requirements.txt -t ./package\ncp *.py ./package/\n```\n\nTypical path: `./package`'
          }
        ],
        examples: [
          {
            title: 'Node.js Project',
            content: '```json\n{\n  "backendConfiguration": {\n    "builtArtifactsPath": "/path/to/project/dist",\n    "runtime": "nodejs18.x"\n  }\n}\n```'
          },
          {
            title: 'Python Project',
            content: '```json\n{\n  "backendConfiguration": {\n    "builtArtifactsPath": "/path/to/project/package",\n    "runtime": "python3.9"\n  }\n}\n```'
          }
        ]
      };
      
    case 'permissions':
      return {
        topic: 'permissions',
        title: 'File Permissions Requirements',
        description: 'AWS Lambda requires specific file permissions for your application.',
        sections: [
          {
            title: 'Requirements',
            content: '- Startup script must have executable permissions (chmod +x)\n- All files should be readable\n- Directory permissions should allow Lambda to access your files'
          },
          {
            title: 'Useful Commands',
            content: '- Make file executable: `chmod +x filename`\n- Check file permissions: `ls -la filename`\n- Set correct permissions recursively: `find . -type f -exec chmod 644 {} \\; && find . -type d -exec chmod 755 {} \\;`'
          }
        ],
        examples: [
          {
            title: 'Making a Script Executable',
            content: '```bash\nchmod +x bootstrap\n```'
          },
          {
            title: 'Checking Permissions',
            content: '```bash\nls -la bootstrap\n# Should show something like:\n# -rwxr-xr-x 1 user group 123 Jan 1 12:00 bootstrap\n```'
          }
        ]
      };
      
    case 'project_structure':
      return {
        topic: 'project_structure',
        title: 'Project Structure Requirements',
        description: 'The deployment tool expects a specific project structure.',
        sections: [
          {
            title: 'Backend Projects',
            content: 'Backend projects should have:\n- Source code files\n- Built artifacts directory (e.g., dist, build, package)\n- Executable startup script in the artifacts directory\n- All dependencies included in the artifacts directory'
          },
          {
            title: 'Frontend Projects',
            content: 'Frontend projects should have:\n- Built static assets directory (e.g., build, dist, public)\n- index.html in the root of the assets directory\n- All CSS, JS, and other assets included'
          },
          {
            title: 'Fullstack Projects',
            content: 'Fullstack projects should have separate backend and frontend directories, each following their respective structure requirements.'
          }
        ],
        examples: [
          {
            title: 'Backend Project Structure',
            content: '```\nproject/\n├── src/            # Source code files\n├── dist/           # Built artifacts\n│   ├── bootstrap   # Executable startup script\n│   ├── index.js    # Application code\n│   └── node_modules/  # Dependencies\n└── package.json    # Project configuration\n```'
          },
          {
            title: 'Frontend Project Structure',
            content: '```\nproject/\n├── src/            # Source code files\n└── build/          # Built static assets\n    ├── index.html  # Main HTML file\n    └── static/      # Static assets\n        ├── css/     # Stylesheets\n        ├── js/      # JavaScript files\n        └── media/   # Images and other media\n```'
          }
        ]
      };
      
    case 'database':
      return {
        topic: 'database',
        title: 'Database Configuration',
        description: 'The deploy tool can create and configure database resources like DynamoDB tables as part of your deployment.',
        sections: [
          {
            title: 'Capabilities',
            content: '- Create new DynamoDB tables with specified schema\n- Configure table capacity (on-demand or provisioned)\n- Set up primary keys and attribute definitions\n- Integrate the database with your application'
          },
          {
            title: 'DynamoDB Configuration',
            content: 'Example DynamoDB configuration:\n```json\n{\n  "databaseConfiguration": {\n    "tableName": "Users",\n    "attributeDefinitions": [\n      { "name": "id", "type": "S" },\n      { "name": "email", "type": "S" }\n    ],\n    "keySchema": [\n      { "name": "id", "type": "HASH" },\n      { "name": "email", "type": "RANGE" }\n    ],\n    "billingMode": "PAY_PER_REQUEST"\n  }\n}\n```'
          },
          {
            title: 'Notes',
            content: '- The tableName is required and must be unique within your AWS account in the specified region\n- attributeDefinitions define the data types for your attributes (S=String, N=Number, B=Binary)\n- keySchema defines your primary key (HASH) and sort key (RANGE) if applicable\n- billingMode can be PAY_PER_REQUEST (default) or PROVISIONED (requires readCapacity and writeCapacity)'
          }
        ],
        examples: [
          {
            title: 'Simple DynamoDB Table',
            content: '```json\n{\n  "backendConfiguration": {\n    "databaseConfiguration": {\n      "tableName": "Users",\n      "attributeDefinitions": [\n        { "name": "id", "type": "S" }\n      ],\n      "keySchema": [\n        { "name": "id", "type": "HASH" }\n      ]\n    }\n  }\n}\n```'
          },
          {
            title: 'DynamoDB Table with Composite Key',
            content: '```json\n{\n  "backendConfiguration": {\n    "databaseConfiguration": {\n      "tableName": "UserPosts",\n      "attributeDefinitions": [\n        { "name": "userId", "type": "S" },\n        { "name": "postId", "type": "S" }\n      ],\n      "keySchema": [\n        { "name": "userId", "type": "HASH" },\n        { "name": "postId", "type": "RANGE" }\n      ]\n    }\n  }\n}\n```'
          }
        ]
      };
      
    case 'general':
      return {
        topic: 'general',
        title: 'General Deployment Information',
        description: 'Overview of the deployment process and requirements.',
        sections: [
          {
            title: 'Deployment Types',
            content: '- **backend**: Deploys a backend service using API Gateway and Lambda\n- **frontend**: Deploys a frontend application using S3 and CloudFront\n- **fullstack**: Deploys both backend and frontend components'
          },
          {
            title: 'General Steps',
            content: '1. Build your application\n2. Ensure your startup script is executable (for backend)\n3. Configure the deployment parameters\n4. Run the deployment tool\n5. Wait for the deployment to complete\n6. Access your deployed application using the provided URL'
          },
          {
            title: 'AWS Resources Created',
            content: 'Backend:\n- AWS Lambda function with your application code\n- API Gateway REST API or HTTP API\n- IAM roles and policies for Lambda execution\n- CloudWatch Log groups for monitoring\n- DynamoDB tables (if database configuration is provided)\n\nFrontend:\n- S3 bucket configured for static website hosting\n- CloudFront distribution for content delivery (optional)\n- Route 53 records for custom domains (if configured)'
          }
        ],
        examples: [
          {
            title: 'Backend Deployment',
            content: '```json\n{\n  "deploymentType": "backend",\n  "projectName": "my-api",\n  "projectRoot": "/path/to/project",\n  "backendConfiguration": {\n    "builtArtifactsPath": "/path/to/built/artifacts",\n    "runtime": "nodejs18.x",\n    "entryPoint": "app.js",\n    "generateStartupScript": true\n  }\n}\n```'
          },
          {
            title: 'Frontend Deployment',
            content: '```json\n{\n  "deploymentType": "frontend",\n  "projectName": "my-website",\n  "projectRoot": "/path/to/project",\n  "frontendConfiguration": {\n    "builtAssetsPath": "/path/to/built/assets",\n    "indexDocument": "index.html"\n  }\n}\n```'
          }
        ]
      };
      
    default:
      return {
        error: `Help topic '${params.topic}' not found`,
        availableTopics: ['startup_script', 'artifacts_path', 'permissions', 'project_structure', 'database', 'general']
      };
  }
}
