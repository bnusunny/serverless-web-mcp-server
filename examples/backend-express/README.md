# Express.js Backend Example

This is an example Express.js backend application that can be deployed using the Serverless Web MCP Server. It implements a simple REST API for managing items.

## Features

- RESTful API endpoints for CRUD operations
- Express.js middleware for error handling and CORS
- In-memory data store (for demonstration purposes)

## API Endpoints

- `GET /` - Welcome message
- `GET /api/items` - Get all items
- `GET /api/items/:id` - Get item by ID
- `POST /api/items` - Create a new item
- `PUT /api/items/:id` - Update an item
- `DELETE /api/items/:id` - Delete an item

## Deployment

This application can be deployed using the Serverless Web MCP Server with the following configuration:

```json
{
  "deploymentType": "backend",
  "source": {
    "path": "/path/to/this/directory"
  },
  "framework": "express",
  "configuration": {
    "projectName": "express-backend-example",
    "region": "us-east-1",
    "backendConfiguration": {
      "runtime": "nodejs18.x",
      "memorySize": 512,
      "timeout": 30,
      "environment": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Local Development

To run this application locally:

```bash
npm install
npm start
```

The server will start on port 3000 by default. You can change the port by setting the `PORT` environment variable.

## AWS Lambda Web Adapter

When deployed to AWS Lambda, this application will use the AWS Lambda Web Adapter to handle HTTP requests. The adapter is automatically added during deployment by the Serverless Web MCP Server.

The Lambda Web Adapter layer ARNs used during deployment are:

### AWS Commercial Regions
- x86_64: `arn:aws:lambda:${AWS::Region}:753240598075:layer:LambdaAdapterLayerX86:24`
- arm64: `arn:aws:lambda:${AWS::Region}:753240598075:layer:LambdaAdapterLayerArm64:24`

### AWS China Regions
- cn-north-1 (Beijing)
  - x86_64: `arn:aws-cn:lambda:cn-north-1:041581134020:layer:LambdaAdapterLayerX86:24`
- cn-northwest-1 (Ningxia)
  - x86_64: `arn:aws-cn:lambda:cn-northwest-1:069767869989:layer:LambdaAdapterLayerX86:24`
