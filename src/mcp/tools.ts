import { McpServer, ProgressNotification } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deployApplication } from "../deployment/deploy.js";
import { configureDomain } from "../deployment/domain.js";
import { provisionDatabase } from "../deployment/database.js";
import { getLogs } from "../aws/logs.js";
import { getMetrics } from "../aws/metrics.js";
import { storeDeploymentResult, storeDeploymentError } from "../deployment/status.js";

/**
 * Register all deployment tools with the MCP server
 */
export function registerDeploymentTools(server: McpServer) {
  // Deploy tool - unified deployment for backend, frontend, and fullstack applications
  server.tool(
    "deploy",
    "Deploy web applications to AWS serverless infrastructure",
    {
      deploymentType: z.enum(["backend", "frontend", "fullstack"])
        .describe("Type of deployment: 'backend' for API services, 'frontend' for web UI, 'fullstack' for both"),
      
      source: z.object({
        path: z.string().optional()
          .describe("Local path to the source code"),
        content: z.string().optional()
          .describe("Source code content if not providing a path")
      }).describe("Source code for the application"),
      
      framework: z.string()
        .describe("Web framework being used (e.g., 'express', 'react', 'nextjs')"),
      
      configuration: z.object({
        projectName: z.string()
          .describe("Name of the project"),
        
        region: z.string().default("us-east-1")
          .describe("AWS region for deployment"),
        
        tags: z.record(z.string()).optional()
          .describe("Tags to apply to AWS resources"),
        
        backendConfiguration: z.object({
          runtime: z.string()
            .describe("Lambda runtime (e.g., 'nodejs18.x')"),
          memorySize: z.number().default(512)
            .describe("Lambda memory size in MB"),
          timeout: z.number().default(30)
            .describe("Lambda timeout in seconds"),
          environment: z.record(z.string()).optional()
            .describe("Environment variables for Lambda function")
        }).optional()
          .describe("Configuration for backend API deployments"),
        
        frontendConfiguration: z.object({
          indexDocument: z.string().default("index.html")
            .describe("Index document for S3 website"),
          errorDocument: z.string().default("index.html")
            .describe("Error document for S3 website"),
          spa: z.boolean().default(false)
            .describe("Whether this is a Single Page Application")
        }).optional()
          .describe("Configuration for frontend website deployments"),
        
        domain: z.object({
          name: z.string()
            .describe("Custom domain name"),
          createRoute53Records: z.boolean().default(true)
            .describe("Whether to create Route 53 records")
        }).optional()
          .describe("Custom domain configuration")
      }).describe("Deployment configuration parameters")
    },
    async (params, progress) => {
      try {
        // For Roo Code compatibility, return immediately with a success message
        // and continue the deployment in the background
        console.log(`Starting deployment of ${params.deploymentType} application: ${params.configuration.projectName}...`);
        
        // Initialize deployment status immediately so it can be queried
        const { initializeDeploymentStatus } = await import("../deployment/status.js");
        initializeDeploymentStatus(
          params.configuration.projectName, 
          params.deploymentType, 
          params.framework
        );
        
        // Send initial progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Initiating deployment of ${params.deploymentType} application '${params.configuration.projectName}'...`
            }
          ],
          percentComplete: 5
        });
        
        // Start the deployment process in the background
        setTimeout(() => {
          deployApplication(params, (status) => {
            console.log(status);
            
            // Send progress notifications for each status update
            // Estimate progress percentage based on deployment phases
            let percentComplete = 10; // Start at 10% after initialization
            
            if (status.includes("Preparing deployment files")) {
              percentComplete = 20;
            } else if (status.includes("Starting AWS SAM deployment")) {
              percentComplete = 30;
            } else if (status.includes("Building application")) {
              percentComplete = 40;
            } else if (status.includes("Deploying application")) {
              percentComplete = 60;
            } else if (status.includes("Retrieving deployment outputs")) {
              percentComplete = 80;
            } else if (status.includes("Uploading frontend assets")) {
              percentComplete = 90;
            } else if (status.includes("completed successfully")) {
              percentComplete = 95;
            }
            
            // Send progress notification
            progress.update({
              content: [
                {
                  type: "text",
                  text: status
                }
              ],
              percentComplete
            });
          }).then(result => {
            console.log(`Deployment completed successfully: ${JSON.stringify(result, null, 2)}`);
            storeDeploymentResult(params.configuration.projectName, result);
            
            // Send final progress notification
            progress.update({
              content: [
                {
                  type: "text",
                  text: `Deployment of ${params.deploymentType} application '${params.configuration.projectName}' completed successfully!`
                }
              ],
              percentComplete: 100
            });
          }).catch(error => {
            console.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
            storeDeploymentError(params.configuration.projectName, error);
            
            // Send error progress notification
            progress.update({
              content: [
                {
                  type: "text",
                  text: `Deployment failed: ${error instanceof Error ? error.message : String(error)}`
                }
              ],
              percentComplete: 100,
              status: "error"
            });
          });
        }, 100);
        
        // Return immediate response to prevent timeout
        return {
          content: [
            {
              type: "text" as const,
              text: `Deployment of ${params.deploymentType} application '${params.configuration.projectName}' has been initiated.\n\nYou will receive progress updates as the deployment proceeds.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to initiate deployment: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Configure domain tool
  server.tool(
    "configure-domain",
    "Set up custom domains and SSL certificates for deployed applications",
    {
      projectName: z.string()
        .describe("Name of the deployed project"),
      
      domainName: z.string()
        .describe("Custom domain name to configure"),
      
      createCertificate: z.boolean().default(true)
        .describe("Whether to create a new ACM certificate"),
      
      createRoute53Records: z.boolean().default(true)
        .describe("Whether to create Route 53 records")
    },
    async (params, progress) => {
      try {
        // Send initial progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Configuring domain ${params.domainName} for project ${params.projectName}...`
            }
          ],
          percentComplete: 10
        });
        
        const result = await configureDomain(params, (status) => {
          console.log(status);
          
          // Estimate progress percentage based on domain configuration phases
          let percentComplete = 20; // Start at 20% after initialization
          
          if (status.includes("Creating certificate")) {
            percentComplete = 30;
          } else if (status.includes("Waiting for certificate validation")) {
            percentComplete = 50;
          } else if (status.includes("Configuring CloudFront")) {
            percentComplete = 70;
          } else if (status.includes("Creating DNS records")) {
            percentComplete = 90;
          }
          
          // Send progress notification
          progress.update({
            content: [
              {
                type: "text",
                text: status
              }
            ],
            percentComplete
          });
        });
        
        // Send final progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Domain ${params.domainName} successfully configured for project ${params.projectName}`
            }
          ],
          percentComplete: 100
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully configured domain ${params.domainName} for project ${params.projectName}\n\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        // Send error progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Domain configuration failed: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          percentComplete: 100,
          status: "error"
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Domain configuration failed: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Provision database tool
  server.tool(
    "provision-database",
    "Create and configure database resources for applications",
    {
      projectName: z.string()
        .describe("Name of the project to associate the database with"),
      
      databaseType: z.enum(["dynamodb", "aurora-serverless"])
        .describe("Type of database to provision"),
      
      configuration: z.object({
        tableName: z.string().optional()
          .describe("DynamoDB table name (for DynamoDB)"),
        
        primaryKey: z.string().optional()
          .describe("Primary key name (for DynamoDB)"),
        
        sortKey: z.string().optional()
          .describe("Sort key name (for DynamoDB)"),
        
        dbName: z.string().optional()
          .describe("Database name (for Aurora Serverless)"),
        
        engine: z.enum(["mysql", "postgresql"]).optional()
          .describe("Database engine (for Aurora Serverless)"),
        
        capacity: z.number().optional()
          .describe("Database capacity units (for Aurora Serverless)")
      }).describe("Database configuration parameters")
    },
    async (params, progress) => {
      try {
        // Send initial progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Provisioning ${params.databaseType} database for project ${params.projectName}...`
            }
          ],
          percentComplete: 10
        });
        
        const result = await provisionDatabase(params, (status) => {
          console.log(status);
          
          // Estimate progress percentage based on database provisioning phases
          let percentComplete = 20; // Start at 20% after initialization
          
          if (status.includes("Creating CloudFormation stack")) {
            percentComplete = 30;
          } else if (status.includes("Waiting for resources")) {
            percentComplete = 50;
          } else if (status.includes("Configuring database")) {
            percentComplete = 70;
          } else if (status.includes("Setting up permissions")) {
            percentComplete = 90;
          }
          
          // Send progress notification
          progress.update({
            content: [
              {
                type: "text",
                text: status
              }
            ],
            percentComplete
          });
        });
        
        // Send final progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `${params.databaseType} database successfully provisioned for project ${params.projectName}`
            }
          ],
          percentComplete: 100
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully provisioned ${params.databaseType} for project ${params.projectName}\n\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        // Send error progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Database provisioning failed: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          percentComplete: 100,
          status: "error"
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Database provisioning failed: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Get logs tool
  server.tool(
    "get-logs",
    "Retrieve application logs from CloudWatch",
    {
      projectName: z.string()
        .describe("Name of the deployed project"),
      
      resourceType: z.enum(["lambda", "api-gateway", "cloudfront"])
        .describe("Type of resource to get logs for"),
      
      startTime: z.string().optional()
        .describe("Start time for logs (ISO format)"),
      
      endTime: z.string().optional()
        .describe("End time for logs (ISO format)"),
      
      limit: z.number().default(100)
        .describe("Maximum number of log entries to retrieve")
    },
    async (params, progress) => {
      try {
        // Send initial progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Retrieving ${params.resourceType} logs for project ${params.projectName}...`
            }
          ],
          percentComplete: 10
        });
        
        // For log retrieval, we'll send progress updates at key points
        progress.update({
          content: [
            {
              type: "text",
              text: `Identifying log groups for ${params.resourceType}...`
            }
          ],
          percentComplete: 30
        });
        
        const logs = await getLogs(params, (status) => {
          console.log(status);
          
          // Send progress notification
          progress.update({
            content: [
              {
                type: "text",
                text: status
              }
            ],
            percentComplete: 60
          });
        });
        
        // Send final progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Successfully retrieved logs for ${params.resourceType} in project ${params.projectName}`
            }
          ],
          percentComplete: 100
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Logs for ${params.resourceType} in project ${params.projectName}:\n\n${logs}`
            }
          ]
        };
      } catch (error) {
        // Send error progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Failed to retrieve logs: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          percentComplete: 100,
          status: "error"
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to retrieve logs: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Get metrics tool
  server.tool(
    "get-metrics",
    "Fetch performance metrics for deployed applications",
    {
      projectName: z.string()
        .describe("Name of the deployed project"),
      
      resourceType: z.enum(["lambda", "api-gateway", "cloudfront", "s3"])
        .describe("Type of resource to get metrics for"),
      
      metricName: z.string()
        .describe("Name of the metric to retrieve"),
      
      startTime: z.string().optional()
        .describe("Start time for metrics (ISO format)"),
      
      endTime: z.string().optional()
        .describe("End time for metrics (ISO format)"),
      
      period: z.number().default(60)
        .describe("Period in seconds")
    },
    async (params, progress) => {
      try {
        // Send initial progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Retrieving ${params.metricName} metrics for ${params.resourceType} in project ${params.projectName}...`
            }
          ],
          percentComplete: 10
        });
        
        // For metrics retrieval, we'll send progress updates at key points
        progress.update({
          content: [
            {
              type: "text",
              text: `Identifying resources for ${params.resourceType}...`
            }
          ],
          percentComplete: 30
        });
        
        progress.update({
          content: [
            {
              type: "text",
              text: `Querying CloudWatch metrics...`
            }
          ],
          percentComplete: 60
        });
        
        const metrics = await getMetrics(params, (status) => {
          console.log(status);
          
          // Send progress notification
          progress.update({
            content: [
              {
                type: "text",
                text: status
              }
            ],
            percentComplete: 80
          });
        });
        
        // Send final progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Successfully retrieved metrics for ${params.resourceType} in project ${params.projectName}`
            }
          ],
          percentComplete: 100
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Metrics for ${params.resourceType} in project ${params.projectName}:\n\n${metrics}`
            }
          ]
        };
      } catch (error) {
        // Send error progress notification
        progress.update({
          content: [
            {
              type: "text",
              text: `Failed to retrieve metrics: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          percentComplete: 100,
          status: "error"
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to retrieve metrics: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}
