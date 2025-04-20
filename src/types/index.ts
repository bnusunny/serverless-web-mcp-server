/**
 * Type definitions for the MCP server
 */

// Deploy tool parameter types
export interface DeployToolParams {
  /**
   * Type of deployment (backend, frontend, fullstack)
   */
  deploymentType: 'backend' | 'frontend' | 'fullstack';
  
  /**
   * Name of the project (used for stack naming)
   */
  projectName: string;
  
  /**
   * Path where SAM template and deployment artifacts will be stored
   */
  projectRoot: string;
  
  /**
   * AWS region for deployment
   * @default "us-east-1"
   */
  region?: string;
  
  /**
   * Backend configuration (required for 'backend' and 'fullstack' types)
   */
  backendConfiguration?: {
    /**
     * Path to pre-built backend artifacts
     * This directory should contain all the code and dependencies needed for deployment,
     * including the startup script
     */
    builtArtifactsPath: string;
    
    /**
     * Web framework used (for informational purposes)
     */
    framework?: string;
    
    /**
     * Lambda runtime
     * @example "nodejs18.x", "python3.9"
     */
    runtime: string;
    
    /**
     * Name of the startup script file
     * This should be a single executable script that takes no parameters
     * The script must be executable in the Lambda (Linux) environment
     * For shell scripts, include a shebang line (e.g., #!/bin/sh)
     */
    startupScript: string;
    
    /**
     * Lambda architecture
     * @default "x86_64"
     */
    architecture?: 'x86_64' | 'arm64';
    
    /**
     * Lambda memory size in MB
     * @default 512
     */
    memorySize?: number;
    
    /**
     * Lambda timeout in seconds
     * @default 30
     */
    timeout?: number;
    
    /**
     * API Gateway stage name
     * @default "prod"
     */
    stage?: string;
    
    /**
     * Enable CORS for API Gateway
     * @default true
     */
    cors?: boolean;
    
    /**
     * Environment variables for Lambda function
     */
    environment?: Record<string, string>;
    
    /**
     * DynamoDB table configuration
     */
    databaseConfiguration?: {
      /**
       * DynamoDB table name
       */
      tableName: string;
      
      /**
       * DynamoDB billing mode
       * @default "PAY_PER_REQUEST"
       */
      billingMode?: 'PROVISIONED' | 'PAY_PER_REQUEST';
      
      /**
       * DynamoDB attribute definitions
       */
      attributeDefinitions: Array<{
        /**
         * Attribute name
         */
        name: string;
        
        /**
         * Attribute type
         */
        type: 'S' | 'N' | 'B';
      }>;
      
      /**
       * DynamoDB key schema
       */
      keySchema: Array<{
        /**
         * Attribute name
         */
        name: string;
        
        /**
         * Key type
         */
        type: 'HASH' | 'RANGE';
      }>;
      
      /**
       * Read capacity units (required if billingMode is "PROVISIONED")
       */
      readCapacity?: number;
      
      /**
       * Write capacity units (required if billingMode is "PROVISIONED")
       */
      writeCapacity?: number;
    };
  };
  
  /**
   * Frontend configuration (required for 'frontend' and 'fullstack' types)
   */
  frontendConfiguration?: {
    /**
     * Path to pre-built frontend assets
     * This directory should contain all the static files ready to be deployed to S3
     */
    builtAssetsPath: string;
    
    /**
     * Frontend framework used (for informational purposes)
     */
    framework?: string;
    
    /**
     * Index document filename
     * @default "index.html"
     */
    indexDocument?: string;
    
    /**
     * Error document filename
     * @default same as indexDocument
     */
    errorDocument?: string;
    
    /**
     * Custom domain name
     */
    customDomain?: string;
    
    /**
     * ACM certificate ARN (required if customDomain is provided)
     */
    certificateArn?: string;
  };
}

// Deploy options for the deployment service
export interface DeployOptions {
  deploymentType: 'backend' | 'frontend' | 'fullstack';
  projectName: string;
  projectRoot: string;
  region?: string;
  backendConfiguration?: any;
  frontendConfiguration?: any;
}

// Deployment configuration
export interface DeploymentConfiguration {
  projectName: string;
  region: string;
  backendConfiguration?: any;
  frontendConfiguration?: any;
}

// Deploy result from the deployment service
export interface DeployResult {
  status: string;
  message: string;
  projectName?: string;
  stackName?: string;
  apiUrl?: string;
  websiteUrl?: string;
  error?: string;
  outputs?: Record<string, string>;
}

// Deploy SAM result
export interface DeploySamResult {
  status: string;
  message: string;
  stackName?: string;
  outputs?: Record<string, string>;
}

// Bootstrap options for Lambda Web Adapter
export interface BootstrapOptions {
  framework: string;
  entryPoint?: string;
  projectPath: string;
  environment?: Record<string, string>;
}

// Package.json type
export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  main?: string;
}

// Deploy tool result types
export interface DeployToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  status: 'success' | 'error' | 'preparing' | 'needs_input';
  message: string;
  stackName?: string;
  apiUrl?: string;
  websiteUrl?: string;
  inputKey?: string;
  context?: string;
  [key: string]: unknown;
}

// MCP response content item
export interface McpContentItem {
  type: string;
  text?: string;
  url?: string;
  mimeType?: string;
  data?: any;
}

// MCP needs input response
export interface McpNeedsInputResponse {
  content: McpContentItem[];
  status: 'needs_input';
  message: string;
  inputKey: string;
  context?: string;
}

// MCP success response
export interface McpSuccessResponse {
  content: McpContentItem[];
  status: 'success' | 'preparing' | 'error';
  message: string;
  [key: string]: any;
}

// Status callback type
export type StatusCallback = (message: string) => void;
