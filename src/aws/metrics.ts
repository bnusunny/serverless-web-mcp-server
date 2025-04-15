import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

// Type for status update callback
type StatusCallback = (status: string) => void;

/**
 * Get metrics for a deployed application
 */
export async function getMetrics(params: any, statusCallback?: StatusCallback): Promise<string> {
  const { projectName, resourceType, metricName, startTime, endTime, period } = params;
  
  try {
    // Send status update
    sendStatus(statusCallback, `Retrieving ${metricName} metrics for ${resourceType} in ${projectName}...`);
    
    // Validate parameters
    if (!projectName) {
      throw new Error('projectName is required');
    }
    
    if (!resourceType) {
      throw new Error('resourceType is required');
    }
    
    if (!metricName) {
      throw new Error('metricName is required');
    }
    
    // Get the namespace and dimensions based on resource type
    const { namespace, dimensions } = getMetricDetails(projectName, resourceType);
    sendStatus(statusCallback, `Using namespace: ${namespace}`);
    
    // Build the AWS CLI command for retrieving metrics
    const awsCommand = buildAwsMetricsCommand(
      namespace,
      metricName,
      dimensions,
      startTime,
      endTime,
      period || 60
    );
    
    // Execute the AWS CLI command
    sendStatus(statusCallback, `Executing AWS CLI command to retrieve metrics...`);
    const result = await executeAwsCommand(awsCommand, statusCallback);
    
    // Process and format the metrics
    sendStatus(statusCallback, `Processing metric data points...`);
    const formattedMetrics = formatMetrics(result.stdout, namespace, metricName, dimensions);
    
    return formattedMetrics;
  } catch (error) {
    logger.error('Metrics retrieval failed:', error);
    sendStatus(statusCallback, `Metrics retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Send a status update via the callback if provided
 */
function sendStatus(callback?: StatusCallback, message?: string): void {
  if (callback && message) {
    callback(message);
    logger.info(message); // Also log to file
  }
}

/**
 * Get the CloudWatch Metrics namespace and dimensions based on resource type
 */
function getMetricDetails(projectName: string, resourceType: string): { namespace: string, dimensions: any[] } {
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
            Value: `${projectName}-api`
          }
        ]
      };
    case 'cloudfront':
      return {
        namespace: 'AWS/CloudFront',
        dimensions: [
          {
            Name: 'DistributionId',
            Value: `${projectName}-distribution`
          }
        ]
      };
    case 's3':
      return {
        namespace: 'AWS/S3',
        dimensions: [
          {
            Name: 'BucketName',
            Value: `${projectName}-bucket`
          }
        ]
      };
    default:
      throw new Error(`Unsupported resource type for metrics: ${resourceType}`);
  }
}

/**
 * Build the AWS CLI command for retrieving metrics
 */
function buildAwsMetricsCommand(
  namespace: string,
  metricName: string,
  dimensions: any[],
  startTime?: string,
  endTime?: string,
  period: number = 60
): string[] {
  const command = [
    'cloudwatch',
    'get-metric-statistics',
    '--namespace', namespace,
    '--metric-name', metricName,
    '--period', period.toString(),
    '--statistics', 'Average', 'Sum', 'Maximum', 'Minimum'
  ];
  
  // Add dimensions
  if (dimensions && dimensions.length > 0) {
    const dimensionsJson = JSON.stringify(dimensions);
    command.push('--dimensions', dimensionsJson);
  }
  
  // Add start time if provided, otherwise use 24 hours ago
  if (startTime) {
    command.push('--start-time', startTime);
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    command.push('--start-time', yesterday.toISOString());
  }
  
  // Add end time if provided, otherwise use current time
  if (endTime) {
    command.push('--end-time', endTime);
  } else {
    command.push('--end-time', new Date().toISOString());
  }
  
  // Add output format
  command.push('--output', 'json');
  
  return command;
}

/**
 * Execute AWS CLI command
 */
async function executeAwsCommand(command: string[], statusCallback?: StatusCallback): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    sendStatus(statusCallback, `Executing: aws ${command.join(' ')}`);
    
    const process = spawn('aws', command);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
    });
    
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      sendStatus(statusCallback, `[ERROR] ${chunk.trim()}`);
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`AWS CLI command failed with exit code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Format metrics from AWS CLI output
 */
function formatMetrics(metricsOutput: string, namespace: string, metricName: string, dimensions: any[]): string {
  try {
    const parsedMetrics = JSON.parse(metricsOutput);
    
    if (!parsedMetrics.Datapoints || !Array.isArray(parsedMetrics.Datapoints) || parsedMetrics.Datapoints.length === 0) {
      return 'No metric data points found.';
    }
    
    // Sort datapoints by timestamp
    parsedMetrics.Datapoints.sort((a: any, b: any) => {
      return new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime();
    });
    
    // Format the metrics as a JSON string
    const formattedMetrics = {
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      DataPoints: parsedMetrics.Datapoints.map((datapoint: any) => {
        return {
          Timestamp: datapoint.Timestamp,
          Average: datapoint.Average,
          Sum: datapoint.Sum,
          Maximum: datapoint.Maximum,
          Minimum: datapoint.Minimum,
          Unit: datapoint.Unit
        };
      })
    };
    
    return JSON.stringify(formattedMetrics, null, 2);
  } catch (error) {
    logger.error('Error parsing metrics:', error);
    return `Error parsing metrics: ${error instanceof Error ? error.message : String(error)}`;
  }
}
