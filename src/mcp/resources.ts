import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTemplateInfo, listTemplates } from "../deployment/templates.js";
import { getDeploymentStatus, listDeployments } from "../deployment/status.js";

/**
 * Register all deployment resources with the MCP server
 */
export function registerDeploymentResources(server: McpServer) {
  // Register the mcp:resources resource for resource discovery
  server.resource(
    "mcp:resources",
    "List all available resources",
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
    "template:list",
    "List all available deployment templates",
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
    "template:{name}",
    "Get information about a specific template",
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
    "deployment:{project-name}",
    "Get information about a specific deployment",
    async (params: any) => {
      const projectName = params["project-name"];
      try {
        const deployment = await getDeploymentStatus(projectName);
        
        if (deployment.status === 'not_found') {
          throw new Error(`Deployment not found: ${projectName}`);
        }
        
        return {
          contents: [
            {
              text: JSON.stringify({ deployment }, null, 2),
              uri: `deployment:${projectName}`,
              mimeType: "application/json"
            }
          ]
        };
      } catch (error) {
        throw new Error(`Deployment not found: ${projectName}`);
      }
    }
  );

  // Register the deployment:list resource
  server.resource(
    "deployment:list",
    "List all deployments",
    async () => {
      const deployments = await listDeployments();
      return {
        contents: [
          {
            text: JSON.stringify({ deployments }, null, 2),
            uri: "deployment:list",
            mimeType: "application/json"
          }
        ]
      };
    }
  );
}
