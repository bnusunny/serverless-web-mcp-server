import { execSync } from 'child_process';
import { loadConfig } from '../config.js';

// Define log retrieval parameters interface
export interface LogParams {
  projectName: string;
  resourceType: 'lambda' | 'api-gateway' | 'cloudfront';
  startTime?: string;
  endTime?: string;
  limit: number;
}

/**
 * Retrieve application logs from CloudWatch
 */
export async function getLogs(params: LogParams): Promise<string> {
  const config = loadConfig();
  const { projectName, resourceType, startTime, endTime, limit } = params;
  
  try {
    // Get log group name based on resource type
    const logGroupName = getLogGroupName(projectName, resourceType);
    
    // Build query command
    let command = `aws logs filter-log-events --log-group-name ${logGroupName} --limit ${limit} --region ${config.aws.region}`;
    
    // Add time filters if provided
    if (startTime) {
      const startTimeMs = new Date(startTime).getTime();
      command += ` --start-time ${startTimeMs}`;
    }
    
    if (endTime) {
      const endTimeMs = new Date(endTime).getTime();
      command += ` --end-time ${endTimeMs}`;
    }
    
    // Execute command
    const output = execSync(command, { encoding: 'utf8' });
    const logData = JSON.parse(output);
    
    // Format log events
    return formatLogEvents(logData.events || []);
  } catch (error) {
    console.error('Failed to retrieve logs:', error);
    throw new Error(`Failed to retrieve logs for ${resourceType} in project ${projectName}`);
  }
}

/**
 * Get CloudWatch log group name based on resource type
 */
function getLogGroupName(projectName: string, resourceType: string): string {
  switch (resourceType) {
    case 'lambda':
      return `/aws/lambda/${projectName}-function`;
    case 'api-gateway':
      return `API-Gateway-Execution-Logs_${getApiId(projectName)}/prod`;
    case 'cloudfront':
      return `/aws/cloudfront/${projectName}-distribution`;
    default:
      throw new Error(`Unsupported resource type for logs: ${resourceType}`);
  }
}

/**
 * Get API Gateway ID for a project
 */
function getApiId(projectName: string): string {
  try {
    const output = execSync(
      `aws cloudformation describe-stack-resources --stack-name ${projectName} --logical-resource-id Api --query "StackResources[0].PhysicalResourceId" --output text`,
      { encoding: 'utf8' }
    );
    
    return output.trim();
  } catch (error) {
    throw new Error(`Failed to get API Gateway ID for project ${projectName}`);
  }
}

/**
 * Format log events into readable text
 */
function formatLogEvents(events: any[]): string {
  if (events.length === 0) {
    return 'No log events found.';
  }
  
  return events.map(event => {
    const timestamp = new Date(event.timestamp).toISOString();
    return `[${timestamp}] ${event.message}`;
  }).join('\n');
}
