/**
 * Update Frontend Tool
 * 
 * Handles updating frontend assets without redeploying the entire infrastructure.
 */

import { z } from 'zod';
import { McpTool } from '../types/mcp-tool.js';
import { logger } from '../../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { uploadFrontendAssets } from '../../deployment/frontend-upload.js';
import { use_aws } from '../../utils/aws-utils.js';

/**
 * Schema for update-frontend tool parameters
 */
const updateFrontendSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  projectRoot: z.string().min(1, "Project root path is required"),
  region: z.string().default("us-east-1"),
  builtAssetsPath: z.string().min(1, "Path to built frontend assets is required")
});

/**
 * Handle update-frontend tool invocation
 */
export async function handleUpdateFrontend(params: z.infer<typeof updateFrontendSchema>): Promise<any> {
  try {
    logger.info(`[UPDATE FRONTEND] Starting frontend update for ${params.projectName}`);
    
    // Resolve paths
    const projectRoot = params.projectRoot;
    let builtAssetsPath = params.builtAssetsPath;
    
    // Convert relative path to absolute if needed
    if (!path.isAbsolute(builtAssetsPath)) {
      builtAssetsPath = path.resolve(projectRoot, builtAssetsPath);
    }
    
    // Verify that the built assets path exists
    if (!fs.existsSync(builtAssetsPath)) {
      return {
        status: 'error',
        message: `Built assets path not found: ${builtAssetsPath}`,
        content: [{ type: 'text', text: `Error: Built assets path not found: ${builtAssetsPath}` }]
      };
    }
    
    // Get the CloudFormation stack outputs to find the S3 bucket
    const stackName = `${params.projectName}-stack`;
    logger.info(`Looking up CloudFormation stack: ${stackName}`);
    
    try {
      // Get stack outputs
      const describeStacksResult = await use_aws({
        region: params.region,
        service_name: 'cloudformation',
        operation_name: 'describe-stacks',
        label: 'Get CloudFormation stack outputs',
        parameters: {
          'stack-name': stackName
        }
      });
      
      // Extract the S3 bucket name from stack outputs
      const outputs = describeStacksResult.Stacks[0].Outputs;
      const bucketOutput = outputs.find((output: any) => output.OutputKey === 'WebsiteBucket');
      
      if (!bucketOutput) {
        return {
          status: 'error',
          message: `Could not find WebsiteBucket output in CloudFormation stack ${stackName}`,
          content: [{ type: 'text', text: `Error: Could not find WebsiteBucket output in CloudFormation stack ${stackName}. This suggests the stack was not deployed as a frontend or fullstack application.` }]
        };
      }
      
      const bucketName = bucketOutput.OutputValue;
      logger.info(`Found S3 bucket: ${bucketName}`);
      
      // Upload the frontend assets to the S3 bucket
      logger.info(`Uploading frontend assets from ${builtAssetsPath} to bucket ${bucketName}`);
      
      await use_aws({
        region: params.region,
        service_name: 's3',
        operation_name: 'sync',
        label: 'Upload frontend assets to S3',
        parameters: {
          'source': builtAssetsPath,
          'destination': `s3://${bucketName}`,
          'delete': ''
        }
      });
      
      // Check if there's a CloudFront distribution to invalidate
      const cloudfrontOutput = outputs.find((output: any) => 
        output.OutputKey === 'CloudFrontDistribution' || 
        output.OutputKey === 'CloudFrontDomain');
      
      if (cloudfrontOutput) {
        const distributionId = cloudfrontOutput.OutputValue;
        logger.info(`Found CloudFront distribution: ${distributionId}`);
        
        // Create CloudFront invalidation to clear the cache
        logger.info(`Creating CloudFront invalidation for distribution ${distributionId}`);
        
        await use_aws({
          region: params.region,
          service_name: 'cloudfront',
          operation_name: 'create-invalidation',
          label: 'Create CloudFront invalidation',
          parameters: {
            'distribution-id': distributionId,
            'paths': '/*',
            'caller-reference': new Date().getTime().toString()
          }
        });
        
        logger.info(`CloudFront invalidation created successfully`);
      }
      
      // Return success response
      return {
        status: 'success',
        message: `Frontend assets updated successfully for ${params.projectName}`,
        content: [
          { type: 'text', text: `Frontend assets for ${params.projectName} have been successfully updated.` },
          { type: 'text', text: `Assets were uploaded to S3 bucket: ${bucketName}` },
          cloudfrontOutput ? 
            { type: 'text', text: `CloudFront cache invalidation has been initiated and may take a few minutes to complete.` } : 
            { type: 'text', text: `No CloudFront distribution found, so no cache invalidation was needed.` }
        ]
      };
      
    } catch (error: any) {
      logger.error(`Error getting CloudFormation stack: ${error.message}`);
      
      // Check if the error is because the stack doesn't exist
      if (error.message.includes('does not exist')) {
        return {
          status: 'error',
          message: `CloudFormation stack ${stackName} does not exist. Please deploy the application first.`,
          content: [{ type: 'text', text: `Error: CloudFormation stack ${stackName} does not exist. Please deploy the application first using the deploy tool.` }]
        };
      }
      
      // Return general error
      return {
        status: 'error',
        message: `Failed to update frontend assets: ${error.message}`,
        content: [{ type: 'text', text: `Error: Failed to update frontend assets: ${error.message}` }]
      };
    }
    
  } catch (error: any) {
    logger.error(`[UPDATE FRONTEND ERROR] ${error.message}`);
    return {
      status: 'error',
      message: `Failed to update frontend assets: ${error.message}`,
      content: [{ type: 'text', text: `Error: Failed to update frontend assets: ${error.message}` }]
    };
  }
}

/**
 * Update Frontend Tool definition
 */
export const updateFrontendTool: McpTool = {
  name: 'update-frontend',
  description: 'Update frontend assets without redeploying the entire infrastructure',
  parameters: updateFrontendSchema.shape,
  handler: handleUpdateFrontend
};
