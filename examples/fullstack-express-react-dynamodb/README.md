# Fullstack Express + React + DynamoDB Example

This is an example fullstack application with persistent data storage that can be deployed using the Serverless Web MCP Server. It combines an Express.js backend API with a React frontend and uses DynamoDB for data storage.

## Project Structure

```
/
├── backend/             # Express.js backend API with DynamoDB integration
│   ├── index.js         # Main server file
│   ├── package.json     # Backend dependencies
│   └── template.yaml    # DynamoDB table definition
├── frontend/            # React frontend application
│   ├── public/          # Static assets
│   ├── src/             # React source code
│   │   ├── components/  # React components
│   │   └── App.js       # Main application component
│   └── package.json     # Frontend dependencies
└── README.md            # This file
```

## Features

- Express.js backend with RESTful API
- DynamoDB integration for persistent data storage
- React frontend with responsive design
- Todo application with create, read, update, and delete operations
- CloudFront path-based routing

## Deployment

This application can be deployed using the Serverless Web MCP Server with the following configuration:

```json
{
  "deploymentType": "fullstack",
  "source": {
    "path": "/path/to/this/directory"
  },
  "framework": "express",
  "configuration": {
    "projectName": "todo-app-dynamodb",
    "region": "us-east-1",
    "backendConfiguration": {
      "runtime": "nodejs18.x",
      "memorySize": 512,
      "timeout": 30,
      "environment": {
        "NODE_ENV": "production",
        "DYNAMODB_TABLE": "TodoItems"
      }
    },
    "frontendConfiguration": {
      "indexDocument": "index.html",
      "errorDocument": "index.html",
      "spa": true
    }
  }
}
```

## Database Provisioning

This example includes a DynamoDB table definition in `backend/template.yaml`. You can provision the database using the `provision-database` tool:

```json
{
  "projectName": "todo-app-dynamodb",
  "databaseType": "dynamodb",
  "configuration": {
    "tableName": "TodoItems",
    "primaryKey": "id"
  }
}
```

## Local Development

To run this application locally, you'll need to start both the backend and frontend servers:

### Backend

```bash
cd backend
npm install
# Set up local DynamoDB (using Docker)
docker run -p 8000:8000 amazon/dynamodb-local
# Set environment variables
export DYNAMODB_TABLE=TodoItems
export AWS_ENDPOINT=http://localhost:8000
# Start the server
npm start
```

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend development server will start on port 3000 and proxy API requests to the backend server on port 3001.

## AWS Lambda Web Adapter

When deployed to AWS Lambda, the backend application will use the AWS Lambda Web Adapter to handle HTTP requests. The adapter is automatically added during deployment by the Serverless Web MCP Server.

The Lambda Web Adapter layer ARNs used during deployment are:

### AWS Commercial Regions
- x86_64: `arn:aws:lambda:${AWS::Region}:753240598075:layer:LambdaAdapterLayerX86:24`
- arm64: `arn:aws:lambda:${AWS::Region}:753240598075:layer:LambdaAdapterLayerArm64:24`

### AWS China Regions
- cn-north-1 (Beijing)
  - x86_64: `arn:aws-cn:lambda:cn-north-1:041581134020:layer:LambdaAdapterLayerX86:24`
- cn-northwest-1 (Ningxia)
  - x86_64: `arn:aws-cn:lambda:cn-northwest-1:069767869989:layer:LambdaAdapterLayerX86:24`

## IAM Permissions

When deploying to AWS, the Lambda function will need the following IAM permissions to access DynamoDB:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/TodoItems"
    }
  ]
}
```

These permissions are automatically added by the Serverless Web MCP Server when provisioning the database.

## Deployment Architecture

When deployed, this fullstack application will use:

1. **AWS Lambda + API Gateway** for the backend API (with Lambda Web Adapter)
2. **DynamoDB** for data storage
3. **S3 + CloudFront** for the frontend
4. **CloudFront path-based routing** to direct `/api/*` requests to API Gateway and all other requests to S3

This architecture provides a complete serverless solution with persistent data storage.
