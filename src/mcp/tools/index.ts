/**
 * MCP Tools Index
 * 
 * Exports all tool implementations and utility functions for working with tools.
 */

// Export individual tools
export { default as deployTool } from './deploy.js';
export { default as configureDomainTool } from './configure-domain.js';
export { default as provisionDatabaseTool } from './provision-database.js';
export { default as getLogsTool } from './get-logs.js';
export { default as getMetricsTool } from './get-metrics.js';

// Import all tools
import deployTool from './deploy.js';
import configureDomainTool from './configure-domain.js';
import provisionDatabaseTool from './provision-database.js';
import getLogsTool from './get-logs.js';
import getMetricsTool from './get-metrics.js';

/**
 * Tool interface defining the structure of an MCP tool
 */
export interface McpTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<any>;
}

// Create array of all tools
const tools = [
  deployTool,
  configureDomainTool,
  provisionDatabaseTool,
  getLogsTool,
  getMetricsTool
];

/**
 * Get a tool by name
 * 
 * @param name - Tool name
 * @returns - Tool object or undefined if not found
 */
export function getToolByName(name: string): McpTool | undefined {
  return tools.find((tool: McpTool) => tool.name === name);
}

/**
 * Get all available tool names
 * 
 * @returns - Array of tool names
 */
export function getToolNames(): string[] {
  return tools.map((tool: McpTool) => tool.name);
}

/**
 * Get tool descriptions for documentation
 * 
 * @returns - Array of tool descriptions
 */
export function getToolDescriptions(): Array<{name: string, description: string}> {
  return tools.map((tool: McpTool) => ({
    name: tool.name,
    description: tool.description
  }));
}

export default tools;
