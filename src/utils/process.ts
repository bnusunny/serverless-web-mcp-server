/**
 * Process utilities for executing commands
 */

import { exec } from 'child_process';
import { logger } from './logger.js';

/**
 * Execute a shell command and return the result
 * @param command - Command to execute
 * @param options - Execution options
 * @returns Promise with stdout
 */
export function executeCommand(
  command: string,
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<string> {
  logger.debug(`Executing command: ${command}`);
  
  return new Promise((resolve, reject) => {
    exec(command, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) }
    }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Command execution failed: ${error.message}`);
        logger.error(`stderr: ${stderr}`);
        reject(new Error(`Command execution failed: ${error.message}\n${stderr}`));
        return;
      }
      
      if (stderr) {
        logger.debug(`Command stderr: ${stderr}`);
      }
      
      logger.debug(`Command stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}
