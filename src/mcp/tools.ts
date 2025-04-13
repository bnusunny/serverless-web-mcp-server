import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deployApplication } from "../deployment/deploy.js";
import { configureDomain } from "../deployment/domain.js";
import { provisionDatabase } from "../deployment/database.js";
import { getLogs } from "../aws/logs.js";
import { getMetrics } from "../aws/metrics.js";

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
    async (params) => {
      try {
        // Deploy the application with status updates
        const result = await deployApplication(params, (status) => {
          // In a real implementation with streaming support, we would stream status updates here
          console.log(status);
        });
        
        // Final success message with complete result
        return {
          content: [
            {
              type: "text",
              text: `Successfully deployed ${params.deploymentType} application: ${params.configuration.projectName}\n\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Deployment failed: ${error instanceof Error ? error.message : String(error)}`
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
    async (params) => {
      try {
        const result = await configureDomain(params, (status) => {
          // In a real implementation with streaming support, we would stream status updates here
          console.log(status);
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully configured domain ${params.domainName} for project ${params.projectName}\n\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
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
    async (params) => {
      try {
        const result = await provisionDatabase(params, (status) => {
          // In a real implementation with streaming support, we would stream status updates here
          console.log(status);
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully provisioned ${params.databaseType} for project ${params.projectName}\n\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
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
    async (params) => {
      try {
        const logs = await getLogs(params, (status) => {
          // In a real implementation with streaming support, we would stream status updates here
          console.log(status);
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Logs for ${params.resourceType} in project ${params.projectName}:\n\n${logs}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
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
    async (params) => {
      try {
        const metrics = await getMetrics(params, (status) => {
          // In a real implementation with streaming support, we would stream status updates here
          console.log(status);
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Metrics for ${params.resourceType} in project ${params.projectName}:\n\n${metrics}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve metrics: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}
