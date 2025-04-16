/**
 * MCP Resources Index
 * 
 * Exports all resource implementations and utility functions for working with resources.
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

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
  uri: string | ResourceTemplate;
  description: string;
  handler: (uri: URL, variables?: any, extra?: any) => Promise<any>;
}

// Create array of all resources
const resources = [
  templateList,
  templateDetails,
  deploymentList,
  deploymentDetails,
];

export default resources;
