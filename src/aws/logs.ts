/**
 * Retrieve application logs from CloudWatch
 */

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
    
    // Mock log retrieval process with status updates
    await mockLogRetrieval(projectName, resourceType, statusCallback);
    
    // Return mock logs based on resource type
    return generateMockLogs(projectName, resourceType, limit || 100);
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
 * Mock log retrieval process with status updates
 */
async function mockLogRetrieval(
  projectName: string,
  resourceType: string,
  statusCallback?: StatusCallback
): Promise<void> {
  sendStatus(statusCallback, `Connecting to CloudWatch Logs...`);
  await delay(500);
  
  let logGroupName = '';
  
  switch (resourceType) {
    case 'lambda':
      logGroupName = `/aws/lambda/${projectName}-function`;
      break;
    case 'api-gateway':
      logGroupName = `API-Gateway-Execution-Logs/${projectName}-api/prod`;
      break;
    case 'cloudfront':
      logGroupName = `aws-cloudfront/distribution-id`;
      break;
    default:
      throw new Error(`Unsupported resource type for logs: ${resourceType}`);
  }
  
  sendStatus(statusCallback, `Querying log group: ${logGroupName}...`);
  await delay(1000);
  
  sendStatus(statusCallback, `Processing log events...`);
  await delay(500);
}

/**
 * Generate mock logs based on resource type
 */
function generateMockLogs(projectName: string, resourceType: string, limit: number): string {
  const logs: string[] = [];
  const now = new Date();
  
  for (let i = 0; i < limit; i++) {
    const timestamp = new Date(now.getTime() - (i * 1000));
    const timestampStr = timestamp.toISOString();
    
    switch (resourceType) {
      case 'lambda':
        logs.push(`${timestampStr} START RequestId: ${generateRequestId()} Version: $LATEST`);
        logs.push(`${timestampStr} ${Math.random() > 0.8 ? 'ERROR' : 'INFO'} ${generateLambdaLogMessage(projectName)}`);
        logs.push(`${timestampStr} END RequestId: ${generateRequestId()}`);
        logs.push(`${timestampStr} REPORT RequestId: ${generateRequestId()} Duration: ${Math.floor(Math.random() * 1000)} ms Billed Duration: ${Math.floor(Math.random() * 1000)} ms Memory Size: 512 MB Max Memory Used: ${Math.floor(Math.random() * 512)} MB`);
        break;
        
      case 'api-gateway':
        logs.push(`${timestampStr} ${generateApiGatewayLogMessage(projectName)}`);
        break;
        
      case 'cloudfront':
        logs.push(`${timestampStr} ${generateCloudfrontLogMessage()}`);
        break;
    }
  }
  
  return logs.join('\n');
}

/**
 * Generate a random request ID
 */
function generateRequestId(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Generate a mock Lambda log message
 */
function generateLambdaLogMessage(projectName: string): string {
  const messages = [
    `Processing request for ${projectName}`,
    `Received event: {"path":"/api/items","httpMethod":"GET","headers":{"Accept":"*/*"}}`,
    `Database query completed in ${Math.floor(Math.random() * 100)} ms`,
    `Retrieved ${Math.floor(Math.random() * 100)} items from database`,
    `Cache hit ratio: ${(Math.random() * 100).toFixed(2)}%`,
    `Error: Connection timed out after ${Math.floor(Math.random() * 5000)} ms`,
    `Warning: Slow database query detected (${Math.floor(Math.random() * 1000)} ms)`,
    `Authentication successful for user id: user-${Math.floor(Math.random() * 1000)}`,
    `Request completed with status code: ${Math.random() > 0.9 ? 500 : 200}`
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Generate a mock API Gateway log message
 */
function generateApiGatewayLogMessage(projectName: string): string {
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const paths = ['/api/items', '/api/users', '/api/auth', '/api/settings'];
  const statusCodes = [200, 201, 400, 401, 403, 404, 500];
  const ipAddresses = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '8.8.8.8'];
  
  const method = methods[Math.floor(Math.random() * methods.length)];
  const path = paths[Math.floor(Math.random() * paths.length)];
  const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];
  const ipAddress = ipAddresses[Math.floor(Math.random() * ipAddresses.length)];
  const latency = Math.floor(Math.random() * 1000);
  
  return `${ipAddress} - - [${new Date().toISOString()}] "${method} ${path} HTTP/1.1" ${statusCode} ${Math.floor(Math.random() * 10000)} "${projectName}-api" "${latency} ms"`;
}

/**
 * Generate a mock CloudFront log message
 */
function generateCloudfrontLogMessage(): string {
  const methods = ['GET', 'HEAD'];
  const resources = ['/index.html', '/static/js/main.js', '/static/css/main.css', '/images/logo.png', '/favicon.ico'];
  const statusCodes = [200, 304, 403, 404];
  const referrers = ['-', 'https://www.google.com/', 'https://www.example.com/'];
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  ];
  
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const time = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '');
  const edgeLocation = ['IAD79-C1', 'SFO20-C2', 'LHR62-P3'][Math.floor(Math.random() * 3)];
  const bytesSent = Math.floor(Math.random() * 100000);
  const ipAddress = `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
  const method = methods[Math.floor(Math.random() * methods.length)];
  const host = 'd1234abcdef.cloudfront.net';
  const resource = resources[Math.floor(Math.random() * resources.length)];
  const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];
  const referrer = referrers[Math.floor(Math.random() * referrers.length)];
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  
  return `${date}\t${time}\t${edgeLocation}\t${bytesSent}\t${ipAddress}\t${method}\t${host}\t${resource}\t${statusCode}\t${referrer}\t${userAgent}`;
}

/**
 * Helper function to simulate async operations
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
