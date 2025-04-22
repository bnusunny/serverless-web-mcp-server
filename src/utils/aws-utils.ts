/**
 * AWS Utilities
 * 
 * Utility functions for interacting with AWS services.
 */

import { spawn } from 'child_process';
import { logger } from './logger.js';

/**
 * Interface for AWS CLI parameters
 */
interface AwsCliParams {
  region: string;
  service_name: string;
  operation_name: string;
  label: string;
  parameters: Record<string, any>;
  profile_name?: string;
}

/**
 * Execute an AWS CLI command
 * @param params AWS CLI parameters
 * @returns Promise that resolves with the command output
 */
export async function use_aws(params: AwsCliParams): Promise<any> {
  const { region, service_name, operation_name, parameters, profile_name } = params;
  
  logger.info(`Executing AWS CLI command: ${service_name} ${operation_name}`);
  
  // Build the command arguments
  const args = [service_name, operation_name];
  
  // Add region
  args.push('--region', region);
  
  // Add profile if specified
  if (profile_name) {
    args.push('--profile', profile_name);
  }
  
  // Add parameters
  Object.entries(parameters).forEach(([key, value]) => {
    if (value === '') {
      // For flag parameters with no value
      args.push(`--${key}`);
    } else {
      args.push(`--${key}`, String(value));
    }
  });
  
  // Add output format
  args.push('--output', 'json');
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    logger.debug(`AWS CLI command: aws ${args.join(' ')}`);
    
    const process = spawn('aws', args);
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        try {
          // Try to parse the output as JSON
          const result = stdout ? JSON.parse(stdout) : {};
          logger.debug(`AWS CLI command succeeded: ${service_name} ${operation_name}`);
          resolve(result);
        } catch (error) {
          logger.debug(`AWS CLI command succeeded but returned non-JSON output: ${stdout}`);
          resolve(stdout);
        }
      } else {
        logger.error(`AWS CLI command failed with code ${code}: ${stderr}`);
        reject(new Error(stderr || `AWS CLI command failed with code ${code}`));
      }
    });
    
    process.on('error', (error) => {
      logger.error(`Failed to start AWS CLI command: ${error.message}`);
      reject(error);
    });
  });
}
