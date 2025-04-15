import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Get inventory of AWS resources for deployed applications
 */
export async function getResourceInventory(projectName?: string): Promise<any> {
  const config = loadConfig();
  
  try {
    if (projectName) {
      // Get resources for a specific project
      return getProjectResources(projectName, config.aws.region);
    } else {
      // List resources for all projects
      return getAllProjectsResources(config.aws.region);
    }
  } catch (error) {
    logger.error('Failed to get resource inventory:', error);
    throw error;
  }
}

/**
 * Get resources for a specific project
 */
async function getProjectResources(projectName: string, region: string): Promise<any> {
  try {
    // Check if deployment exists locally
    const deploymentFile = path.join(process.cwd(), 'deployments', `${projectName}.json`);
    
    if (!fs.existsSync(deploymentFile)) {
      throw new Error(`Deployment not found for project: ${projectName}`);
    }
    
    // Load deployment information
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    
    // Get CloudFormation stack resources
    const stackResourcesOutput = execSync(
      `aws cloudformation describe-stack-resources --stack-name ${projectName} --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const stackResources = JSON.parse(stackResourcesOutput).StackResources;
    
    // Enhance resource information with additional details
    const enhancedResources = await Promise.all(
      stackResources.map(async (resource: any) => {
        const details = await getResourceDetails(
          resource.ResourceType,
          resource.PhysicalResourceId,
          region
        );
        
        return {
          logicalId: resource.LogicalResourceId,
          physicalId: resource.PhysicalResourceId,
          type: resource.ResourceType,
          status: resource.ResourceStatus,
          details
        };
      })
    );
    
    return {
      projectName,
      deploymentType: deploymentInfo.deploymentType,
      stackId: getStackId(projectName, region),
      resources: enhancedResources
    };
  } catch (error) {
    logger.error(`Failed to get resources for project ${projectName}:`, error);
    throw error;
  }
}

/**
 * Get resources for all projects
 */
async function getAllProjectsResources(region: string): Promise<any> {
  try {
    // Get all deployment files
    const deploymentsDir = path.join(process.cwd(), 'deployments');
    
    if (!fs.existsSync(deploymentsDir)) {
      return { projects: [] };
    }
    
    const deploymentFiles = fs.readdirSync(deploymentsDir)
      .filter(file => file.endsWith('.json'));
    
    // Get resources for each project
    const projectResources = await Promise.all(
      deploymentFiles.map(async (file) => {
        const projectName = file.replace('.json', '');
        try {
          return await getProjectResources(projectName, region);
        } catch (error) {
          logger.warn(`Skipping resources for project ${projectName}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null results
    const validProjectResources = projectResources.filter(Boolean);
    
    return {
      projects: validProjectResources
    };
  } catch (error) {
    logger.error('Failed to get resources for all projects:', error);
    throw error;
  }
}

/**
 * Get CloudFormation stack ID
 */
function getStackId(stackName: string, region: string): string {
  try {
    const output = execSync(
      `aws cloudformation describe-stacks --stack-name ${stackName} --region ${region} --query "Stacks[0].StackId" --output text`,
      { encoding: 'utf8' }
    );
    
    return output.trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Get detailed information about a specific resource
 */
async function getResourceDetails(resourceType: string, resourceId: string, region: string): Promise<any> {
  try {
    switch (resourceType) {
      case 'AWS::Lambda::Function':
        return getLambdaDetails(resourceId, region);
      case 'AWS::ApiGateway::RestApi':
        return getApiGatewayDetails(resourceId, region);
      case 'AWS::S3::Bucket':
        return getS3BucketDetails(resourceId, region);
      case 'AWS::CloudFront::Distribution':
        return getCloudFrontDetails(resourceId, region);
      case 'AWS::DynamoDB::Table':
        return getDynamoDbDetails(resourceId, region);
      case 'AWS::RDS::DBCluster':
        return getRdsClusterDetails(resourceId, region);
      default:
        return {}; // No additional details for other resource types
    }
  } catch (error) {
    logger.warn(`Failed to get details for ${resourceType} ${resourceId}:`, error);
    return {};
  }
}

/**
 * Get Lambda function details
 */
function getLambdaDetails(functionName: string, region: string): any {
  try {
    const output = execSync(
      `aws lambda get-function --function-name ${functionName} --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const functionData = JSON.parse(output);
    
    return {
      runtime: functionData.Configuration.Runtime,
      memorySize: functionData.Configuration.MemorySize,
      timeout: functionData.Configuration.Timeout,
      lastModified: functionData.Configuration.LastModified,
      codeSize: functionData.Configuration.CodeSize
    };
  } catch (error) {
    return {};
  }
}

/**
 * Get API Gateway details
 */
function getApiGatewayDetails(apiId: string, region: string): any {
  try {
    const apiOutput = execSync(
      `aws apigateway get-rest-api --rest-api-id ${apiId} --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const stagesOutput = execSync(
      `aws apigateway get-stages --rest-api-id ${apiId} --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const apiData = JSON.parse(apiOutput);
    const stagesData = JSON.parse(stagesOutput);
    
    return {
      name: apiData.name,
      description: apiData.description,
      createdDate: apiData.createdDate,
      stages: stagesData.item.map((stage: any) => ({
        name: stage.stageName,
        deployedAt: stage.lastUpdatedDate,
        url: `https://${apiId}.execute-api.${region}.amazonaws.com/${stage.stageName}`
      }))
    };
  } catch (error) {
    return {};
  }
}

/**
 * Get S3 bucket details
 */
function getS3BucketDetails(bucketName: string, region: string): any {
  try {
    const locationOutput = execSync(
      `aws s3api get-bucket-location --bucket ${bucketName} --output json`,
      { encoding: 'utf8' }
    );
    
    const websiteOutput = execSync(
      `aws s3api get-bucket-website --bucket ${bucketName} --output json || echo "{}"`,
      { encoding: 'utf8' }
    );
    
    const locationData = JSON.parse(locationOutput);
    const websiteData = JSON.parse(websiteOutput);
    
    return {
      region: locationData.LocationConstraint || 'us-east-1',
      website: {
        indexDocument: websiteData.IndexDocument?.Suffix,
        errorDocument: websiteData.ErrorDocument?.Key
      },
      url: `http://${bucketName}.s3-website-${region}.amazonaws.com`
    };
  } catch (error) {
    return {};
  }
}

/**
 * Get CloudFront distribution details
 */
function getCloudFrontDetails(distributionId: string, region: string): any {
  try {
    const output = execSync(
      `aws cloudfront get-distribution --id ${distributionId} --output json`,
      { encoding: 'utf8' }
    );
    
    const distributionData = JSON.parse(output);
    const config = distributionData.Distribution.DistributionConfig;
    
    return {
      domainName: distributionData.Distribution.DomainName,
      status: distributionData.Distribution.Status,
      enabled: config.Enabled,
      origins: config.Origins.Items.map((origin: any) => ({
        id: origin.Id,
        domainName: origin.DomainName
      })),
      customDomains: config.Aliases?.Items || []
    };
  } catch (error) {
    return {};
  }
}

/**
 * Get DynamoDB table details
 */
function getDynamoDbDetails(tableName: string, region: string): any {
  try {
    const output = execSync(
      `aws dynamodb describe-table --table-name ${tableName} --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const tableData = JSON.parse(output);
    const table = tableData.Table;
    
    return {
      status: table.TableStatus,
      itemCount: table.ItemCount,
      sizeBytes: table.TableSizeBytes,
      keySchema: table.KeySchema.map((key: any) => ({
        name: key.AttributeName,
        type: key.KeyType
      }))
    };
  } catch (error) {
    return {};
  }
}

/**
 * Get RDS cluster details
 */
function getRdsClusterDetails(clusterIdentifier: string, region: string): any {
  try {
    const output = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterIdentifier} --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const clusterData = JSON.parse(output);
    const cluster = clusterData.DBClusters[0];
    
    return {
      engine: cluster.Engine,
      engineVersion: cluster.EngineVersion,
      status: cluster.Status,
      endpoint: cluster.Endpoint,
      port: cluster.Port,
      databaseName: cluster.DatabaseName
    };
  } catch (error) {
    return {};
  }
}
