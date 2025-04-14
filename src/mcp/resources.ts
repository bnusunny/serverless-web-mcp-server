import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTemplateInfo, listTemplates } from "../deployment/templates.js";
import { getDeploymentStatus, listDeployments } from "../deployment/status.js";
import fs from 'fs';
import path from 'path';
import os from 'os';

// Define the directory where deployment status files will be stored
const DEPLOYMENT_STATUS_DIR = path.join(os.tmpdir(), 'serverless-web-mcp-deployments');

// Ensure the directory exists
if (!fs.existsSync(DEPLOYMENT_STATUS_DIR)) {
  fs.mkdirSync(DEPLOYMENT_STATUS_DIR, { recursive: true });
}

/**
 * Register all deployment resources with the MCP server
 */
export function registerDeploymentResources(server: McpServer) {
  // Register the mcp:resources resource for resource discovery
  server.resource(
    "resource-discovery", // Descriptive name with kebab-case
    "mcp:resources", // URI pattern
    async () => {
      return {
        contents: [
          {
            text: JSON.stringify({
              resources: [
                {
                  pattern: "mcp:resources",
                  description: "List all available resources",
                  example: "mcp:resources"
                },
                {
                  pattern: "template:list",
                  description: "List all available deployment templates",
                  example: "template:list"
                },
                {
                  pattern: "template:{name}",
                  description: "Get information about a specific template",
                  example: "template:express-backend"
                },
                {
                  pattern: "deployment:{project-name}",
                  description: "Get information about a specific deployment",
                  example: "deployment:my-api"
                },
                {
                  pattern: "deployment:list",
                  description: "List all deployments",
                  example: "deployment:list"
                }
              ]
            }, null, 2),
            uri: "mcp:resources",
            mimeType: "application/json"
          }
        ]
      };
    }
  );

  // Register the template:list resource
  server.resource(
    "template-list", // Descriptive name with kebab-case
    "template:list", // URI pattern
    async () => {
      const templates = await listTemplates();
      return {
        contents: [
          {
            text: JSON.stringify({ templates }, null, 2),
            uri: "template:list",
            mimeType: "application/json"
          }
        ]
      };
    }
  );

  // Register the template:{name} resource
  server.resource(
    "template-details", // Descriptive name with kebab-case
    "template:{name}", // URI pattern
    async (params: any) => {
      const templateName = params.name;
      try {
        const template = await getTemplateInfo(templateName);
        return {
          contents: [
            {
              text: JSON.stringify({ template }, null, 2),
              uri: `template:${templateName}`,
              mimeType: "application/json"
            }
          ]
        };
      } catch (error) {
        throw new Error(`Template not found: ${templateName}`);
      }
    }
  );

  // Register the deployment:{project-name} resource
  server.resource(
    "deployment-status", // Descriptive name with kebab-case
    "deployment:{project-name}", // URI pattern
    async (params: any) => {
      const projectName = params["project-name"];
      try {
        // First check if the deployment files exist
        const statusFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}.json`);
        const progressFile = path.join(DEPLOYMENT_STATUS_DIR, `${projectName}-progress.log`);
        
        console.log(`Checking for deployment files: ${statusFile}, ${progressFile}`);
        console.log(`Status file exists: ${fs.existsSync(statusFile)}`);
        console.log(`Progress file exists: ${fs.existsSync(progressFile)}`);
        
        // Get deployment status - this now returns immediately with current status
        const deployment = await getDeploymentStatus(projectName);
        
        if (deployment.status === 'not_found') {
          console.log(`Deployment not found: ${projectName}`);
          throw new Error(`Deployment not found: ${projectName}`);
        }
        
        // Check if this is a CloudFront deployment (which takes a long time)
        let hasCloudfrontDistribution = false;
        if (deployment.resources && Array.isArray(deployment.resources)) {
          hasCloudfrontDistribution = deployment.resources.some((r: any) => 
            r.resourceType === 'AWS::CloudFront::Distribution'
          );
        }
        
        // Return the deployment status immediately
        return {
          contents: [
            {
              text: JSON.stringify({ 
                deployment,
                // Add a note for long-running deployments
                note: deployment.status === 'in_progress' && hasCloudfrontDistribution
                  ? "CloudFront distributions typically take 15-20 minutes to deploy. You can continue to poll this resource for updates."
                  : undefined
              }, null, 2),
              uri: `deployment:${projectName}`,
              mimeType: "application/json"
            }
          ]
        };
      } catch (error) {
        console.error(`Error retrieving deployment status for ${projectName}:`, error);
        throw new Error(`Deployment not found: ${projectName}`);
      }
    }
  );

  // Register the deployment:list resource
  server.resource(
    "deployment-list", // Descriptive name with kebab-case
    "deployment:list", // URI pattern
    async () => {
      try {
        console.log(`Listing deployments from ${DEPLOYMENT_STATUS_DIR}`);
        const files = fs.readdirSync(DEPLOYMENT_STATUS_DIR);
        console.log(`Found files: ${files.join(', ')}`);
        
        const deployments = await listDeployments();
        console.log(`Found deployments: ${deployments.length}`);
        
        return {
          contents: [
            {
              text: JSON.stringify({ deployments }, null, 2),
              uri: "deployment:list",
              mimeType: "application/json"
            }
          ]
        };
      } catch (error) {
        console.error(`Error listing deployments:`, error);
        throw new Error(`Failed to list deployments: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}
