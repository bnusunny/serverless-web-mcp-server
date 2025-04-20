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
        content: [
          {
            type: "text",
            text: `# Lambda Web Adapter Startup Script

The startup script is a critical component for running web applications on AWS Lambda with Lambda Web Adapter.

## Automatic Generation

You can now automatically generate a startup script by providing:

1. The \`entryPoint\` parameter pointing to your application's main file
2. Setting \`generateStartupScript\` to \`true\`

Example:
\`\`\`json
{
  "backendConfiguration": {
    "runtime": "nodejs18.x",
    "entryPoint": "app.js",
    "generateStartupScript": true
  }
}
\`\`\`

## Manual Creation

If you prefer to create the startup script manually, it should:

1. Be executable (\`chmod +x\`)
2. Set the PORT environment variable
3. Start your application

Example for Node.js:
\`\`\`bash
#!/bin/bash
export PORT=8080
exec node app.js
\`\`\`

## Dependencies

The deployment process will automatically attempt to install dependencies based on your runtime:

- **Node.js**: Will copy package.json from your project root (if not already in the build artifacts) and run \`npm install --production\`
- **Python**: Will copy requirements.txt and run \`pip install -r requirements.txt -t .\`
- **Ruby**: Will copy Gemfile and run \`bundle install\`

Make sure your dependency files (package.json, requirements.txt, etc.) are either in your project root or already included in your build artifacts.

## Common Issues

- **Entry point not found**: Ensure your entry point file exists in the built artifacts directory
- **Script not executable**: If creating manually, run \`chmod +x bootstrap\`
- **Wrong runtime**: Make sure you're using the correct runtime for your application
- **Missing dependencies**: Check if your dependency files are correctly placed

## Supported Runtimes

- Node.js: nodejs14.x, nodejs16.x, nodejs18.x
- Python: python3.7, python3.8, python3.9
- Java: java8, java8.al2, java11
- .NET: dotnet3.1, dotnet5.0, dotnet6
- Go: go1.x
- Ruby: ruby2.7

## Examples

### Node.js Express Application

\`\`\`json
{
  "deploymentType": "backend",
  "projectName": "express-api",
  "projectRoot": "/path/to/project",
  "backendConfiguration": {
    "builtArtifactsPath": "/path/to/project/dist",
    "runtime": "nodejs18.x",
    "entryPoint": "app.js",
    "generateStartupScript": true
  }
}
\`\`\`

### Python Flask Application

\`\`\`json
{
  "deploymentType": "backend",
  "projectName": "flask-api",
  "projectRoot": "/path/to/project",
  "backendConfiguration": {
    "builtArtifactsPath": "/path/to/project/package",
    "runtime": "python3.9",
    "entryPoint": "app.py",
    "generateStartupScript": true
  }
}
\`\`\`
`
          }
        ]
      };
      
    case 'artifacts_path':
      return {
        topic: 'artifacts_path',
        title: 'Built Artifacts Requirements',
        description: 'The built artifacts path should contain all the files needed to run your application.',
        content: [
          {
            type: "text",
            text: `# Built Artifacts Requirements

The built artifacts path should contain all the files needed to run your application.

## Requirements

- Must include your compiled/transpiled application code
- Must include the startup script or entry point file
- Dependencies will be automatically installed by the deployment process

## Node.js Example

Build commands:
\`\`\`bash
npm install
npm run build
\`\`\`

Typical path: \`./dist\`

## Python Example

Build commands:
\`\`\`bash
# Compile Python files if needed
cp *.py ./package/
\`\`\`

Typical path: \`./package\`

## Dependency Handling

The deployment process will automatically:
1. Look for dependency files (package.json, requirements.txt, etc.) in your build artifacts
2. If not found there, copy them from your project root
3. Install dependencies in the build artifacts directory

This means you don't need to include node_modules or other dependency directories in your build artifacts.

## Examples

### Node.js Project

\`\`\`json
{
  "backendConfiguration": {
    "builtArtifactsPath": "/path/to/project/dist",
    "runtime": "nodejs18.x"
  }
}
\`\`\`

### Python Project

\`\`\`json
{
  "backendConfiguration": {
    "builtArtifactsPath": "/path/to/project/package",
    "runtime": "python3.9"
  }
}
\`\`\`
`
          }
        ]
      };
      
    case 'permissions':
      return {
        topic: 'permissions',
        title: 'File Permissions Requirements',
        description: 'AWS Lambda requires specific file permissions for your application.',
        content: [
          {
            type: "text",
            text: `# File Permissions Requirements

AWS Lambda requires specific file permissions for your application.

## Requirements

- Startup script must have executable permissions (chmod +x)
- All files should be readable
- Directory permissions should allow Lambda to access your files

## Useful Commands

- Make file executable: \`chmod +x filename\`
- Check file permissions: \`ls -la filename\`
- Set correct permissions recursively: \`find . -type f -exec chmod 644 {} \\; && find . -type d -exec chmod 755 {} \\;\`

## Examples

### Making a Script Executable

\`\`\`bash
chmod +x bootstrap
\`\`\`

### Checking Permissions

\`\`\`bash
ls -la bootstrap
# Should show something like:
# -rwxr-xr-x 1 user group 123 Jan 1 12:00 bootstrap
\`\`\`
`
          }
        ]
      };
      
    case 'project_structure':
      return {
        topic: 'project_structure',
        title: 'Project Structure Requirements',
        description: 'The deployment tool expects a specific project structure.',
        content: [
          {
            type: "text",
            text: `# Project Structure Requirements

The deployment tool expects a specific project structure.

## Backend Projects

Backend projects should have:
- Source code files
- Built artifacts directory (e.g., dist, build, package)
- Executable startup script in the artifacts directory
- All dependencies included in the artifacts directory

## Frontend Projects

Frontend projects should have:
- Built static assets directory (e.g., build, dist, public)
- index.html in the root of the assets directory
- All CSS, JS, and other assets included

## Fullstack Projects

Fullstack projects should have separate backend and frontend directories, each following their respective structure requirements.

## Examples

### Backend Project Structure

\`\`\`
project/
├── src/            # Source code files
├── dist/           # Built artifacts
│   ├── bootstrap   # Executable startup script
│   ├── index.js    # Application code
│   └── node_modules/  # Dependencies
└── package.json    # Project configuration
\`\`\`

### Frontend Project Structure

\`\`\`
project/
├── src/            # Source code files
└── build/          # Built static assets
    ├── index.html  # Main HTML file
    └── static/      # Static assets
        ├── css/     # Stylesheets
        ├── js/      # JavaScript files
        └── media/   # Images and other media
\`\`\`
`
          }
        ]
      };
      
    case 'database':
      return {
        topic: 'database',
        title: 'Database Configuration',
        description: 'The deploy tool can create and configure database resources like DynamoDB tables as part of your deployment.',
        content: [
          {
            type: "text",
            text: `# Database Configuration

The deploy tool can create and configure database resources like DynamoDB tables as part of your deployment.

## Capabilities

- Create new DynamoDB tables with specified schema
- Configure table capacity (on-demand or provisioned)
- Set up primary keys and attribute definitions
- Integrate the database with your application

## DynamoDB Configuration

Example DynamoDB configuration:
\`\`\`json
{
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
\`\`\`

## Notes

- The tableName is required and must be unique within your AWS account in the specified region
- attributeDefinitions define the data types for your attributes (S=String, N=Number, B=Binary)
- keySchema defines your primary key (HASH) and sort key (RANGE) if applicable
- billingMode can be PAY_PER_REQUEST (default) or PROVISIONED (requires readCapacity and writeCapacity)

## Examples

### Simple DynamoDB Table

\`\`\`json
{
  "backendConfiguration": {
    "databaseConfiguration": {
      "tableName": "Users",
      "attributeDefinitions": [
        { "name": "id", "type": "S" }
      ],
      "keySchema": [
        { "name": "id", "type": "HASH" }
      ]
    }
  }
}
\`\`\`

### DynamoDB Table with Composite Key

\`\`\`json
{
  "backendConfiguration": {
    "databaseConfiguration": {
      "tableName": "UserPosts",
      "attributeDefinitions": [
        { "name": "userId", "type": "S" },
        { "name": "postId", "type": "S" }
      ],
      "keySchema": [
        { "name": "userId", "type": "HASH" },
        { "name": "postId", "type": "RANGE" }
      ]
    }
  }
}
\`\`\`
`
          }
        ]
      };
      
    case 'general':
      return {
        topic: 'general',
        title: 'General Deployment Information',
        description: 'Overview of the deployment process and requirements.',
        content: [
          {
            type: "text",
            text: `# General Deployment Information

Overview of the deployment process and requirements.

## Deployment Types

- **backend**: Deploys a backend service using API Gateway and Lambda
- **frontend**: Deploys a frontend application using S3 and CloudFront
- **fullstack**: Deploys both backend and frontend components

## General Steps

1. Build your application
2. Ensure your startup script is executable (for backend)
3. Configure the deployment parameters
4. Run the deployment tool
5. Wait for the deployment to complete
6. Access your deployed application using the provided URL

## AWS Resources Created

Backend:
- AWS Lambda function with your application code
- API Gateway REST API or HTTP API
- IAM roles and policies for Lambda execution
- CloudWatch Log groups for monitoring
- DynamoDB tables (if database configuration is provided)

Frontend:
- S3 bucket configured for static website hosting
- CloudFront distribution for content delivery (optional)
- Route 53 records for custom domains (if configured)

## Examples

### Backend Deployment

\`\`\`json
{
  "deploymentType": "backend",
  "projectName": "my-api",
  "projectRoot": "/path/to/project",
  "backendConfiguration": {
    "builtArtifactsPath": "/path/to/built/artifacts",
    "runtime": "nodejs18.x",
    "entryPoint": "app.js",
    "generateStartupScript": true
  }
}
\`\`\`

### Frontend Deployment

\`\`\`json
{
  "deploymentType": "frontend",
  "projectName": "my-website",
  "projectRoot": "/path/to/project",
  "frontendConfiguration": {
    "builtAssetsPath": "/path/to/built/assets",
    "indexDocument": "index.html"
  }
}
\`\`\`
`
          }
        ]
      };
      
    default:
      return {
        error: `Help topic '${params.topic}' not found`,
        availableTopics: ['startup_script', 'artifacts_path', 'permissions', 'project_structure', 'database', 'general'],
        content: [
          {
            type: "text",
            text: `Help topic '${params.topic}' not found. Available topics: startup_script, artifacts_path, permissions, project_structure, database, general`
          }
        ]
      };
  }
}
