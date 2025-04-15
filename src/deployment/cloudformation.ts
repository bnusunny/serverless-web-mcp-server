import { CloudFormationClient, DescribeStacksCommand, ListStackResourcesCommand } from "@aws-sdk/client-cloudformation";
import { logger } from '../utils/logger.js';

/**
 * Get CloudFormation stack status and outputs
 * @param stackName The name of the CloudFormation stack
 * @param region AWS region
 * @returns Stack information including status, outputs, and resources
 */
export async function getStackInfo(stackName: string, region: string): Promise<any> {
  try {
    logger.info(`Getting CloudFormation stack info for ${stackName} in ${region}`);
    
    const client = new CloudFormationClient({ region });
    
    // Get stack details including outputs
    const describeCommand = new DescribeStacksCommand({
      StackName: stackName
    });
    
    const stackResponse = await client.send(describeCommand);
    const stack = stackResponse.Stacks?.[0];
    
    if (!stack) {
      logger.warn(`Stack ${stackName} not found in region ${region}`);
      return {
        status: 'NOT_FOUND',
        message: `Stack ${stackName} not found in region ${region}`
      };
    }
    
    // Format outputs as key-value pairs
    const outputs: Record<string, string> = {};
    if (stack.Outputs) {
      for (const output of stack.Outputs) {
        if (output.OutputKey && output.OutputValue) {
          outputs[output.OutputKey] = output.OutputValue;
        }
      }
    }
    
    // Get stack resources
    const resourcesCommand = new ListStackResourcesCommand({
      StackName: stackName
    });
    
    const resourcesResponse = await client.send(resourcesCommand);
    const resources = resourcesResponse.StackResourceSummaries?.map((resource: any) => ({
      logicalId: resource.LogicalResourceId,
      physicalId: resource.PhysicalResourceId,
      type: resource.ResourceType,
      status: resource.ResourceStatus,
      lastUpdated: resource.LastUpdatedTimestamp
    })) || [];
    
    return {
      stackId: stack.StackId,
      stackName: stack.StackName,
      status: stack.StackStatus,
      statusReason: stack.StackStatusReason,
      creationTime: stack.CreationTime,
      lastUpdatedTime: stack.LastUpdatedTime,
      outputs,
      resources,
      tags: stack.Tags?.reduce((acc: Record<string, string>, tag: any) => {
        if (tag.Key && tag.Value) {
          acc[tag.Key] = tag.Value;
        }
        return acc;
      }, {}) || {}
    };
  } catch (error) {
    if ((error as any).name === 'ValidationError' && (error as any).message.includes('does not exist')) {
      logger.warn(`Stack ${stackName} not found in region ${region}`);
      return {
        status: 'NOT_FOUND',
        message: `Stack ${stackName} not found in region ${region}`
      };
    }
    
    logger.error(`Error getting CloudFormation stack info for ${stackName}:`, error);
    throw error;
  }
}

/**
 * Check if a CloudFormation stack exists
 * @param stackName The name of the CloudFormation stack
 * @param region AWS region
 * @returns Boolean indicating if the stack exists
 */
export async function stackExists(stackName: string, region: string): Promise<boolean> {
  try {
    const client = new CloudFormationClient({ region });
    const command = new DescribeStacksCommand({
      StackName: stackName
    });
    
    await client.send(command);
    return true;
  } catch (error) {
    if ((error as any).name === 'ValidationError' && (error as any).message.includes('does not exist')) {
      return false;
    }
    throw error;
  }
}

/**
 * Map CloudFormation stack status to a simplified status
 * @param cfStatus CloudFormation stack status
 * @returns Simplified status string
 */
export function mapCloudFormationStatus(cfStatus: string): 'in_progress' | 'completed' | 'failed' | 'deleted' | 'unknown' {
  if (!cfStatus) return 'unknown';
  
  const status = cfStatus.toUpperCase();
  
  if (status.includes('IN_PROGRESS')) {
    return 'in_progress';
  } else if (status.includes('COMPLETE') && !status.includes('FAILED')) {
    return 'completed';
  } else if (status.includes('FAILED') || status.includes('ROLLBACK')) {
    return 'failed';
  } else if (status.includes('DELETE')) {
    return 'deleted';
  } else {
    return 'unknown';
  }
}
