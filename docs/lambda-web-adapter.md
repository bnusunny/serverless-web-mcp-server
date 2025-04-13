# AWS Lambda Web Adapter Integration

The Serverless Web MCP Server uses AWS Lambda Web Adapter to run web applications on AWS Lambda. This document explains how the integration works and provides details on the configuration options.

## Overview

AWS Lambda Web Adapter allows developers to build web applications with familiar frameworks (like Express.js, Next.js, Flask, SpringBoot, etc.) and run them on AWS Lambda without any code changes. The adapter acts as a bridge between the Lambda execution environment and your web application.

![Lambda Web Adapter Overview](https://github.com/awslabs/aws-lambda-web-adapter/raw/main/docs/images/lambda-adapter-overview.png)

## How It Works

When you deploy a web application using the Serverless Web MCP Server:

1. The server packages your application code
2. It attaches the Lambda Web Adapter layer to your Lambda function
3. It configures the necessary environment variables
4. When invoked, the adapter forwards HTTP requests to your web application and returns the responses

This approach allows you to develop web applications locally using standard web frameworks and deploy them to AWS Lambda without any modifications.

## Lambda Web Adapter Layer ARNs

The Serverless Web MCP Server uses the following Lambda Web Adapter layer ARNs:

### AWS Commercial Regions
- x86_64: `arn:aws:lambda:${AWS::Region}:753240598075:layer:LambdaAdapterLayerX86:24`
- arm64: `arn:aws:lambda:${AWS::Region}:753240598075:layer:LambdaAdapterLayerArm64:24`

### AWS China Regions
- cn-north-1 (Beijing)
  - x86_64: `arn:aws-cn:lambda:cn-north-1:041581134020:layer:LambdaAdapterLayerX86:24`
- cn-northwest-1 (Ningxia)
  - x86_64: `arn:aws-cn:lambda:cn-northwest-1:069767869989:layer:LambdaAdapterLayerX86:24`

## Configuration Options

The Lambda Web Adapter can be configured using environment variables. The Serverless Web MCP Server sets these variables based on your deployment configuration:

| Environment Variable | Description | Default Value |
|---------------------|-------------|---------------|
| AWS_LWA_PORT | The port your web application listens on | 8080 |
| AWS_LWA_READINESS_CHECK_PATH | Path used to check if your application is ready | / |
| AWS_LWA_READINESS_CHECK_PROTOCOL | Protocol used for readiness check (http or tcp) | http |
| AWS_LWA_ASYNC_INIT | Enable asynchronous initialization for long initialization functions | false |
| AWS_LWA_REMOVE_BASE_PATH | Base path to be removed from request path | None |
| AWS_LWA_ENABLE_COMPRESSION | Enable gzip compression for response body | false |

## Local Development

For local development, you can run your web application normally without the Lambda Web Adapter. The adapter is only needed when deploying to AWS Lambda.

## Graceful Shutdown

The Lambda Web Adapter enables graceful shutdown for your web application. When Lambda is about to shut down an execution environment, it sends a SIGTERM signal to your application, allowing it to perform cleanup tasks before termination.

## Request Context and Lambda Context

The Lambda Web Adapter forwards API Gateway request context and Lambda context information to your web application via HTTP headers:

- `x-amzn-request-context`: Contains API Gateway request context (requestId, requestTime, identity, etc.)
- `x-amzn-lambda-context`: Contains Lambda context information (functionName, functionVersion, etc.)

## Additional Resources

- [AWS Lambda Web Adapter GitHub Repository](https://github.com/awslabs/aws-lambda-web-adapter)
- [AWS Lambda Web Adapter Documentation](https://github.com/awslabs/aws-lambda-web-adapter/blob/main/README.md)
- [AWS Lambda Web Adapter Examples](https://github.com/awslabs/aws-lambda-web-adapter/tree/main/examples)
