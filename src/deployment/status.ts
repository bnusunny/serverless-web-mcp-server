import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { loadConfig } from '../config.js';

/**
 * Get the status of a deployment
 */
export async function getDeploymentStatus(projectName: string): Promise<any> {
  const config = loadConfig();
  
  try {
    // Check if deployment exists locally
    const deploymentFile = path.join(process.cwd(), 'deployments', `${projectName}.json`);
    
    if (!fs.existsSync(deploymentFile)) {
      throw new Error(`Deployment not found for project: ${projectName}`);
    }
    
    // Load deployment information
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    
    // Get CloudFormation stack status
    try {
      const stackOutput = execSync(
        `aws cloudformation describe-stacks --stack-name ${projectName} --region ${config.aws.region} --query "Stacks[0].StackStatus" --output text`,
        { encoding: 'utf8' }
      );
      
      deploymentInfo.stackStatus = stackOutput.trim();
    } catch (error) {
      deploymentInfo.stackStatus = 'UNKNOWN';
    }
    
    // Get resource statuses
    const resourceStatuses = await Promise.all(
      deploymentInfo.resources.map(async (resource: any) => {
        const status = await getResourceStatus(resource.type, resource.id, config.aws.region);
        return {
          ...resource,
          status
        };
      })
    );
    
    deploymentInfo.resources = resourceStatuses;
    
    // Get domain information if available
    const domainFile = path.join(process.cwd(), 'domains', `${projectName}.json`);
    if (fs.existsSync(domainFile)) {
      deploymentInfo.domain = JSON.parse(fs.readFileSync(domainFile, 'utf8'));
    }
    
    // Get database information if available
    const databaseFile = path.join(process.cwd(), 'databases', `${projectName}.json`);
    if (fs.existsSync(databaseFile)) {
      deploymentInfo.database = JSON.parse(fs.readFileSync(databaseFile, 'utf8'));
    }
    
    return deploymentInfo;
  } catch (error) {
    console.error(`Failed to get deployment status for ${projectName}:`, error);
    throw error;
  }
}

/**
 * Get the status of a specific AWS resource
 */
async function getResourceStatus(resourceType: string, resourceId: string, region: string): Promise<string> {
  try {
    switch (resourceType) {
      case 'Lambda':
        return getLambdaStatus(resourceId, region);
      case 'ApiGateway':
        return getApiGatewayStatus(resourceId, region);
      case 'S3Bucket':
        return getS3BucketStatus(resourceId, region);
      case 'CloudFront':
        return getCloudFrontStatus(resourceId, region);
      default:
        return 'UNKNOWN';
    }
  } catch (error) {
    console.error(`Failed to get status for ${resourceType} ${resourceId}:`, error);
    return 'ERROR';
  }
}

/**
 * Get Lambda function status
 */
function getLambdaStatus(functionArn: string, region: string): string {
  try {
    const functionName = functionArn.split(':').pop();
    
    const output = execSync(
      `aws lambda get-function --function-name ${functionName} --region ${region} --query "Configuration.State" --output text`,
      { encoding: 'utf8' }
    );
    
    return output.trim();
  } catch (error) {
    return 'INACTIVE';
  }
}

/**
 * Get API Gateway status
 */
function getApiGatewayStatus(apiId: string, region: string): string {
  try {
    const output = execSync(
      `aws apigateway get-rest-api --rest-api-id ${apiId} --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    return 'ACTIVE'; // If the command succeeds, the API is active
  } catch (error) {
    return 'INACTIVE';
  }
}

/**
 * Get S3 bucket status
 */
function getS3BucketStatus(bucketName: string, region: string): string {
  try {
    execSync(
      `aws s3api head-bucket --bucket ${bucketName} --region ${region}`,
      { encoding: 'utf8' }
    );
    
    return 'ACTIVE'; // If the command succeeds, the bucket exists
  } catch (error) {
    return 'INACTIVE';
  }
}

/**
 * Get CloudFront distribution status
 */
function getCloudFrontStatus(distributionId: string, region: string): string {
  try {
    const output = execSync(
      `aws cloudfront get-distribution --id ${distributionId} --query "Distribution.Status" --output text`,
      { encoding: 'utf8' }
    );
    
    return output.trim();
  } catch (error) {
    return 'INACTIVE';
  }
}
