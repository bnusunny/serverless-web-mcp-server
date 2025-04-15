import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

// Type for status update callback
type StatusCallback = (status: string) => void;

/**
 * Configure a custom domain for a deployed application
 */
export async function configureDomain(params: any, statusCallback?: StatusCallback): Promise<any> {
  const { projectName, domainName, createCertificate, createRoute53Records } = params;
  
  try {
    // Send status update
    sendStatus(statusCallback, `Starting domain configuration for ${projectName}...`);
    
    // Validate parameters
    if (!projectName) {
      throw new Error('projectName is required');
    }
    
    if (!domainName) {
      throw new Error('domainName is required');
    }
    
    // Step 1: Create or find ACM certificate
    let certificateArn;
    if (createCertificate) {
      sendStatus(statusCallback, `Creating ACM certificate for ${domainName}...`);
      certificateArn = await createAcmCertificate(domainName, statusCallback);
      
      sendStatus(statusCallback, `Waiting for certificate validation...`);
      await waitForCertificateValidation(certificateArn, statusCallback);
    } else {
      sendStatus(statusCallback, `Finding existing certificate for ${domainName}...`);
      certificateArn = await findExistingCertificate(domainName, statusCallback);
    }
    
    // Step 2: Update CloudFront distribution with the custom domain
    sendStatus(statusCallback, `Updating CloudFront distribution for ${projectName}...`);
    const distributionId = await updateCloudFrontDistribution(projectName, domainName, certificateArn, statusCallback);
    
    // Step 3: Create Route53 records if requested
    let route53Records;
    if (createRoute53Records) {
      sendStatus(statusCallback, `Creating Route 53 records for ${domainName}...`);
      route53Records = await createRoute53Records(domainName, distributionId, statusCallback);
    }
    
    // Return the result
    return {
      status: 'configured',
      projectName,
      domainName,
      certificate: {
        arn: certificateArn,
        status: 'ISSUED'
      },
      cloudFrontDistribution: {
        id: distributionId,
        domain: `${distributionId}.cloudfront.net`
      },
      route53Records: route53Records
    };
  } catch (error) {
    logger.error('Domain configuration failed:', error);
    sendStatus(statusCallback, `Domain configuration failed: ${error instanceof Error ? error.message : String(error)}`);
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
 * Create an ACM certificate for the domain
 */
async function createAcmCertificate(domainName: string, statusCallback?: StatusCallback): Promise<string> {
  try {
    // Request a certificate
    const requestResult = await executeAwsCommand([
      'acm', 'request-certificate',
      '--domain-name', domainName,
      '--validation-method', 'DNS',
      '--output', 'json'
    ], statusCallback);
    
    const response = JSON.parse(requestResult.stdout);
    const certificateArn = response.CertificateArn;
    
    if (!certificateArn) {
      throw new Error('Failed to create ACM certificate: No ARN returned');
    }
    
    sendStatus(statusCallback, `Certificate requested with ARN: ${certificateArn}`);
    return certificateArn;
  } catch (error) {
    throw new Error(`Failed to create ACM certificate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Wait for certificate validation
 */
async function waitForCertificateValidation(certificateArn: string, statusCallback?: StatusCallback): Promise<void> {
  try {
    sendStatus(statusCallback, `Waiting for certificate validation...`);
    
    // Use AWS CLI wait command
    await executeAwsCommand([
      'acm', 'wait', 'certificate-validated',
      '--certificate-arn', certificateArn
    ], statusCallback);
    
    sendStatus(statusCallback, `Certificate validated successfully.`);
  } catch (error) {
    throw new Error(`Certificate validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Find an existing certificate for the domain
 */
async function findExistingCertificate(domainName: string, statusCallback?: StatusCallback): Promise<string> {
  try {
    // List certificates
    const listResult = await executeAwsCommand([
      'acm', 'list-certificates',
      '--output', 'json'
    ], statusCallback);
    
    const response = JSON.parse(listResult.stdout);
    
    // Find a certificate for the domain
    const certificate = response.CertificateSummaryList?.find((cert: any) => 
      cert.DomainName === domainName && cert.Status === 'ISSUED'
    );
    
    if (!certificate) {
      throw new Error(`No existing certificate found for ${domainName}`);
    }
    
    sendStatus(statusCallback, `Found existing certificate with ARN: ${certificate.CertificateArn}`);
    return certificate.CertificateArn;
  } catch (error) {
    throw new Error(`Failed to find existing certificate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update CloudFront distribution with custom domain
 */
async function updateCloudFrontDistribution(
  projectName: string,
  domainName: string,
  certificateArn: string,
  statusCallback?: StatusCallback
): Promise<string> {
  try {
    // Step 1: Find the CloudFront distribution for the project
    sendStatus(statusCallback, `Finding CloudFront distribution for ${projectName}...`);
    
    const listResult = await executeAwsCommand([
      'cloudfront', 'list-distributions',
      '--output', 'json'
    ], statusCallback);
    
    const response = JSON.parse(listResult.stdout);
    
    // Find the distribution by looking for tags or aliases that match the project name
    const distribution = response.DistributionList?.Items?.find((dist: any) => {
      // Check if the distribution has a tag with the project name
      return dist.Origins.Items.some((origin: any) => 
        origin.DomainName.includes(`${projectName}-bucket`)
      );
    });
    
    if (!distribution) {
      throw new Error(`No CloudFront distribution found for ${projectName}`);
    }
    
    const distributionId = distribution.Id;
    sendStatus(statusCallback, `Found CloudFront distribution: ${distributionId}`);
    
    // Step 2: Get the distribution config
    const getConfigResult = await executeAwsCommand([
      'cloudfront', 'get-distribution-config',
      '--id', distributionId,
      '--output', 'json'
    ], statusCallback);
    
    const configResponse = JSON.parse(getConfigResult.stdout);
    const etag = configResponse.ETag;
    const config = configResponse.DistributionConfig;
    
    // Step 3: Update the distribution config
    config.Aliases = config.Aliases || {};
    config.Aliases.Quantity = (config.Aliases.Items?.length || 0) + 1;
    config.Aliases.Items = [...(config.Aliases.Items || []), domainName];
    
    // Update the SSL certificate
    config.ViewerCertificate = {
      ACMCertificateArn: certificateArn,
      SSLSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021'
    };
    
    // Step 4: Update the distribution
    sendStatus(statusCallback, `Updating CloudFront distribution with custom domain...`);
    
    await executeAwsCommand([
      'cloudfront', 'update-distribution',
      '--id', distributionId,
      '--distribution-config', JSON.stringify(config),
      '--if-match', etag,
      '--output', 'json'
    ], statusCallback);
    
    sendStatus(statusCallback, `CloudFront distribution updated successfully.`);
    
    return distributionId;
  } catch (error) {
    throw new Error(`Failed to update CloudFront distribution: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create Route53 records for the domain
 */
async function createRoute53Records(
  domainName: string,
  distributionId: string,
  statusCallback?: StatusCallback
): Promise<any[]> {
  try {
    // Step 1: Find the hosted zone for the domain
    sendStatus(statusCallback, `Finding Route 53 hosted zone for ${domainName}...`);
    
    const listZonesResult = await executeAwsCommand([
      'route53', 'list-hosted-zones',
      '--output', 'json'
    ], statusCallback);
    
    const zonesResponse = JSON.parse(listZonesResult.stdout);
    
    // Find the hosted zone that matches the domain
    const hostedZone = zonesResponse.HostedZones.find((zone: any) => {
      const zoneName = zone.Name.endsWith('.') ? zone.Name.slice(0, -1) : zone.Name;
      return domainName.endsWith(zoneName);
    });
    
    if (!hostedZone) {
      throw new Error(`No Route 53 hosted zone found for ${domainName}`);
    }
    
    const hostedZoneId = hostedZone.Id.replace('/hostedzone/', '');
    sendStatus(statusCallback, `Found Route 53 hosted zone: ${hostedZoneId}`);
    
    // Step 2: Create the record set
    const recordSetChanges = {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: domainName,
            Type: 'A',
            AliasTarget: {
              HostedZoneId: 'Z2FDTNDATAQYW2', // CloudFront's hosted zone ID
              DNSName: `${distributionId}.cloudfront.net`,
              EvaluateTargetHealth: false
            }
          }
        }
      ]
    };
    
    sendStatus(statusCallback, `Creating Route 53 record for ${domainName}...`);
    
    await executeAwsCommand([
      'route53', 'change-resource-record-sets',
      '--hosted-zone-id', hostedZoneId,
      '--change-batch', JSON.stringify(recordSetChanges),
      '--output', 'json'
    ], statusCallback);
    
    sendStatus(statusCallback, `Route 53 record created successfully.`);
    
    return [
      {
        name: domainName,
        type: 'A',
        alias: true,
        target: `${distributionId}.cloudfront.net`
      }
    ];
  } catch (error) {
    throw new Error(`Failed to create Route 53 records: ${error instanceof Error ? error.message : String(error)}`);
  }
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
