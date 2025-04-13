import { spawn } from 'child_process';

// Type for status update callback
type StatusCallback = (status: string) => void;

/**
 * Get logs for a deployed application
 */
export async function getLogs(params: any, statusCallback?: StatusCallback): Promise<string> {
  const { projectName, resourceType, startTime, endTime, limit } = params;
  
  try {
    // Send status update
    sendStatus(statusCallback, `Retrieving ${resourceType} logs for ${projectName}...`);
    
    // Validate parameters
    if (!projectName) {
      throw new Error('projectName is required');
    }
    
    if (!resourceType) {
      throw new Error('resourceType is required');
    }
    
    // Get the log group name based on resource type
    const logGroupName = getLogGroupName(projectName, resourceType);
    sendStatus(statusCallback, `Using log group: ${logGroupName}`);
    
    // Build the AWS CLI command for retrieving logs
    const awsCommand = buildAwsLogsCommand(logGroupName, startTime, endTime, limit);
    
    // Execute the AWS CLI command
    sendStatus(statusCallback, `Executing AWS CLI command to retrieve logs...`);
    const result = await executeAwsCommand(awsCommand, statusCallback);
    
    // Process and format the logs
    sendStatus(statusCallback, `Processing log events...`);
    const formattedLogs = formatLogs(result.stdout, resourceType);
    
    return formattedLogs;
  } catch (error) {
    console.error('Log retrieval failed:', error);
    sendStatus(statusCallback, `Log retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Send a status update via the callback if provided
 */
function sendStatus(callback?: StatusCallback, message?: string): void {
  if (callback && message) {
    callback(message);
    console.log(message); // Also log to console
  }
}

/**
 * Get the CloudWatch Logs log group name based on resource type
 */
function getLogGroupName(projectName: string, resourceType: string): string {
  switch (resourceType) {
    case 'lambda':
      return `/aws/lambda/${projectName}-function`;
    case 'api-gateway':
      return `API-Gateway-Execution-Logs/${projectName}-api/prod`;
    case 'cloudfront':
      // CloudFront logs are typically stored in S3, but we'll use a standard format for consistency
      return `aws-cloudfront/${projectName}-distribution`;
    default:
      throw new Error(`Unsupported resource type for logs: ${resourceType}`);
  }
}

/**
 * Build the AWS CLI command for retrieving logs
 */
function buildAwsLogsCommand(logGroupName: string, startTime?: string, endTime?: string, limit?: number): string[] {
  const command = ['logs', 'filter-log-events', '--log-group-name', logGroupName];
  
  // Add start time if provided
  if (startTime) {
    const startTimeMs = new Date(startTime).getTime();
    command.push('--start-time', startTimeMs.toString());
  }
  
  // Add end time if provided
  if (endTime) {
    const endTimeMs = new Date(endTime).getTime();
    command.push('--end-time', endTimeMs.toString());
  }
  
  // Add limit if provided
  if (limit) {
    command.push('--limit', limit.toString());
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
 * Format logs from AWS CLI output
 */
function formatLogs(logsOutput: string, resourceType: string): string {
  try {
    const parsedLogs = JSON.parse(logsOutput);
    
    if (!parsedLogs.events || !Array.isArray(parsedLogs.events)) {
      return 'No log events found.';
    }
    
    // Format logs based on resource type
    switch (resourceType) {
      case 'lambda':
        return formatLambdaLogs(parsedLogs.events);
      case 'api-gateway':
        return formatApiGatewayLogs(parsedLogs.events);
      case 'cloudfront':
        return formatCloudfrontLogs(parsedLogs.events);
      default:
        return parsedLogs.events.map((event: any) => {
          const timestamp = new Date(event.timestamp).toISOString();
          return `${timestamp} ${event.message}`;
        }).join('\n');
    }
  } catch (error) {
    console.error('Error parsing logs:', error);
    return `Error parsing logs: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Format Lambda logs
 */
function formatLambdaLogs(events: any[]): string {
  return events.map((event: any) => {
    const timestamp = new Date(event.timestamp).toISOString();
    return `${timestamp} ${event.message.trim()}`;
  }).join('\n');
}

/**
 * Format API Gateway logs
 */
function formatApiGatewayLogs(events: any[]): string {
  return events.map((event: any) => {
    const timestamp = new Date(event.timestamp).toISOString();
    return `${timestamp} ${event.message.trim()}`;
  }).join('\n');
}

/**
 * Format CloudFront logs
 */
function formatCloudfrontLogs(events: any[]): string {
  return events.map((event: any) => {
    const timestamp = new Date(event.timestamp).toISOString();
    return `${timestamp} ${event.message.trim()}`;
  }).join('\n');
}
