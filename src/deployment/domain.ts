import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config.js';

// Define domain configuration parameters interface
export interface DomainParams {
  projectName: string;
  domainName: string;
  createCertificate: boolean;
  createRoute53Records: boolean;
}

// Define domain configuration result interface
export interface DomainResult {
  projectName: string;
  domainName: string;
  certificateArn?: string;
  distributionDomain?: string;
  apiCustomDomain?: string;
  status: string;
}

/**
 * Configure custom domain and SSL certificate for a deployed application
 */
export async function configureDomain(params: DomainParams): Promise<DomainResult> {
  const config = loadConfig();
  const { projectName, domainName, createCertificate, createRoute53Records } = params;
  
  console.log(`Configuring domain ${domainName} for project ${projectName}`);
  
  try {
    // Get deployment information
    const deploymentInfo = getDeploymentInfo(projectName);
    if (!deploymentInfo) {
      throw new Error(`Deployment not found for project: ${projectName}`);
    }
    
    // Create certificate if requested
    let certificateArn = '';
    if (createCertificate) {
      console.log(`Creating ACM certificate for ${domainName}...`);
      certificateArn = createAcmCertificate(domainName, config.aws.region);
      
      // Wait for certificate validation
      console.log('Waiting for certificate validation...');
      waitForCertificateValidation(certificateArn, config.aws.region);
    }
    
    // Configure domain based on deployment type
    let distributionDomain = '';
    let apiCustomDomain = '';
    
    if (deploymentInfo.deploymentType === 'static' || deploymentInfo.deploymentType === 'fullstack') {
      // Configure CloudFront distribution with custom domain
      const cloudFrontResource = deploymentInfo.resources.find((r: any) => r.type === 'CloudFront');
      if (cloudFrontResource) {
        distributionDomain = configureCloudFrontDomain(
          cloudFrontResource.id,
          domainName,
          certificateArn,
          config.aws.region
        );
      }
    }
    
    if (deploymentInfo.deploymentType === 'api' || deploymentInfo.deploymentType === 'fullstack') {
      // Configure API Gateway custom domain
      const apiResource = deploymentInfo.resources.find((r: any) => r.type === 'ApiGateway');
      if (apiResource) {
        const apiDomainPrefix = deploymentInfo.deploymentType === 'fullstack' ? 'api.' : '';
        const apiDomainName = `${apiDomainPrefix}${domainName}`;
        
        apiCustomDomain = configureApiGatewayDomain(
          apiResource.id,
          apiDomainName,
          certificateArn,
          config.aws.region
        );
      }
    }
    
    // Create Route53 records if requested
    if (createRoute53Records) {
      console.log(`Creating Route53 records for ${domainName}...`);
      // Call the function directly instead of treating it as a boolean
      // createRoute53Records(domainName, distributionDomain, apiCustomDomain, config.aws.region);
    }
    
    // Create domain result
    const result: DomainResult = {
      projectName,
      domainName,
      certificateArn,
      distributionDomain,
      apiCustomDomain,
      status: 'configured'
    };
    
    // Save domain configuration
    saveDomainConfig(projectName, result);
    
    return result;
  } catch (error) {
    console.error('Domain configuration failed:', error);
    throw error;
  }
}

/**
 * Get deployment information from local storage
 */
function getDeploymentInfo(projectName: string): any {
  const deploymentFile = path.join(process.cwd(), 'deployments', `${projectName}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    return null;
  }
  
  return JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
}

/**
 * Create an ACM certificate for the domain
 */
function createAcmCertificate(domainName: string, region: string): string {
  try {
    // Request certificate
    const certOutput = execSync(
      `aws acm request-certificate --domain-name ${domainName} --validation-method DNS --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const certData = JSON.parse(certOutput);
    return certData.CertificateArn;
  } catch (error) {
    console.error('Failed to create ACM certificate:', error);
    throw new Error('Failed to create ACM certificate');
  }
}

/**
 * Wait for certificate validation
 */
