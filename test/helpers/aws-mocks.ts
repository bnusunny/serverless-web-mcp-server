// test/helpers/aws-mocks.ts
import { mockClient } from 'aws-sdk-mock';
import AWS from 'aws-sdk';

export function mockCloudFormation() {
  mockClient(AWS.CloudFormation);
  
  AWS.CloudFormation.prototype.describeStacks = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Stacks: [{
          StackName: 'test-stack',
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [
            { OutputKey: 'ApiUrl', OutputValue: 'https://api.example.com' }
          ]
        }]
      })
    };
  });
  
  return AWS.CloudFormation;
}

export function mockS3() {
  mockClient(AWS.S3);
  
  AWS.S3.prototype.putObject = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({ ETag: '"mock-etag"' })
    };
  });
  
  AWS.S3.prototype.listObjectsV2 = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Contents: [
          { Key: 'index.html', Size: 1024, LastModified: new Date() },
          { Key: 'assets/style.css', Size: 512, LastModified: new Date() }
        ]
      })
    };
  });
  
  return AWS.S3;
}

export function mockApiGateway() {
  mockClient(AWS.APIGateway);
  
  AWS.APIGateway.prototype.getRestApis = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        items: [
          { id: 'api123', name: 'test-api' }
        ]
      })
    };
  });
  
  return AWS.APIGateway;
}

export function mockLambda() {
  mockClient(AWS.Lambda);
  
  AWS.Lambda.prototype.listFunctions = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Functions: [
          { 
            FunctionName: 'test-function',
            Runtime: 'nodejs18.x',
            MemorySize: 512,
            Timeout: 30
          }
        ]
      })
    };
  });
  
  return AWS.Lambda;
}

export function mockDynamoDB() {
  mockClient(AWS.DynamoDB);
  
  AWS.DynamoDB.prototype.describeTable = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Table: {
          TableName: 'test-table',
          TableStatus: 'ACTIVE',
          KeySchema: [
            { AttributeName: 'id', KeyType: 'HASH' }
          ],
          AttributeDefinitions: [
            { AttributeName: 'id', AttributeType: 'S' }
          ]
        }
      })
    };
  });
  
  return AWS.DynamoDB;
}

export function mockCloudFront() {
  mockClient(AWS.CloudFront);
  
  AWS.CloudFront.prototype.listDistributions = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        DistributionList: {
          Items: [
            {
              Id: 'DIST123',
              DomainName: 'abcdef123.cloudfront.net',
              Status: 'Deployed',
              Origins: {
                Items: [
                  { DomainName: 'test-bucket.s3.amazonaws.com' }
                ]
              }
            }
          ]
        }
      })
    };
  });
  
  return AWS.CloudFront;
}

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

export function mockRoute53() {
  mockClient(AWS.Route53);
  
  AWS.Route53.prototype.listHostedZones = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        HostedZones: [
          {
            Id: '/hostedzone/Z123456789',
            Name: 'example.com.',
            CallerReference: '1234'
          }
        ]
      })
    };
  });
  
  return AWS.Route53;
}
