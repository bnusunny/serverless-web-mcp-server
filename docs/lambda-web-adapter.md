# AWS Lambda Web Adapter

The AWS Lambda Web Adapter allows you to run web applications on AWS Lambda without any code changes. This document explains how the adapter works and how it's integrated into the serverless-web-mcp-server.

## Overview

AWS Lambda Web Adapter is a Lambda layer that transforms HTTP requests from API Gateway into a format that web frameworks can understand, and transforms responses back to the format expected by API Gateway.

## How It Works

1. API Gateway receives an HTTP request
2. The request is forwarded to Lambda
3. Lambda Web Adapter intercepts the request
4. The adapter transforms the request into a standard HTTP request
5. The web application processes the request and returns a response
6. The adapter transforms the response back to the format expected by Lambda
7. Lambda returns the response to API Gateway
8. API Gateway returns the response to the client

## Bootstrap File Generation

The serverless-web-mcp-server automatically generates a bootstrap file for your web application based on the framework and project structure. This bootstrap file is responsible for starting your web application when the Lambda function is invoked.

### Hybrid Approach

The server uses a hybrid approach to generate the bootstrap file:

1. **Framework Detection**: If the framework is not specified, the server analyzes the project structure to detect the framework.
2. **Entry Point Detection**: If the entry point is not specified, the server analyzes the project structure to detect the entry point.
3. **User Input**: If the framework or entry point cannot be detected, the server prompts the user for input.

### Supported Frameworks

The server supports the following frameworks:

- **Node.js**:
  - Express.js
  - Next.js
  - Koa
  - Fastify
  - Generic Node.js

- **Python**:
  - Flask
  - FastAPI
  - Django
  - Generic Python

- **Ruby**:
  - Rails
  - Sinatra
  - Generic Ruby

### Bootstrap File Examples

#### Express.js

```bash
#!/bin/bash
# Bootstrap script for express application
set -e

# Set environment variables
export NODE_ENV=production

# Start the application
exec node app.js
```

#### Flask

```bash
#!/bin/bash
# Bootstrap script for Flask application
set -e

# Set environment variables
export FLASK_APP=app.py
export FLASK_ENV=production

# Start the application
exec python -m flask run --host=0.0.0.0 --port=$PORT
```

#### FastAPI

```bash
#!/bin/bash
# Bootstrap script for FastAPI application
set -e

# Start the application
exec uvicorn main:app --host=0.0.0.0 --port=$PORT
```

## Lambda Web Adapter Layer

The server uses the AWS Lambda Web Adapter layer provided by AWS. The layer ARN is:

- x86_64: `arn:aws:lambda:${AWS::Region}:753240598075:layer:LambdaAdapterLayerX86:24`
- arm64: `arn:aws:lambda:${AWS::Region}:753240598075:layer:LambdaAdapterLayerArm64:24`

## Configuration

The Lambda Web Adapter is configured through environment variables:

- `PORT`: The port on which your web application listens (default: 8080)
- `AWS_LAMBDA_EXEC_WRAPPER`: The path to the bootstrap wrapper (default: /opt/bootstrap)

## Framework-Specific Configuration

### Express.js

```yaml
Environment:
  Variables:
    PORT: 8080
    AWS_LAMBDA_EXEC_WRAPPER: /opt/bootstrap
    NODE_OPTIONS: --enable-source-maps
```

### Flask

```yaml
Environment:
  Variables:
    PORT: 8080
    AWS_LAMBDA_EXEC_WRAPPER: /opt/bootstrap
    FLASK_APP: app.py
```

### FastAPI

```yaml
Environment:
  Variables:
    PORT: 8080
    AWS_LAMBDA_EXEC_WRAPPER: /opt/bootstrap
    APP_MODULE: main:app
```

## Troubleshooting

If you encounter issues with the Lambda Web Adapter, check the following:

1. **Bootstrap File**: Make sure the bootstrap file is executable (`chmod +x bootstrap`)
2. **Environment Variables**: Make sure the environment variables are set correctly
3. **Entry Point**: Make sure the entry point is correct
4. **Dependencies**: Make sure all dependencies are installed
5. **Lambda Logs**: Check the Lambda logs for error messages

## References

- [AWS Lambda Web Adapter GitHub Repository](https://github.com/awslabs/aws-lambda-web-adapter)
- [AWS Lambda Web Adapter Documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-web-adapter.html)