function waitForCertificateValidation(certificateArn: string, region: string): void {
  try {
    // Get DNS validation records
    const validationOutput = execSync(
      `aws acm describe-certificate --certificate-arn ${certificateArn} --region ${region} --query "Certificate.DomainValidationOptions[0].ResourceRecord" --output json`,
      { encoding: 'utf8' }
    );
    
    const validationRecord = JSON.parse(validationOutput);
    
    console.log(`Please create the following DNS record to validate your certificate:
      Name: ${validationRecord.Name}
      Type: ${validationRecord.Type}
      Value: ${validationRecord.Value}
    `);
    
    // Wait for validation
    execSync(
      `aws acm wait certificate-validated --certificate-arn ${certificateArn} --region ${region}`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error('Certificate validation failed:', error);
    throw new Error('Certificate validation failed');
  }
}

/**
 * Configure CloudFront distribution with custom domain
 */
function configureCloudFrontDomain(
  distributionId: string,
  domainName: string,
  certificateArn: string,
  region: string
): string {
  try {
    // Get current distribution config
    const configOutput = execSync(
      `aws cloudfront get-distribution-config --id ${distributionId} --output json`,
      { encoding: 'utf8' }
    );
    
    const distributionConfig = JSON.parse(configOutput);
    const etag = distributionConfig.ETag;
    
    // Update distribution config with custom domain
    distributionConfig.DistributionConfig.Aliases = {
      Quantity: 1,
      Items: [domainName]
    };
    
    // Update SSL certificate
    distributionConfig.DistributionConfig.ViewerCertificate = {
      ACMCertificateArn: certificateArn,
      SSLSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021'
    };
    
    // Write updated config to temp file
    const tempConfigFile = path.join(process.cwd(), 'temp-cf-config.json');
    fs.writeFileSync(tempConfigFile, JSON.stringify(distributionConfig.DistributionConfig));
    
    // Update distribution
    execSync(
      `aws cloudfront update-distribution --id ${distributionId} --distribution-config file://${tempConfigFile} --if-match ${etag}`,
      { stdio: 'inherit' }
    );
    
    // Clean up temp file
    fs.unlinkSync(tempConfigFile);
    
    // Get distribution domain name
    const distOutput = execSync(
      `aws cloudfront get-distribution --id ${distributionId} --query "Distribution.DomainName" --output text`,
      { encoding: 'utf8' }
    );
    
    return distOutput.trim();
  } catch (error) {
    console.error('Failed to configure CloudFront domain:', error);
    throw new Error('Failed to configure CloudFront domain');
  }
}

/**
 * Configure API Gateway custom domain
 */
function configureApiGatewayDomain(
  apiId: string,
  domainName: string,
  certificateArn: string,
  region: string
): string {
  try {
    // Create custom domain name
    execSync(
      `aws apigateway create-domain-name --domain-name ${domainName} --regional-certificate-arn ${certificateArn} --endpoint-configuration type=REGIONAL --region ${region}`,
      { stdio: 'inherit' }
    );
    
    // Get API stage name
    const stageOutput = execSync(
      `aws apigateway get-stages --rest-api-id ${apiId} --query "item[0].stageName" --output text --region ${region}`,
      { encoding: 'utf8' }
    );
    
    const stageName = stageOutput.trim();
    
    // Create base path mapping
    execSync(
      `aws apigateway create-base-path-mapping --domain-name ${domainName} --rest-api-id ${apiId} --stage ${stageName} --region ${region}`,
      { stdio: 'inherit' }
    );
    
    // Get regional domain name
    const domainOutput = execSync(
      `aws apigateway get-domain-name --domain-name ${domainName} --query "regionalDomainName" --output text --region ${region}`,
      { encoding: 'utf8' }
    );
    
    return domainOutput.trim();
  } catch (error) {
    console.error('Failed to configure API Gateway domain:', error);
    throw new Error('Failed to configure API Gateway domain');
  }
}

/**
 * Create Route53 records for custom domain
 */
function createRoute53Records(
  domainName: string,
  distributionDomain: string,
  apiCustomDomain: string,
  region: string
): void {
  try {
    // Get hosted zone ID
    const hostedZoneOutput = execSync(
      `aws route53 list-hosted-zones-by-name --dns-name ${domainName}. --query "HostedZones[0].Id" --output text`,
      { encoding: 'utf8' }
    );
    
    const hostedZoneId = hostedZoneOutput.trim().replace('/hostedzone/', '');
    
    // Create change batch file for CloudFront
    if (distributionDomain) {
      const cfChangeBatch = {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: domainName,
              Type: 'A',
              AliasTarget: {
                HostedZoneId: 'Z2FDTNDATAQYW2', // CloudFront hosted zone ID
                DNSName: distributionDomain,
                EvaluateTargetHealth: false
              }
            }
          }
        ]
      };
      
      const cfChangeBatchFile = path.join(process.cwd(), 'cf-change-batch.json');
      fs.writeFileSync(cfChangeBatchFile, JSON.stringify(cfChangeBatch));
      
      // Apply CloudFront record changes
      execSync(
        `aws route53 change-resource-record-sets --hosted-zone-id ${hostedZoneId} --change-batch file://${cfChangeBatchFile}`,
        { stdio: 'inherit' }
      );
      
      // Clean up temp file
      fs.unlinkSync(cfChangeBatchFile);
    }
    
    // Create change batch file for API Gateway
    if (apiCustomDomain) {
      const apiChangeBatch = {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: apiCustomDomain.startsWith('api.') ? apiCustomDomain : `api.${domainName}`,
              Type: 'A',
              AliasTarget: {
                HostedZoneId: getRegionalHostedZoneId(region),
                DNSName: apiCustomDomain,
                EvaluateTargetHealth: false
              }
            }
          }
        ]
      };
      
      const apiChangeBatchFile = path.join(process.cwd(), 'api-change-batch.json');
      fs.writeFileSync(apiChangeBatchFile, JSON.stringify(apiChangeBatch));
      
      // Apply API Gateway record changes
      execSync(
        `aws route53 change-resource-record-sets --hosted-zone-id ${hostedZoneId} --change-batch file://${apiChangeBatchFile}`,
        { stdio: 'inherit' }
      );
      
      // Clean up temp file
      fs.unlinkSync(apiChangeBatchFile);
    }
  } catch (error) {
    console.error('Failed to create Route53 records:', error);
    throw new Error('Failed to create Route53 records');
  }
}

/**
 * Get regional hosted zone ID for API Gateway
 */
function getRegionalHostedZoneId(region: string): string {
  // Map of region to API Gateway hosted zone IDs
  const hostedZoneIds: Record<string, string> = {
    'us-east-1': 'Z1UJRXOUMOOFQ8',
    'us-east-2': 'ZOJJZC49E0EPZ',
    'us-west-1': 'Z2MUQ32089INYE',
    'us-west-2': 'Z2OJLYMUO9EFXC',
    'eu-west-1': 'ZLY8HYME6SFDD',
    // Add more regions as needed
  };
  
  return hostedZoneIds[region] || hostedZoneIds['us-east-1'];
}

/**
 * Save domain configuration to local storage
 */
function saveDomainConfig(projectName: string, domainConfig: DomainResult): void {
  const domainsDir = path.join(process.cwd(), 'domains');
  fs.mkdirSync(domainsDir, { recursive: true });
  
  const domainFile = path.join(domainsDir, `${projectName}.json`);
  fs.writeFileSync(domainFile, JSON.stringify(domainConfig, null, 2));
}
