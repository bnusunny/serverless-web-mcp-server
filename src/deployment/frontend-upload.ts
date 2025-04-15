import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { StatusCallback } from './types.js';
import { logger } from '../utils/logger.js';
import { buildFrontendAssets } from './frontend-build.js';

/**
 * Upload frontend assets to S3
 */
export async function uploadFrontendAssets(
  configuration: any,
  deployResult: any,
  statusCallback?: StatusCallback
): Promise<void> {
  try {
    const { projectName, frontendConfiguration } = configuration;
    
    if (!frontendConfiguration || !frontendConfiguration.sourcePath) {
      logger.info(`No frontend configuration found for ${projectName}, skipping upload`);
      return;
    }
    
    // Get S3 bucket name from deployment result
    const bucketName = deployResult.outputs.WebsiteBucket;
    if (!bucketName) {
      throw new Error('S3 bucket name not found in deployment outputs');
    }
    
    logger.info(`Uploading frontend assets for ${projectName} to bucket ${bucketName}`);
    
    // Build frontend assets
    const buildOutputPath = await buildFrontendAssets(
      frontendConfiguration.sourcePath,
      frontendConfiguration.buildCommand || 'npm run build',
      frontendConfiguration.outputDir || 'build',
      statusCallback
    );
    
    // Upload to S3
    await uploadToS3(buildOutputPath, bucketName, configuration.region);
    
    logger.info(`Frontend assets uploaded successfully for ${projectName}`);
  } catch (error) {
    logger.error(`Failed to upload frontend assets:`, error);
    throw error;
  }
}

/**
 * Upload directory contents to S3 bucket
 */
async function uploadToS3(sourcePath: string, bucketName: string, region: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const upload = spawn('aws', [
      's3', 'sync',
      sourcePath,
      `s3://${bucketName}`,
      '--delete',
      '--region', region
    ]);
    
    upload.stdout.on('data', (data) => {
      logger.info(`S3 upload: ${data}`);
    });
    
    upload.stderr.on('data', (data) => {
      logger.error(`S3 upload error: ${data}`);
    });
    
    upload.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with code ${code}`));
      }
    });
  });
}
