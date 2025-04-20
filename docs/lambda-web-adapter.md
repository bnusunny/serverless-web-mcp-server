# AWS Lambda Web Adapter

The AWS Lambda Web Adapter allows you to run web applications on AWS Lambda without any code changes. This document explains how it works and how to use it with the serverless-web-mcp tool.

## Overview

AWS Lambda Web Adapter is a lightweight adapter that translates API Gateway or Lambda Function URL events into HTTP requests that your web application can understand. It allows you to run any web application that listens on HTTP in AWS Lambda.

## How It Works

1. API Gateway or Lambda Function URL receives an HTTP request
2. The request is converted to a Lambda event and passed to your Lambda function
3. Lambda Web Adapter converts the Lambda event back into an HTTP request
4. Your web application processes the HTTP request and returns an HTTP response
5. Lambda Web Adapter converts the HTTP response back into a Lambda response
6. The response is returned to API Gateway or Lambda Function URL

## Startup Script

The Lambda Web Adapter requires a startup script to launch your web application. This script is responsible for:

1. Setting up the environment (e.g., setting the PORT variable)
2. Starting your web application

### Manual Startup Script Creation

You can create a startup script manually. Here's an example for a Node.js application:

```bash
#!/bin/bash
# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec node app.js
```

Make sure the script is executable:

```bash
chmod +x bootstrap
```

### Automatic Startup Script Generation

The serverless-web-mcp tool now supports automatic generation of startup scripts. Instead of creating a startup script manually, you can provide:

1. The application entry point file (e.g., `app.js`, `app.py`)
2. Set `generateStartupScript` to `true`

The tool will automatically:
- Generate an appropriate startup script for your runtime
- Make it executable
- Configure it to work with Lambda Web Adapter

#### Example Configuration

```json
{
  "deploymentType": "backend",
  "projectName": "my-api",
  "projectRoot": "/path/to/project",
  "backendConfiguration": {
    "builtArtifactsPath": "/path/to/built/artifacts",
    "runtime": "nodejs18.x",
    "entryPoint": "app.js",
    "generateStartupScript": true
  }
}
```

## Supported Runtimes

The Lambda Web Adapter supports the following runtimes:

- Node.js (nodejs14.x, nodejs16.x, nodejs18.x)
- Python (python3.7, python3.8, python3.9)
- Java (java8, java8.al2, java11)
- .NET (dotnet3.1, dotnet5.0, dotnet6)
- Go (go1.x)
- Ruby (ruby2.7)

## Environment Variables

The Lambda Web Adapter uses the following environment variables:

- `PORT`: The port on which your web application listens (default: 8080)
- `AWS_LAMBDA_FUNCTION_TIMEOUT`: The Lambda function timeout in seconds

## Best Practices

1. **Use a Framework**: Web frameworks like Express.js, Flask, or Spring Boot work well with Lambda Web Adapter
2. **Keep Dependencies Light**: Include only necessary dependencies to reduce cold start times
3. **Handle Timeouts**: Ensure your application handles timeouts gracefully
4. **Use Async Processing**: For long-running tasks, use async processing or step functions
5. **Test Locally**: Test your application locally before deploying to Lambda

## Troubleshooting

### Common Issues

1. **Startup Script Not Executable**:
   - Error: `fork/exec /var/task/bootstrap: permission denied`
   - Solution: Make sure your startup script is executable (`chmod +x bootstrap`)

2. **Application Not Listening on Correct Port**:
   - Error: `Connection refused` or timeout
   - Solution: Make sure your application listens on the port specified by the `PORT` environment variable

3. **Timeout Issues**:
   - Error: `Task timed out after X seconds`
   - Solution: Increase the Lambda timeout or optimize your application

### Debugging

To debug issues with Lambda Web Adapter:

1. Check CloudWatch Logs for error messages
2. Add debug logging to your application
3. Test your application locally with the same environment variables

## Resources

- [AWS Lambda Web Adapter GitHub Repository](https://github.com/awslabs/aws-lambda-web-adapter)
- [AWS Lambda Function Handler in Node.js](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html)
- [AWS Lambda Function Handler in Python](https://docs.aws.amazon.com/lambda/latest/dg/python-handler.html)
