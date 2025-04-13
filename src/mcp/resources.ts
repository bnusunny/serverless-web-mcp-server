import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDeploymentStatus } from "../deployment/status.js";
import { getTemplateInfo } from "../deployment/templates.js";
import { getResourceInventory } from "../aws/resources.js";

/**
 * Register all deployment resources with the MCP server
 */
export function registerDeploymentResources(server: McpServer) {
  // Register deployment status resource
  // Using resource method with pattern matching
  server.resource(
    "deployment",
    "deployment:*",
    async (uri: any) => {
      // Extract project name from URI (format: "deployment:project-name")
      const uriStr = uri.toString();
      const projectName = uriStr.split(":")[1];
      
      if (!projectName) {
        throw new Error("Invalid deployment URI format. Expected: deployment:project-name");
      }
      
      try {
        const deploymentStatus = await getDeploymentStatus(projectName);
        
        return {
          contents: [
            {
              text: JSON.stringify(deploymentStatus, null, 2),
              uri: uriStr,
              mimeType: "application/json"
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to retrieve deployment status: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Register template information resource
  server.resource(
    "template",
    "template:*",
    async (uri: any) => {
      // Extract template name from URI (format: "template:template-name" or "template:list")
      const uriStr = uri.toString();
      const templateName = uriStr.split(":")[1];
      
      try {
        if (templateName === "list") {
          // List all available templates
          const templates = await getTemplateInfo();
          
          return {
            contents: [
              {
                text: JSON.stringify(templates, null, 2),
                uri: uriStr,
                mimeType: "application/json"
              }
            ]
          };
        } else {
          // Get specific template information
          const templateInfo = await getTemplateInfo(templateName);
          
          return {
            contents: [
              {
                text: JSON.stringify(templateInfo, null, 2),
                uri: uriStr,
                mimeType: "application/json"
              }
            ]
          };
        }
      } catch (error) {
        throw new Error(`Failed to retrieve template information: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Register AWS resource inventory resource
  server.resource(
    "resources",
    "resources:*",
    async (uri: any) => {
      // Extract project name from URI (format: "resources:project-name" or "resources:list")
      const uriStr = uri.toString();
      const projectName = uriStr.split(":")[1];
      
      try {
        if (projectName === "list") {
          // List all resources across projects
          const resources = await getResourceInventory();
          
          return {
            contents: [
              {
                text: JSON.stringify(resources, null, 2),
                uri: uriStr,
                mimeType: "application/json"
              }
            ]
          };
        } else {
          // Get resources for specific project
          const resources = await getResourceInventory(projectName);
          
          return {
            contents: [
              {
                text: JSON.stringify(resources, null, 2),
                uri: uriStr,
                mimeType: "application/json"
              }
            ]
          };
        }
      } catch (error) {
        throw new Error(`Failed to retrieve resource inventory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}
