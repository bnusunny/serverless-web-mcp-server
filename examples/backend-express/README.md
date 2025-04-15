# Express.js Backend Example

This is a sample Express.js backend application that can be deployed using the Serverless Web MCP Server.

## Features

- RESTful API with CRUD operations
- In-memory data store (for demonstration purposes)
- CORS support
- Ready for AWS Lambda deployment with Lambda Web Adapter

## API Endpoints

- `GET /` - Welcome message
- `GET /api/items` - Get all items
- `GET /api/items/:id` - Get item by ID
- `POST /api/items` - Create a new item
- `PUT /api/items/:id` - Update an item
- `DELETE /api/items/:id` - Delete an item

## Local Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
npm install
```

### Running Locally

```bash
npm start
```

The server will start on port 8080 (or the port specified in the `PORT` environment variable).

## Deployment

This application can be deployed using the Serverless Web MCP Server with the following configuration:

```json
{
  "deploymentType": "backend",
  "source": {
    "path": "/path/to/backend-express"
  },
  "framework": "express",
  "configuration": {
    "projectName": "express-api",
    "region": "us-east-1",
    "backendConfiguration": {
      "runtime": "nodejs18.x",
      "memorySize": 512,
      "timeout": 30,
      "stage": "prod",
      "cors": true,
      "environment": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## AWS Lambda Web Adapter

This application uses the AWS Lambda Web Adapter to run on AWS Lambda without any code changes. The adapter translates API Gateway events into HTTP requests that Express can understand.

Key configuration in the CloudFormation template:

```yaml
ApiFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: awslambda.bootstrap.handler
    Environment:
      Variables:
        AWS_LAMBDA_EXEC_WRAPPER: /opt/bootstrap
        PORT: 8080
    Layers:
      - !Sub "arn:aws:lambda:${AWS::Region}:753240598075:layer:LambdaAdapterLayerX86:24"
```

## Testing

```bash
npm test
```
