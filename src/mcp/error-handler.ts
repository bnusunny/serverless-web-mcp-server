/**
 * Error handler for MCP server
 * Provides standardized error responses with helpful suggestions
 */

// Resource suggestion map for common errors
const resourceSuggestions: Record<string, string[]> = {
  "resources:templates": ["template:list", "mcp:resources"],
  "templates": ["template:list"],
  "deployments": ["deployment:project-name", "mcp:resources"],
  "resources": ["resources:list", "mcp:resources"]
};

/**
 * Get suggestions for a resource URI
 * @param uri The resource URI that was not found
 * @returns Array of suggested alternative URIs
 */
export function getSuggestionsForResource(uri: string): string[] {
  // Check direct matches
  if (resourceSuggestions[uri]) {
    return resourceSuggestions[uri];
  }
  
  // Check partial matches
  const parts = uri.split(":");
  if (parts.length === 2) {
    const [namespace, id] = parts;
    
    // Check if we have suggestions for this namespace
    if (resourceSuggestions[namespace]) {
      return resourceSuggestions[namespace];
    }
    
    // Special case for templates
    if (id === "templates" || id === "template") {
      return ["template:list"];
    }
  }
  
  // Default suggestion
  return ["mcp:resources"];
}

/**
 * Format a helpful error message for resource not found errors
 * @param uri The resource URI that was not found
 * @returns Formatted error message with suggestions
 */
export function formatResourceNotFoundError(uri: string): string {
  const suggestions = getSuggestionsForResource(uri);
  
  let message = `Resource '${uri}' not found.`;
  
  if (suggestions.length > 0) {
    message += ` Did you mean: ${suggestions.join(", ")}?`;
    message += " Use 'mcp:resources' to see all available resources.";
  }
  
  return message;
}

/**
 * Handle MCP errors with improved messages
 * @param error The original error
 * @param context Additional context information
 * @returns Improved error message
 */
export function handleMcpError(error: Error, context?: any): Error {
  const message = error.message;
  
  // Check for resource not found errors
  if (message.includes("not found") && context?.uri) {
    return new Error(formatResourceNotFoundError(context.uri));
  }
  
  // Return original error if no improvements can be made
  return error;
}
