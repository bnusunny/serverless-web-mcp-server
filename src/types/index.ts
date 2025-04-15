/**
 * Common type definitions for the serverless-web-mcp-server
 */

export interface DeploymentSource {
  path: string;
}

export interface BackendConfiguration {
  runtime: string;
  framework?: string;
  entryPoint?: string;
  memorySize: number;
  timeout: number;
  architecture: string;
  stage: string;
  cors: boolean;
  environment?: Record<string, string>;
}

export interface FrontendConfiguration {
  type?: string;
  indexDocument: string;
  errorDocument?: string;
  customDomain?: string;
  certificateArn?: string;
}

export interface AttributeDefinition {
  name: string;
  type: string;
}

export interface KeySchema {
  name: string;
  type: string;
}

export interface DatabaseConfiguration {
  tableName: string;
  billingMode: string;
  attributeDefinitions: AttributeDefinition[];
  keySchema: KeySchema[];
  readCapacity?: number;
  writeCapacity?: number;
}

export interface DeploymentConfiguration {
  projectName: string;
  region: string;
  backendConfiguration?: BackendConfiguration;
  frontendConfiguration?: FrontendConfiguration;
  databaseConfiguration?: DatabaseConfiguration;
}

export type DeploymentType = 'backend' | 'frontend' | 'fullstack';

export interface DeployOptions {
  deploymentType: DeploymentType;
  source: DeploymentSource;
  framework?: string;
  configuration: DeploymentConfiguration;
}

export interface DeployResult {
  status: string;
  message: string;
  outputs?: Record<string, string>;
  stackName?: string;
  error?: string;
}

export interface BootstrapOptions {
  framework?: string;
  entryPoint?: string;
  projectPath: string;
  environment?: Record<string, string>;
}

export interface DeployToolParams {
  deploymentType: DeploymentType;
  source: DeploymentSource;
  framework?: string;
  entryPoint?: string;
  configuration: DeploymentConfiguration;
}

export interface DeployToolResult {
  status: string;
  message: string;
  outputs?: Record<string, string>;
  stackName?: string;
  inputKey?: string;
  context?: string;
}

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DeploySamResult {
  outputs: Record<string, string>;
}
