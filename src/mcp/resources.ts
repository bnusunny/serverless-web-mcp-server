import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDeploymentStatus } from "../deployment/status.js";
import { getTemplateInfo } from "../deployment/templates.js";
import { getResourceInventory } from "../aws/resources.js";

/**
 * Resource registry to keep track of all available resources
 */
const resourceRegistry = {
  // Core resource categories
  "deployment": {
    description: "Information about deployed applications",
    patterns: ["deployment:*"],
    examples: ["deployment:my-api"]
  },
  "template": {
    description: "Information about available deployment templates",
    patterns: ["template:list", "template:*"],
    examples: ["template:list", "template:express-backend"]
  },
  "resources": {
    description: "Information about AWS resources for deployed applications",
    patterns: ["resources:list", "resources:*", "resources:templates"],
    examples: ["resources:list", "resources:my-api", "resources:templates"]
  },
  // Discovery resource
  "mcp": {
    description: "MCP server information and resource discovery",
    patterns: ["mcp:resources"],
    examples: ["mcp:resources"]
  }
};

/**
 * Register all deployment resources with the MCP server
 */
export function registerDeploymentResources(server: McpServer) {
  // Register resource discovery endpoint
  server.resource(
    "mcp",
    "mcp:resources",
    async () => {
      return {
        contents: [
          {
            text: JSON.stringify(resourceRegistry, null, 2),
            uri: "mcp:resources",
            mimeType: "application/json"
          }
        ]
      };
    }
  );

  // Register deployment status resource
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
        } else if (projectName === "templates") {
          // Special case for resources:templates (compatibility with some clients)
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
        const errorMessage = `Failed to retrieve resource inventory: ${error instanceof Error ? error.message : String(error)}`;
        
        // Provide helpful error message with suggestions
        if (uriStr === "resources:templates") {
          throw new Error(`${errorMessage}. Did you mean 'template:list' to get all templates?`);
        } else {
          throw new Error(errorMessage);
        }
      }
    }
  );
}
