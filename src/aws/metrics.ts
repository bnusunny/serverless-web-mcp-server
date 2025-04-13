/**
 * Fetch performance metrics for deployed applications
 */

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
    
    // Mock metrics retrieval process with status updates
    await mockMetricsRetrieval(projectName, resourceType, metricName, statusCallback);
    
    // Return mock metrics based on resource type and metric name
    return generateMockMetrics(projectName, resourceType, metricName, period || 60);
  } catch (error) {
    console.error('Metrics retrieval failed:', error);
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
    console.log(message); // Also log to console
  }
}

/**
 * Mock metrics retrieval process with status updates
 */
async function mockMetricsRetrieval(
  projectName: string,
  resourceType: string,
  metricName: string,
  statusCallback?: StatusCallback
): Promise<void> {
  sendStatus(statusCallback, `Connecting to CloudWatch Metrics...`);
  await delay(500);
  
  let namespace = '';
  let dimensionName = '';
  let dimensionValue = '';
  
  switch (resourceType) {
    case 'lambda':
      namespace = 'AWS/Lambda';
      dimensionName = 'FunctionName';
      dimensionValue = `${projectName}-function`;
      break;
    case 'api-gateway':
      namespace = 'AWS/ApiGateway';
      dimensionName = 'ApiName';
      dimensionValue = `${projectName}-api`;
      break;
    case 'cloudfront':
      namespace = 'AWS/CloudFront';
      dimensionName = 'DistributionId';
      dimensionValue = 'E1A2B3C4D5E6F7';
      break;
    case 's3':
      namespace = 'AWS/S3';
      dimensionName = 'BucketName';
      dimensionValue = `${projectName}-bucket`;
      break;
    default:
      throw new Error(`Unsupported resource type for metrics: ${resourceType}`);
  }
  
  sendStatus(statusCallback, `Querying metrics in namespace: ${namespace}...`);
  await delay(500);
  
  sendStatus(statusCallback, `Retrieving ${metricName} for ${dimensionName}=${dimensionValue}...`);
  await delay(1000);
  
  sendStatus(statusCallback, `Processing metric data points...`);
  await delay(500);
}

/**
 * Generate mock metrics based on resource type and metric name
 */
function generateMockMetrics(projectName: string, resourceType: string, metricName: string, period: number): string {
  const now = new Date();
  const dataPoints: any[] = [];
  
  // Generate 24 data points (covering last 24 periods)
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - (i * period * 1000));
    
    let value = 0;
    
    // Generate appropriate mock values based on resource type and metric name
    switch (resourceType) {
      case 'lambda':
        if (metricName === 'Invocations') {
          value = Math.floor(Math.random() * 100);
        } else if (metricName === 'Duration') {
          value = Math.floor(Math.random() * 1000);
        } else if (metricName === 'Errors') {
          value = Math.floor(Math.random() * 5);
        } else if (metricName === 'Throttles') {
          value = Math.floor(Math.random() * 2);
        } else if (metricName === 'ConcurrentExecutions') {
          value = Math.floor(Math.random() * 10);
        }
        break;
        
      case 'api-gateway':
        if (metricName === 'Count') {
          value = Math.floor(Math.random() * 200);
        } else if (metricName === 'Latency') {
          value = Math.floor(Math.random() * 500);
        } else if (metricName === '4XXError') {
          value = Math.floor(Math.random() * 10);
        } else if (metricName === '5XXError') {
          value = Math.floor(Math.random() * 5);
        }
        break;
        
      case 'cloudfront':
        if (metricName === 'Requests') {
          value = Math.floor(Math.random() * 1000);
        } else if (metricName === 'BytesDownloaded') {
          value = Math.floor(Math.random() * 1000000);
        } else if (metricName === 'BytesUploaded') {
          value = Math.floor(Math.random() * 100000);
        } else if (metricName === '4xxErrorRate') {
          value = Math.random() * 0.05;
        } else if (metricName === '5xxErrorRate') {
          value = Math.random() * 0.02;
        }
        break;
        
      case 's3':
        if (metricName === 'BucketSizeBytes') {
          value = Math.floor(Math.random() * 10000000);
        } else if (metricName === 'NumberOfObjects') {
          value = Math.floor(Math.random() * 1000);
        } else if (metricName === 'AllRequests') {
          value = Math.floor(Math.random() * 500);
        } else if (metricName === 'GetRequests') {
          value = Math.floor(Math.random() * 400);
        } else if (metricName === 'PutRequests') {
          value = Math.floor(Math.random() * 100);
        }
        break;
    }
    
    dataPoints.push({
      Timestamp: timestamp.toISOString(),
      Value: value,
      Unit: getMetricUnit(metricName)
    });
  }
  
  // Format the metrics as a JSON string
  const metrics = {
    Namespace: `AWS/${resourceType === 'api-gateway' ? 'ApiGateway' : resourceType === 's3' ? 'S3' : resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`,
    MetricName: metricName,
    Dimensions: [
      {
        Name: getDimensionName(resourceType),
        Value: getDimensionValue(resourceType, projectName)
      }
    ],
    DataPoints: dataPoints
  };
  
  return JSON.stringify(metrics, null, 2);
}

/**
 * Get the appropriate dimension name for a resource type
 */
function getDimensionName(resourceType: string): string {
  switch (resourceType) {
    case 'lambda':
      return 'FunctionName';
    case 'api-gateway':
      return 'ApiName';
    case 'cloudfront':
      return 'DistributionId';
    case 's3':
      return 'BucketName';
    default:
      return 'ResourceName';
  }
}

/**
 * Get the appropriate dimension value for a resource type and project
 */
function getDimensionValue(resourceType: string, projectName: string): string {
  switch (resourceType) {
    case 'lambda':
      return `${projectName}-function`;
    case 'api-gateway':
      return `${projectName}-api`;
    case 'cloudfront':
      return 'E1A2B3C4D5E6F7';
    case 's3':
      return `${projectName}-bucket`;
    default:
      return projectName;
  }
}

/**
 * Get the appropriate unit for a metric
 */
function getMetricUnit(metricName: string): string {
  if (metricName.includes('Latency') || metricName === 'Duration') {
    return 'Milliseconds';
  } else if (metricName.includes('Bytes')) {
    return 'Bytes';
  } else if (metricName.includes('Rate')) {
    return 'Percent';
  } else {
    return 'Count';
  }
}

/**
 * Helper function to simulate async operations
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
