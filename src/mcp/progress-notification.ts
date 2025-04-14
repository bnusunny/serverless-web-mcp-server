/**
 * Implementation of direct progress notifications for MCP server
 * 
 * This module provides a way to send progress notifications to MCP clients
 * during long-running operations like deployments, following the MCP protocol.
 */

/**
 * Progress notification content
 */
export interface ProgressContent {
  content: {
    type: "text";
    text: string;
  }[];
  percentComplete: number;
  status?: "error" | "success";
}

/**
 * Create a deployment progress tracker that sends notifications to the client
 * 
 * @param server The MCP server instance
 * @param projectName The name of the project being deployed
 * @returns A function to send progress updates
 */
export function createProgressTracker(server: any, projectName: string) {
  // Create a unique ID for this deployment
  const deploymentId = `${projectName}-${Date.now()}`;
  
  // Return a function that can be used to send progress updates
  return function sendProgress(progress: ProgressContent): void {
    try {
      // Use the server's underlying notification mechanism
      server.server.notification({
        method: "notifications/progress",
        params: {
          progressToken: deploymentId,
          progress: progress.percentComplete,
          total: 100,
          message: JSON.stringify({
            type: "deployment-progress",
            projectName,
            content: progress.content,
            status: progress.status || "info"
          })
        }
      }).catch((err: Error) => {
        console.error(`Failed to send progress notification: ${err}`);
      });
    } catch (error) {
      console.error(`Error sending progress notification: ${error}`);
    }
  };
}
