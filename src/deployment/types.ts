/**
 * Type for status update callback
 */
export type StatusCallback = (status: string) => void;

/**
 * Deployment types
 */
export enum DeploymentType {
  BACKEND = 'backend',
  FRONTEND = 'frontend',
  FULLSTACK = 'fullstack'
}

/**
 * Framework types
 */
export enum Framework {
  EXPRESS = 'express',
  REACT = 'react',
  NEXTJS = 'nextjs',
  VUE = 'vue',
  ANGULAR = 'angular'
}

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  projectName: string;
  region?: string;
  backendConfiguration?: BackendConfig;
  frontendConfiguration?: FrontendConfig;
}

/**
 * Backend configuration
 */
export interface BackendConfig {
  runtime?: string;
  memorySize?: number;
  timeout?: number;
}

/**
 * Frontend configuration
 */
export interface FrontendConfig {
  indexDocument?: string;
  errorDocument?: string;
}

/**
 * Deployment parameters
 */
export interface DeploymentParams {
  deploymentType: DeploymentType;
  framework: Framework;
  source: {
    path: string;
  };
  configuration: DeploymentConfig;
}
