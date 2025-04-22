/**
 * MCP Tools Index
 * 
 * Exports all tool implementations and utility functions for working with tools.
 */

// Import tool definitions
import deployTool from './deploy.js';
import getLogsTool from './get-logs.js';
import getMetricsTool from './get-metrics.js';
import deploymentHelpTool from './deployment-help.js';
import { updateFrontendTool } from './update-frontend.js';
import { McpTool } from '../types/mcp-tool.js';

// Export individual tools
export { default as deployTool } from './deploy.js';
export { default as getLogsTool } from './get-logs.js';
export { default as getMetricsTool } from './get-metrics.js';
export { default as deploymentHelpTool } from './deployment-help.js';
export { updateFrontendTool } from './update-frontend.js';

// Export the McpTool interface
export type { McpTool } from '../types/mcp-tool.js';

// Create array of all tools
const tools: McpTool[] = [
  deployTool,
  getLogsTool,
  getMetricsTool,
  deploymentHelpTool,
  updateFrontendTool
];

export default tools;
