/**
 * Deployment Help Tool
 * 
 * Provides help with deployment requirements and troubleshooting.
 */

import { z } from 'zod';
import { McpTool } from '../types/mcp-tool.js';
import { logger } from '../../utils/logger.js';

/**
 * Handler for the deployment help tool
 */
export async function handleDeploymentHelp(params: any): Promise<any> {
  const { topic } = params;
  
  logger.info(`Providing deployment help for topic: ${topic}`);
  
  let helpContent = '';
  
  switch (topic) {
    case 'startup_script':
      helpContent = `
# Startup Script Help

The startup script is a crucial component for backend deployments. It's responsible for starting your application inside the Lambda environment.

## Requirements:
- Must be executable in a Linux environment (chmod +x)
- Should take no parameters
- Must start your application and listen on the port specified by PORT environment variable

## Examples:

### Node.js:
\`\`\`bash
#!/bin/bash
node app.js
\`\`\`

### Python:
\`\`\`bash
#!/bin/bash
python app.py
\`\`\`

### Ruby:
\`\`\`bash
#!/bin/bash
bundle exec ruby app.rb
\`\`\`

## Automatic Generation:
If you provide the entryPoint and set generateStartupScript to true, a startup script will be automatically generated based on your runtime.
      `;
      break;
      
    case 'artifacts_path':
      helpContent = `
# Built Artifacts Path Help

The built artifacts path should point to a directory containing your application code and all its dependencies.

## Requirements:
- For backend: Must contain all application code and dependencies
- For frontend: Must contain index.html and all static assets

## Dependency Handling:
The deployment process will automatically handle dependencies for backend deployments:

- **Node.js**: Copies package.json from project root if needed and runs \`npm install --production\`
- **Python**: Copies requirements.txt and runs \`pip install -r requirements.txt -t .\`
- **Ruby**: Copies Gemfile and runs \`bundle install\`

This means you no longer need to include dependencies in your build artifacts - just provide your compiled code.
      `;
      break;
      
    case 'permissions':
      helpContent = `
# AWS Permissions Help

The deployment process requires specific AWS permissions to create and manage resources.

## Required Permissions:
- IAM: Create roles and policies
- Lambda: Create and update functions
- API Gateway: Create and manage APIs
- S3: Create buckets and upload objects
- CloudFormation: Create and update stacks
- CloudFront: Create and update distributions (for frontend)
- DynamoDB: Create and manage tables (if using database)
- CloudWatch: Create log groups and metrics

## Using AWS Profiles:
You can specify a different AWS profile by setting the AWS_PROFILE environment variable before running the deployment.
      `;
      break;
      
    case 'project_structure':
      helpContent = `
# Project Structure Help

The deployment process expects certain files and directories to be present in your project.

## Backend Project:
- Application code
- Dependencies (or dependency manifest files)
- Startup script (or entry point file)

## Frontend Project:
- index.html
- CSS, JavaScript, and other assets
- All files should be in the built assets directory

## Fullstack Project:
- Backend and frontend components as described above
- Clear separation between backend and frontend code
      `;
      break;
      
    case 'database':
      helpContent = `
# Database Configuration Help

The deployment process can create and configure DynamoDB tables for your application.

## DynamoDB Configuration:
- tableName: Name of the DynamoDB table
- attributeDefinitions: Attributes used in key schema
- keySchema: Primary key definition (HASH for partition key, RANGE for sort key)
- billingMode: PAY_PER_REQUEST (default) or PROVISIONED
- readCapacity/writeCapacity: Required if using PROVISIONED billing mode

## Example:
\`\`\`json
{
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
\`\`\`
      `;
      break;
      
    case 'general':
    default:
      helpContent = `
# General Deployment Help

The serverless-web-mcp server enables deploying web applications to AWS serverless infrastructure.

## Deployment Types:
- **Backend**: API Gateway + Lambda + DynamoDB
- **Frontend**: S3 + CloudFront
- **Fullstack**: Combined backend and frontend

## Key Features:
- Automatic dependency installation
- AWS Lambda Web Adapter for running web frameworks
- Custom domain support
- Database provisioning
- Logging and metrics

## Getting Started:
1. Prepare your application code
2. Build your application
3. Configure the deployment parameters
4. Run the deployment tool

For more specific help, try one of these topics:
- startup_script
- artifacts_path
- permissions
- project_structure
- database
      `;
      break;
  }
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          topic: topic,
          content: helpContent
        }, null, 2)
      }
    ]
  };
}

/**
 * Deployment help tool definition
 */
const deploymentHelpTool: McpTool = {
  name: 'deployment_help',
  description: 'Get help with deployment requirements and troubleshooting',
  parameters: {
    topic: z.enum(['startup_script', 'artifacts_path', 'permissions', 'project_structure', 'database', 'general']).describe('Help topic')
  },
  handler: handleDeploymentHelp
};

export default deploymentHelpTool;
