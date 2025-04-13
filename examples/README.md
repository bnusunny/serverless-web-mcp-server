# Serverless Web MCP Server Examples

This directory contains example applications that can be deployed using the Serverless Web MCP Server. These examples demonstrate the different deployment types supported by the server.

## Available Examples

### Backend Example (Express.js)

A simple Express.js backend API for managing items. This example demonstrates how to deploy a serverless backend API using API Gateway and Lambda with Web Adapter.

- **Directory**: `backend-express/`
- **Deployment Type**: `backend`
- **Framework**: Express.js

### Frontend Example (React)

A React-based frontend application for managing items. This example demonstrates how to deploy a static website using S3 and CloudFront.

- **Directory**: `frontend-react/`
- **Deployment Type**: `frontend`
- **Framework**: React

### Fullstack Example (Express.js + React)

A combined fullstack application with an Express.js backend API and React frontend. This example demonstrates how to deploy a complete web application with integrated backend and frontend components.

- **Directory**: `fullstack-express-react/`
- **Deployment Type**: `fullstack`
- **Framework**: Express.js + React

### Fullstack Example with DynamoDB (Express.js + React + DynamoDB)

A complete fullstack application with persistent data storage using DynamoDB. This example demonstrates how to deploy a serverless web application with a database backend.

- **Directory**: `fullstack-express-react-dynamodb/`
- **Deployment Type**: `fullstack`
- **Framework**: Express.js + React
- **Database**: DynamoDB

## Deployment Instructions

Each example includes a README.md file with specific deployment instructions. In general, you can deploy these examples using the Serverless Web MCP Server with the following steps:

1. Install and configure the Serverless Web MCP Server
2. Use the `deploy` tool with the appropriate configuration
3. Access the deployed application using the provided endpoints

## Example Deployment Command

Using Claude for Desktop with the MCP server configured:

```
I want to deploy the backend Express.js example. Please use the deploy tool with the following configuration:
- deploymentType: backend
- source path: /path/to/examples/backend-express
- framework: express
- projectName: express-backend-example
- region: us-east-1
- runtime: nodejs18.x
- memorySize: 512
- timeout: 30
```

## Local Development

Each example includes instructions for local development in its respective README.md file.
