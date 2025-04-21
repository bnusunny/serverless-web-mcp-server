/**
 * MCP Tool Interface
 * 
 * Defines the structure of an MCP tool
 */

import { z } from 'zod';

export interface McpTool {
  name: string;
  description: string;
  parameters:  Record<string, any>;
  handler: (params: any) => Promise<any>;
}
