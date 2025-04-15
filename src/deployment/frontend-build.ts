import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { StatusCallback } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * Build frontend assets
 */
export async function buildFrontendAssets(
  sourcePath: string, 
  buildCommand: string = 'npm run build',
  outputDir: string = 'build',
  statusCallback?: StatusCallback
): Promise<string> {
  logger.info(`Building frontend assets in ${sourcePath}`);
  
  // Execute build command
  await new Promise<void>((resolve, reject) => {
    // Split command into parts
    const [cmd, ...args] = buildCommand.split(' ');
    
    const build = spawn(cmd, args, { 
      cwd: sourcePath,
      shell: true,
      env: { ...process.env, CI: 'true' } // Avoid interactive prompts
    });
    
    build.stdout.on('data', (data) => {
      const message = data.toString().trim();
      logger.info(`Build output: ${message}`);
      if (statusCallback) statusCallback(message);
    });
    
    build.stderr.on('data', (data) => {
      const message = data.toString().trim();
      logger.error(`Build error: ${message}`);
      if (statusCallback) statusCallback(`Error: ${message}`);
    });
    
    build.on('close', (code) => {
      if (code === 0) {
        logger.info('Frontend build completed successfully');
        resolve();
      } else {
        reject(new Error(`Build failed with code ${code}`));
      }
    });
  });
  
  // Verify build output directory exists
  const buildOutputPath = path.join(sourcePath, outputDir);
  if (!fs.existsSync(buildOutputPath)) {
    throw new Error(`Build output directory not found: ${buildOutputPath}`);
  }
  
  logger.info(`Frontend build completed, output directory: ${buildOutputPath}`);
  return buildOutputPath;
}
