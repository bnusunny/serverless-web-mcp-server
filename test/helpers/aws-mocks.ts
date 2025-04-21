/**
 * AWS Service Mocks
 * 
 * Provides utilities for mocking AWS services in tests
 */

import { mockClient } from 'aws-sdk-mock';
import AWS from 'aws-sdk';

/**
 * Mock CloudFormation service
 * @returns Mocked CloudFormation client
 */
export function mockCloudFormation() {
  mockClient(AWS.CloudFormation);
  
  AWS.CloudFormation.prototype.describeStacks = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Stacks: [{
          StackName: 'test-stack',
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [
            { OutputKey: 'ApiUrl', OutputValue: 'https://api.example.com' },
            { OutputKey: 'FunctionName', OutputValue: 'test-function' }
          ]
        }]
      })
    };
  });
  
  AWS.CloudFormation.prototype.listStacks = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        StackSummaries: [
          {
            StackName: 'test-api',
            StackStatus: 'CREATE_COMPLETE',
            CreationTime: new Date('2023-01-01T00:00:00Z'),
            TemplateDescription: 'Test API Stack'
          },
          {
            StackName: 'test-website',
            StackStatus: 'CREATE_COMPLETE',
            CreationTime: new Date('2023-01-02T00:00:00Z'),
            TemplateDescription: 'Test Website Stack'
          }
        ]
      })
    };
  });
  
  return AWS.CloudFormation;
}

/**
 * Mock S3 service
 * @returns Mocked S3 client
 */
export function mockS3() {
  mockClient(AWS.S3);
  
  AWS.S3.prototype.putObject = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({ ETag: '"mock-etag"' })
    };
  });
  
  AWS.S3.prototype.upload = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({ Location: 'https://bucket.s3.amazonaws.com/key' })
    };
  });
  
  AWS.S3.prototype.listObjectsV2 = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Contents: [
          { Key: 'index.html', Size: 1024, LastModified: new Date() },
          { Key: 'assets/main.js', Size: 2048, LastModified: new Date() }
        ]
      })
    };
  });
  
  return AWS.S3;
}

/**
 * Mock CloudFront service
 * @returns Mocked CloudFront client
 */
export function mockCloudFront() {
  mockClient(AWS.CloudFront);
  
  AWS.CloudFront.prototype.createInvalidation = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Invalidation: {
          Id: 'mock-invalidation-id',
          Status: 'InProgress'
        }
      })
    };
  });
  
  AWS.CloudFront.prototype.getDistribution = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Distribution: {
          Id: 'mock-distribution-id',
          DomainName: 'd123456abcdef8.cloudfront.net',
          Status: 'Deployed'
        }
      })
    };
  });
  
  return AWS.CloudFront;
}

/**
 * Mock DynamoDB service
 * @returns Mocked DynamoDB client
 */
export function mockDynamoDB() {
  mockClient(AWS.DynamoDB);
  
  AWS.DynamoDB.prototype.createTable = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        TableDescription: {
          TableName: 'test-table',
          TableStatus: 'CREATING'
        }
      })
    };
  });
  
  AWS.DynamoDB.prototype.describeTable = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Table: {
          TableName: 'test-table',
          TableStatus: 'ACTIVE'
        }
      })
    };
  });
  
  return AWS.DynamoDB;
}

/**
 * Mock Lambda service
 * @returns Mocked Lambda client
 */
export function mockLambda() {
  mockClient(AWS.Lambda);
  
  AWS.Lambda.prototype.getFunction = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Configuration: {
          FunctionName: 'test-function',
          Runtime: 'nodejs18.x',
          Handler: 'index.handler'
        }
      })
    };
  });
  
  AWS.Lambda.prototype.updateFunctionCode = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        FunctionName: 'test-function',
        LastModified: new Date().toISOString()
      })
    };
  });
  
  return AWS.Lambda;
}

/**
 * Mock API Gateway service
 * @returns Mocked API Gateway client
 */
export function mockAPIGateway() {
  mockClient(AWS.APIGateway);
  
  AWS.APIGateway.prototype.getRestApis = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        items: [
          {
            id: 'api123',
            name: 'test-api',
            description: 'Test API'
          }
        ]
      })
    };
  });
  
  return AWS.APIGateway;
}

/**
 * Mock CloudWatch service
 * @returns Mocked CloudWatch client
 */
export function mockCloudWatch() {
  mockClient(AWS.CloudWatch);
  
  AWS.CloudWatch.prototype.getMetricData = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        MetricDataResults: [
          {
            Id: 'cpu',
            Label: 'CPUUtilization',
            Values: [1.0, 2.0, 3.0],
            Timestamps: [
              new Date('2023-01-01T00:00:00Z'),
              new Date('2023-01-01T00:05:00Z'),
              new Date('2023-01-01T00:10:00Z')
            ]
          }
        ]
      })
    };
  });
  
  return AWS.CloudWatch;
}

/**
 * Mock CloudWatch Logs service
 * @returns Mocked CloudWatch Logs client
 */
export function mockCloudWatchLogs() {
  mockClient(AWS.CloudWatchLogs);
  
  AWS.CloudWatchLogs.prototype.filterLogEvents = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        events: [
          {
            message: 'INFO: Application started',
            timestamp: Date.now() - 60000,
            logStreamName: 'stream1'
          },
          {
            message: 'ERROR: Something went wrong',
            timestamp: Date.now() - 30000,
            logStreamName: 'stream1'
          }
        ]
      })
    };
  });
  
  return AWS.CloudWatchLogs;
}

/**
 * Mock ACM service
 * @returns Mocked ACM client
 */
export function mockACM() {
  mockClient(AWS.ACM);
  
  AWS.ACM.prototype.listCertificates = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        CertificateSummaryList: [
          {
            CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/abcdef12-3456-7890-abcd-ef1234567890',
            DomainName: 'example.com'
          }
        ]
      })
    };
  });
  
  return AWS.ACM;
}

/**
 * Mock Route53 service
 * @returns Mocked Route53 client
 */
export function mockRoute53() {
  mockClient(AWS.Route53);
  
  AWS.Route53.prototype.listHostedZones = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        HostedZones: [
          {
            Id: '/hostedzone/Z123456789ABCDEFGHIJK',
            Name: 'example.com.'
          }
        ]
      })
    };
  });
  
  return AWS.Route53;
}

/**
 * Setup all AWS mocks
 */
export function setupAllAWSMocks() {
  mockCloudFormation();
  mockS3();
  mockCloudFront();
  mockDynamoDB();
  mockLambda();
  mockAPIGateway();
  mockCloudWatch();
  mockCloudWatchLogs();
  mockACM();
  mockRoute53();
}
