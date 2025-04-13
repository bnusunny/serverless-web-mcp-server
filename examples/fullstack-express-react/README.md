# Fullstack Express + React Example

This is an example fullstack application that can be deployed using the Serverless Web MCP Server. It combines an Express.js backend API with a React frontend.

## Project Structure

```
/
├── backend/             # Express.js backend API
│   ├── index.js         # Main server file
│   └── package.json     # Backend dependencies
├── frontend/            # React frontend application
│   ├── public/          # Static assets
│   ├── src/             # React source code
│   └── package.json     # Frontend dependencies
└── README.md            # This file
```

## Features

- Express.js backend with RESTful API
- React frontend with responsive design
- Integrated API communication
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
    "projectName": "fullstack-example",
    "region": "us-east-1",
    "backendConfiguration": {
      "runtime": "nodejs18.x",
      "memorySize": 512,
      "timeout": 30,
      "environment": {
        "NODE_ENV": "production"
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

## Local Development

To run this application locally, you'll need to start both the backend and frontend servers:

### Backend

```bash
cd backend
npm install
npm start
```

The backend server will start on port 3001.

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend development server will start on port 3000 and proxy API requests to the backend server.

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

## Deployment Architecture

When deployed, this fullstack application will use:

1. **AWS Lambda + API Gateway** for the backend API (with Lambda Web Adapter)
2. **S3 + CloudFront** for the frontend
3. **CloudFront path-based routing** to direct `/api/*` requests to API Gateway and all other requests to S3

This architecture provides a seamless integration between frontend and backend components while maintaining the benefits of serverless deployment.
