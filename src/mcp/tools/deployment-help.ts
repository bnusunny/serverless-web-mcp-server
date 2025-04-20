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
  
  const helpContent: Record<string, any> = {
    startup_script: {
      title: "Startup Script Requirements",
      description: "The startup script is the entry point for your application in AWS Lambda.",
      requirements: [
        "Must be executable (chmod +x)",
        "Must take no parameters",
        "Must be included in your built artifacts",
        "Must be compatible with the specified runtime"
      ],
      automaticGeneration: {
        description: "You can now automatically generate a startup script by providing:",
        steps: [
          "Specify the 'entryPoint' parameter pointing to your application's main file",
          "Set 'generateStartupScript' to true"
        ],
        example: {
          "backendConfiguration": {
            "runtime": "nodejs18.x",
            "entryPoint": "app.js",
            "generateStartupScript": true
          }
        },
        supportedRuntimes: [
          "Node.js: nodejs14.x, nodejs16.x, nodejs18.x",
          "Python: python3.7, python3.8, python3.9",
          "Java: java8, java8.al2, java11",
          ".NET: dotnet3.1, dotnet5.0, dotnet6",
          "Go: go1.x",
          "Ruby: ruby2.7"
        ]
      },
      manualCreation: {
        description: "If you prefer to create the startup script manually:",
        examples: {
          nodejs: {
            filename: "bootstrap",
            content: `#!/bin/bash
# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec node app.js`,
            buildSteps: [
              "npm run build",
              "chmod +x dist/bootstrap"
            ]
          },
          python: {
            filename: "bootstrap",
            content: `#!/bin/bash
# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec python app.py`,
            buildSteps: [
              "pip install -r requirements.txt -t ./package",
              "cp bootstrap ./package/",
              "chmod +x package/bootstrap"
            ]
          }
        }
      },
      troubleshooting: [
        "If you get 'Entry point file not found' error, check that your entry point file exists in the built artifacts directory",
        "If you get 'Startup script not found' error, check the path to your script",
        "If you get 'Startup script is not executable' error, run 'chmod +x' on your script",
        "If your application crashes, check the CloudWatch logs for details"
      ]
    },
    artifacts_path: {
      title: "Built Artifacts Requirements",
      description: "The built artifacts path should contain all the files needed to run your application.",
      requirements: [
        "Must include all dependencies",
        "Must be built for the target runtime",
        "Must include the startup script",
        "Must be ready for execution without additional build steps"
      ],
      examples: {
        nodejs: {
          buildCommands: [
            "npm install",
            "npm run build"
          ],
          typicalPath: "./dist",
          packageJson: {
            "scripts": {
              "build": "tsc && cp package.json dist/ && cd dist && npm install --production"
            }
          }
        },
        python: {
          buildCommands: [
            "pip install -r requirements.txt -t ./package",
            "cp *.py ./package/"
          ],
          typicalPath: "./package"
        }
      },
      troubleshooting: [
        "If deployment fails with missing dependencies, ensure all dependencies are included in your artifacts",
        "If you're using TypeScript, ensure your code is compiled to JavaScript",
        "Check that your build process copies all necessary files to the artifacts directory"
      ]
    },
    permissions: {
      title: "File Permissions Requirements",
      description: "AWS Lambda requires specific file permissions for your application.",
      requirements: [
        "Startup script must have executable permissions (chmod +x)",
        "All files should be readable",
        "Directory permissions should allow Lambda to access your files"
      ],
      commands: {
        "Make file executable": "chmod +x filename",
        "Check file permissions": "ls -la filename",
        "Set correct permissions recursively": "find . -type f -exec chmod 644 {} \\; && find . -type d -exec chmod 755 {} \\;"
      },
      troubleshooting: [
        "If you get 'permission denied' errors, check the file permissions",
        "If your script won't execute, ensure it has the correct shebang line (e.g., #!/usr/bin/env node)",
        "Remember that permissions set on your local machine will be preserved when deployed to Lambda"
      ]
    },
    database: {
      title: "Database Configuration",
      description: "The deploy tool can create and configure database resources like DynamoDB tables as part of your deployment.",
      capabilities: [
        "Create new DynamoDB tables with specified schema",
        "Configure table capacity (on-demand or provisioned)",
        "Set up primary keys and attribute definitions",
        "Integrate the database with your application"
      ],
      dynamodbExample: {
        description: "Example DynamoDB configuration in the deploy tool:",
        config: {
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
        },
        notes: [
          "The tableName is required and must be unique within your AWS account in the specified region",
          "attributeDefinitions define the data types for your attributes (S=String, N=Number, B=Binary)",
          "keySchema defines your primary key (HASH) and sort key (RANGE) if applicable",
          "billingMode can be PAY_PER_REQUEST (default) or PROVISIONED (requires readCapacity and writeCapacity)"
        ]
      },
      bestPractices: [
        "Use descriptive table names that reflect your application's domain",
        "Design your key schema carefully to support your access patterns",
        "Start with on-demand capacity (PAY_PER_REQUEST) for unpredictable workloads",
        "Use environment variables to pass database names to your application"
      ],
      environmentVariables: {
        description: "The deploy tool automatically sets these environment variables for your Lambda function:",
        variables: {
          "TABLE_NAME": "The name of your DynamoDB table",
          "AWS_REGION": "The AWS region where your resources are deployed"
        }
      }
    },
    project_structure: {
      title: "Project Structure Requirements",
      description: "The deployment tool expects a specific project structure.",
      backendStructure: {
        description: "Backend projects should have:",
        structure: [
          "Source code files",
          "Built artifacts directory (e.g., dist, build, package)",
          "Executable startup script in the artifacts directory",
          "All dependencies included in the artifacts directory"
        ],
        example: {
          "project/": {
            "src/": "Source code files",
            "dist/": {
              "app.js": "Executable startup script",
              "index.js": "Application code",
              "node_modules/": "Dependencies"
            },
            "package.json": "Project configuration"
          }
        }
      },
      frontendStructure: {
        description: "Frontend projects should have:",
        structure: [
          "Built static assets directory (e.g., build, dist, public)",
          "index.html in the root of the assets directory",
          "All CSS, JS, and other assets included"
        ],
        example: {
          "project/": {
            "src/": "Source code files",
            "build/": {
              "index.html": "Main HTML file",
              "static/": {
                "css/": "Stylesheets",
                "js/": "JavaScript files",
                "media/": "Images and other media"
              }
            },
            "package.json": "Project configuration"
          }
        }
      },
      fullstackStructure: {
        description: "Fullstack projects should have separate backend and frontend directories, each following their respective structure requirements."
      }
    },
    general: {
      title: "General Deployment Information",
      description: "Overview of the deployment process and requirements.",
      deploymentTypes: {
        backend: "Deploys a backend service using API Gateway and Lambda",
        frontend: "Deploys a frontend application using S3 and CloudFront",
        fullstack: "Deploys both backend and frontend components"
      },
      generalSteps: [
        "Build your application",
        "Ensure your startup script is executable (for backend)",
        "Configure the deployment parameters",
        "Run the deployment tool",
        "Wait for the deployment to complete",
        "Access your deployed application using the provided URL"
      ],
      awsResources: {
        description: "The deploy tool creates and configures these AWS resources:",
        backend: [
          "AWS Lambda function with your application code",
          "API Gateway REST API or HTTP API",
          "IAM roles and policies for Lambda execution",
          "CloudWatch Log groups for monitoring",
          "DynamoDB tables (if database configuration is provided)"
        ],
        frontend: [
          "S3 bucket configured for static website hosting",
          "CloudFront distribution for content delivery (optional)",
          "Route 53 records for custom domains (if configured)"
        ]
      },
      bestPractices: [
        "Use a consistent project structure",
        "Include all dependencies in your built artifacts",
        "Test your application locally before deploying",
        "Use environment variables for configuration",
        "Monitor your application using CloudWatch logs and metrics"
      ],
      commonIssues: [
        "Missing dependencies in built artifacts",
        "Non-executable startup script",
        "Incorrect paths in deployment configuration",
        "Incompatible runtime versions",
        "Missing permissions for AWS resources"
      ]
    }
  };
  
  if (!helpContent[params.topic]) {
    return {
      error: `Help topic '${params.topic}' not found`,
      availableTopics: Object.keys(helpContent)
    };
  }
  
  return {
    topic: params.topic,
    content: helpContent[params.topic]
  };
}
