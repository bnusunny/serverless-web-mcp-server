/**
 * MCP Resources Index
 * 
 * Exports all resource implementations and utility functions for working with resources.
 */

// Export individual resources
export { default as templateList } from './template-list.js';
export { default as templateDetails } from './template-details.js';
export { default as deploymentDetails } from './deployment-details.js';
export { default as deploymentList } from './deloyment-list.js';

// Import all resources
import templateList from './template-list.js';
import templateDetails from './template-details.js';
import deploymentDetails from './deployment-details.js';
import deploymentList from './deloyment-list.js';

/**
 * Resource interface defining the structure of an MCP resource
 */
export interface McpResource {
  name: string;
  uri: string;
  description: string;
  handler: (uri: URL, variables?: any) => Promise<any>;
}

// Create array of all resources
const resources = [
  templateList,
  templateDetails,
  deploymentList,
  deploymentDetails,
];

/**
 * Get resource descriptions for documentation
 * 
 * @returns - Array of resource descriptions
 */
export function getResourceDescriptions(): Array<{pattern: string, description: string, examples: string[]}> {
  return resources.map((resource: McpResource) => {
    // Convert URI patterns to documentation format
    let pattern = resource.uri;
    let examples: string[] = [resource.uri];
    
    // Handle parameterized resources
    if (resource.name === 'template-details') {
      pattern = 'template:{name}';
      examples = ['template:backend', 'template:frontend', 'template:fullstack'];
    } else if (resource.name === 'deployment-details') {
      pattern = 'deployment:{projectName}';
      examples = ['deployment:my-api', 'deployment:my-website'];
    }
    
    return {
      pattern,
      description: resource.description,
      examples
    };
  });
}

export default resources;
