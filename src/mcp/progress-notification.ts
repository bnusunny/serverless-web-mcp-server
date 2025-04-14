/**
 * Implementation of hybrid progress notifications for MCP server
 * 
 * This module provides a way to send progress notifications to MCP clients
 * during long-running operations like deployments.
 * 
 * It supports both standard MCP progress notifications (for clients that include progressToken)
 * and falls back to the original async deployment + resource polling approach for other clients.
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
 * Check if the client supports progress notifications
 * by looking for a progressToken in the request
 * 
 * @param extra The request handler extra data containing client request info
 * @returns True if the client supports progress notifications
 */
export function clientSupportsProgress(extra: any): boolean {
  try {
    // Check if the request has _meta.progressToken
    return !!(extra && 
             extra.request && 
             extra.request.params && 
             extra.request.params._meta && 
             extra.request.params._meta.progressToken);
  } catch (error) {
    // If any error occurs during checking, assume no progress support
    console.log("Error checking for progress token support:", error);
    return false;
  }
}

/**
 * Get the progress token from the request if available
 * 
 * @param extra The request handler extra data containing client request info
 * @returns The progress token or undefined if not found
 */
export function getProgressToken(extra: any): string | undefined {
  try {
    if (clientSupportsProgress(extra)) {
      return extra.request.params._meta.progressToken;
    }
    return undefined;
  } catch (error) {
    console.log("Error getting progress token:", error);
    return undefined;
  }
}

/**
 * Create a deployment progress tracker that sends notifications to the client
 * 
 * @param server The MCP server instance
 * @param projectName The name of the project being deployed
 * @param progressToken Optional progress token from the client request
 * @returns A function to send progress updates
 */
export function createProgressTracker(server: any, projectName: string, progressToken?: string) {
  // Use the provided progress token or create a unique ID for this deployment
  const token = progressToken || `${projectName}-${Date.now()}`;
  const supportsProgress = !!progressToken;
  
  // Return a function that can be used to send progress updates
  return function sendProgress(progress: ProgressContent): void {
    try {
      if (supportsProgress) {
        // Use standard MCP progress notification for clients that support it
        server.server.notification({
          method: "notifications/progress",
          params: {
            progressToken: token,
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
      } else {
        // For clients that don't support progress notifications,
        // just log the progress (we'll use resource polling instead)
        console.log(`[${projectName}] Progress (${progress.percentComplete}%): ${progress.content[0]?.text || ''}`);
      }
    } catch (error) {
      console.error(`Error sending progress notification: ${error}`);
    }
  };
}
