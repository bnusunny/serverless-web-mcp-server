import { execSync } from 'child_process';
import { loadConfig } from '../config.js';

// Define metrics retrieval parameters interface
export interface MetricsParams {
  projectName: string;
  resourceType: 'lambda' | 'api-gateway' | 'cloudfront' | 's3';
  metricName: string;
  startTime?: string;
  endTime?: string;
  period: number;
}

/**
 * Fetch performance metrics for deployed applications
 */
export async function getMetrics(params: MetricsParams): Promise<string> {
  const config = loadConfig();
  const { projectName, resourceType, metricName, startTime, endTime, period } = params;
  
  try {
    // Get metric namespace and dimensions based on resource type
    const { namespace, dimensions } = getMetricDetails(projectName, resourceType);
    
    // Build query command
    let command = `aws cloudwatch get-metric-data --region ${config.aws.region} --output json`;
    
    // Calculate time range
    const now = new Date();
    const startTimeStr = startTime ? new Date(startTime).toISOString() : new Date(now.getTime() - 3600000).toISOString();
    const endTimeStr = endTime ? new Date(endTime).toISOString() : now.toISOString();
    
    // Create metric query JSON
    const metricQuery = {
      MetricDataQueries: [
        {
          Id: "m1",
          MetricStat: {
            Metric: {
              Namespace: namespace,
              MetricName: metricName,
              Dimensions: dimensions
            },
            Period: period,
            Stat: "Average"
          }
        }
      ],
      StartTime: startTimeStr,
      EndTime: endTimeStr
    };
    
    // Write query to temporary file
    const fs = require('fs');
    const path = require('path');
    const tempFile = path.join(process.cwd(), 'metric-query.json');
    fs.writeFileSync(tempFile, JSON.stringify(metricQuery));
    
    // Execute command with query file
    command += ` --cli-input-json file://${tempFile}`;
    const output = execSync(command, { encoding: 'utf8' });
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    // Parse and format results
    const metricData = JSON.parse(output);
    return formatMetricData(metricData, metricName);
  } catch (error) {
    console.error('Failed to retrieve metrics:', error);
    throw new Error(`Failed to retrieve metrics for ${resourceType} in project ${projectName}`);
  }
}

/**
 * Get CloudWatch metric namespace and dimensions based on resource type
 */
function getMetricDetails(projectName: string, resourceType: string): { namespace: string; dimensions: any[] } {
  switch (resourceType) {
    case 'lambda':
      return {
        namespace: 'AWS/Lambda',
        dimensions: [
          {
            Name: 'FunctionName',
            Value: `${projectName}-function`
          }
        ]
      };
    case 'api-gateway':
      return {
        namespace: 'AWS/ApiGateway',
        dimensions: [
          {
            Name: 'ApiName',
            Value: projectName
          }
        ]
      };
    case 'cloudfront':
      const distributionId = getCloudFrontDistributionId(projectName);
      return {
        namespace: 'AWS/CloudFront',
        dimensions: [
          {
            Name: 'DistributionId',
            Value: distributionId
          }
        ]
      };
    case 's3':
      const bucketName = getS3BucketName(projectName);
      return {
        namespace: 'AWS/S3',
        dimensions: [
          {
            Name: 'BucketName',
            Value: bucketName
          }
        ]
      };
    default:
      throw new Error(`Unsupported resource type for metrics: ${resourceType}`);
  }
}

/**
 * Get CloudFront distribution ID for a project
 */
function getCloudFrontDistributionId(projectName: string): string {
  try {
    const output = execSync(
      `aws cloudformation describe-stack-resources --stack-name ${projectName} --logical-resource-id CloudFrontDistribution --query "StackResources[0].PhysicalResourceId" --output text`,
      { encoding: 'utf8' }
    );
    
    return output.trim();
  } catch (error) {
    throw new Error(`Failed to get CloudFront distribution ID for project ${projectName}`);
  }
}

/**
 * Get S3 bucket name for a project
 */
function getS3BucketName(projectName: string): string {
  try {
    const output = execSync(
      `aws cloudformation describe-stack-resources --stack-name ${projectName} --logical-resource-id WebsiteBucket --query "StackResources[0].PhysicalResourceId" --output text`,
      { encoding: 'utf8' }
    );
    
    return output.trim();
  } catch (error) {
    throw new Error(`Failed to get S3 bucket name for project ${projectName}`);
  }
}

/**
 * Format metric data into readable text
 */
function formatMetricData(metricData: any, metricName: string): string {
  const results = metricData.MetricDataResults[0];
  
  if (!results || results.Values.length === 0) {
    return `No metric data found for ${metricName}.`;
  }
  
  // Format timestamps and values
  const formattedData = results.Timestamps.map((timestamp: string, index: number) => {
    const time = new Date(timestamp).toISOString();
    const value = results.Values[index].toFixed(4);
    return `[${time}] ${metricName}: ${value} ${results.Unit || ''}`;
  }).join('\n');
  
  return formattedData;
}
