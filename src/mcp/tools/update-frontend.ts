/**
 * Update Frontend Tool
 * 
 * Handles updating frontend assets without redeploying the entire infrastructure.
 * Uses AWS SDK directly instead of AWS CLI.
 */

import { z } from 'zod';
import { McpTool } from '../types/mcp-tool.js';
import { logger } from '../../utils/logger.js';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

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
 * Recursively get all files in a directory
 */
async function getAllFiles(dirPath: string, arrayOfFiles: string[] = [], basePath: string = dirPath): Promise<string[]> {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = await getAllFiles(filePath, arrayOfFiles, basePath);
    } else {
      arrayOfFiles.push(filePath);
    }
  }

  return arrayOfFiles;
}

/**
 * Upload a file to S3
 */
async function uploadFileToS3(
  s3Client: S3Client, 
  filePath: string, 
  bucketName: string, 
  basePath: string
): Promise<void> {
  // Get the relative path for the S3 key
  const key = filePath.replace(basePath, '').replace(/^\//, '');
  
  // Read the file
  const fileContent = fs.readFileSync(filePath);
  
  // Determine content type
  const contentType = mime.lookup(filePath) || 'application/octet-stream';
  
  // Upload to S3
  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: contentType
  }));
  
  logger.debug(`Uploaded ${key} to ${bucketName}`);
}

/**
 * Sync directory to S3 bucket (upload new/modified files, delete removed files)
 */
async function syncDirectoryToS3(
  s3Client: S3Client,
  directoryPath: string,
  bucketName: string
): Promise<void> {
  logger.info(`Syncing directory ${directoryPath} to S3 bucket ${bucketName}`);
  
  // Get all local files
  const localFiles = await getAllFiles(directoryPath);
  const localFileKeys = localFiles.map(file => 
    file.replace(directoryPath, '').replace(/^\//, '')
  );
  
  // Get all S3 objects
  const s3Objects: string[] = [];
  let continuationToken: string | undefined;
  
  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken
    });
    
    const response = await s3Client.send(listCommand);
    
    if (response.Contents) {
      response.Contents.forEach(object => {
        if (object.Key) s3Objects.push(object.Key);
      });
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  // Upload new and modified files
  for (const localFile of localFiles) {
    await uploadFileToS3(s3Client, localFile, bucketName, directoryPath);
  }
  
  // Delete files that exist in S3 but not locally
  for (const s3Key of s3Objects) {
    if (!localFileKeys.includes(s3Key)) {
      logger.debug(`Deleting ${s3Key} from ${bucketName}`);
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: s3Key
      }));
    }
  }
  
  logger.info(`Sync completed: ${localFiles.length} files uploaded, ${s3Objects.length - localFileKeys.length} files deleted`);
}

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
    
    // Initialize AWS clients
    const credentials = fromNodeProviderChain();
    const region = params.region;
    
    const cfClient = new CloudFormationClient({ 
      region, 
      credentials 
    });
    
    const s3Client = new S3Client({ 
      region, 
      credentials 
    });
    
    const cloudFrontClient = new CloudFrontClient({ 
      region, 
      credentials 
    });
    
    // Get the CloudFormation stack outputs to find the S3 bucket
    const stackName = params.projectName;
    logger.info(`Looking up CloudFormation stack: ${stackName}`);
    
    try {
      // Get stack outputs
      const describeStacksCommand = new DescribeStacksCommand({
        StackName: stackName
      });
      
      const describeStacksResult = await cfClient.send(describeStacksCommand);
      
      if (!describeStacksResult.Stacks || describeStacksResult.Stacks.length === 0) {
        return {
          status: 'error',
          message: `CloudFormation stack ${stackName} not found`,
          content: [{ type: 'text', text: `Error: CloudFormation stack ${stackName} not found. Please deploy the application first using the deploy tool.` }]
        };
      }
      
      // Extract the S3 bucket name from stack outputs
      const outputs = describeStacksResult.Stacks[0].Outputs || [];
      const bucketOutput = outputs.find(output => output.OutputKey === 'WebsiteBucket');
      
      if (!bucketOutput || !bucketOutput.OutputValue) {
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
      
      await syncDirectoryToS3(s3Client, builtAssetsPath, bucketName);
      
      // Check if there's a CloudFront distribution to invalidate
      const cloudfrontOutput = outputs.find(output => 
        output.OutputKey === 'CloudFrontDistribution' || 
        output.OutputKey === 'CloudFrontDomain' ||
        output.OutputKey === 'CloudFrontDistributionId' ||
        output.OutputKey === 'CloudFrontURL'
      );
      
      if (cloudfrontOutput && cloudfrontOutput.OutputValue) {
        // Get the distribution ID - it might be directly the ID or a URL
        let distributionId = cloudfrontOutput.OutputValue;
        
        // If we have a CloudFront URL instead of an ID, look for the ID specifically
        if (distributionId.startsWith('http')) {
          const distributionIdOutput = outputs.find(output => 
            output.OutputKey === 'CloudFrontDistributionId'
          );
          
          if (distributionIdOutput && distributionIdOutput.OutputValue) {
            distributionId = distributionIdOutput.OutputValue;
          } else {
            logger.warn(`Found CloudFront URL but no distribution ID, skipping invalidation`);
            return {
              status: 'success',
              message: `Frontend assets updated successfully for ${params.projectName}, but couldn't create CloudFront invalidation`,
              content: [
                { type: 'text', text: `Frontend assets for ${params.projectName} have been successfully updated.` },
                { type: 'text', text: `Assets were uploaded to S3 bucket: ${bucketName}` },
                { type: 'text', text: `CloudFront distribution was found, but no distribution ID was available for cache invalidation. You may need to manually invalidate the cache.` }
              ]
            };
          }
        }
        
        logger.info(`Found CloudFront distribution: ${distributionId}`);
        
        // Create CloudFront invalidation to clear the cache
        logger.info(`Creating CloudFront invalidation for distribution ${distributionId}`);
        
        const createInvalidationCommand = new CreateInvalidationCommand({
          DistributionId: distributionId,
          InvalidationBatch: {
            CallerReference: new Date().getTime().toString(),
            Paths: {
              Quantity: 1,
              Items: ['/*']
            }
          }
        });
        
        await cloudFrontClient.send(createInvalidationCommand);
        
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
  name: 'update_frontend',
  description: 'Update frontend assets without redeploying the entire infrastructure',
  parameters: updateFrontendSchema.shape,
  handler: handleUpdateFrontend
};
