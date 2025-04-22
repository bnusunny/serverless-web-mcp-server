/**
 * Deployment Types
 * 
 * Type definitions for deployment options and results.
 */

/**
 * Deployment status enum
 */
export enum DeploymentStatus {
  DEPLOYED = 'DEPLOYED',
  FAILED = 'FAILED',
  IN_PROGRESS = 'IN_PROGRESS',
  PARTIAL = 'PARTIAL'
}

/**
 * Base deployment options interface
 */
export interface DeployOptions {
  deploymentType: 'backend' | 'frontend' | 'fullstack';
  projectName: string;
  projectRoot: string;
  region?: string;
  backendConfiguration?: BackendDeployOptions;
  frontendConfiguration?: FrontendDeployOptions;
}

/**
 * Backend deployment options interface
 */
export interface BackendDeployOptions {
  builtArtifactsPath: string;
  framework?: string;
  runtime: string;
  startupScript?: string;  // Now optional if entryPoint is provided
  entryPoint?: string;     // New field for application entry point
  generateStartupScript?: boolean; // Flag to enable startup script generation
  architecture?: 'x86_64' | 'arm64';
  memorySize?: number;
  timeout?: number;
  stage?: string;
  cors?: boolean;
  port: number;
  environment?: Record<string, string>;
  databaseConfiguration?: {
    tableName: string;
    attributeDefinitions: Array<{
      name: string;
      type: 'S' | 'N' | 'B';
    }>;
    keySchema: Array<{
      name: string;
      type: 'HASH' | 'RANGE';
    }>;
    billingMode?: 'PROVISIONED' | 'PAY_PER_REQUEST';
    readCapacity?: number;
    writeCapacity?: number;
  };
}

/**
 * Frontend deployment options interface
 */
export interface FrontendDeployOptions {
  builtAssetsPath: string;
  framework?: string;
  indexDocument?: string;
  errorDocument?: string;
  customDomain?: string;
  certificateArn?: string;
}

/**
 * Fullstack deployment options interface
 */
export interface FullstackDeployOptions extends DeployOptions {
  backendConfiguration: BackendDeployOptions;
  frontendConfiguration: FrontendDeployOptions;
}

/**
 * Base deployment result interface
 */
export interface DeploymentResult {
  status: DeploymentStatus;
  message: string;
  error?: string;
  stackTrace?: string;
  phase?: string;
  [key: string]: any;
}

/**
 * Backend deployment result interface
 */
export interface BackendDeploymentResult extends DeploymentResult {
  url?: string;
  outputs?: Record<string, any>;
}

/**
 * Frontend deployment result interface
 */
export interface FrontendDeploymentResult extends DeploymentResult {
  url?: string;
  bucketName?: string;
  distributionUrl?: string;
}

/**
 * Fullstack deployment result interface
 */
export interface FullstackDeploymentResult extends DeploymentResult {
  backendUrl?: string;
  frontendUrl?: string;
  backendResult?: BackendDeploymentResult;
  frontendResult?: FrontendDeploymentResult;
}
