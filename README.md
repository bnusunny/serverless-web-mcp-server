# Serverless Web MCP Server

A Model Context Protocol (MCP) server implementation for deploying web applications to AWS serverless infrastructure.

## Overview

This project implements an MCP server that enables LLM coding agents to deploy web applications to AWS serverless services. It follows the [Model Context Protocol specification](https://modelcontextprotocol.io) to provide a standardized interface for AI agents to interact with AWS deployment capabilities.

The server supports deploying:
- Backend services using API Gateway, Lambda with Web Adapter, and DynamoDB/Aurora Serverless
- Frontend applications using S3 and CloudFront
- Fullstack applications combining both backend and frontend components

## New Feature: Automatic Dependency Installation

The server now automatically handles dependencies for backend deployments:

- **Node.js**: Copies package.json from project root if needed and runs `npm install --production`
- **Python**: Copies requirements.txt and runs `pip install -r requirements.txt -t .`
- **Ruby**: Copies Gemfile and runs `bundle install`

This means you no longer need to include dependencies in your build artifacts - just provide your compiled code and the deployment process will handle the rest.

## MCP Implementation

This server implements the Model Context Protocol with the following features:

### Resources

Provides contextual information about:
- Available deployment templates (`template:list`, `template:{name}`)
- Existing deployments and their status (`deployment:list`, `deployment:{project-name}`)

### Tools

Exposes deployment capabilities as tools:
- `deploy`: Deploy web applications to AWS serverless infrastructure
- `configure-domain`: Set up custom domains and SSL certificates
- `provision-database`: Create and configure database resources
- `get-logs`: Retrieve application logs (placeholder implementation)
- `get-metrics`: Fetch performance metrics (placeholder implementation)

### Transport Options

The server supports two transport methods:
- **stdio**: Default transport for local MCP server usage (integrates with Claude for Desktop)
- **HTTP**: Web-based transport for remote clients

## Security and User Control

Following MCP security principles:

- **User Consent**: All deployments require explicit user authorization
- **Data Privacy**: Resource information is protected with appropriate access controls
- **Tool Safety**: Clear documentation of tool behavior and required permissions
- **AWS IAM Integration**: Secure authentication for all AWS operations

## Architecture

The server consists of these core components:

1. **MCP Protocol Handler**: Implements the JSON-RPC interface and message handling
2. **Unified Deployment Service**: Manages deployments across different types (backend, frontend, fullstack)
3. **AWS Integration Layer**: Interfaces with AWS SAM CLI and AWS services
4. **Context Management**: Maintains state about projects and deployments

## Deployment Types

The server supports a unified approach to deployments with different types:

- **Backend Deployment**: Backend services using Lambda + API Gateway
- **Frontend Deployment**: Frontend applications using S3 + CloudFront
- **Fullstack Deployment**: Combined backend and frontend deployment

## AWS Lambda Web Adapter

For backend and fullstack deployments, the server uses [AWS Lambda Web Adapter](docs/lambda-web-adapter.md) to run web applications on AWS Lambda. This allows developers to use familiar web frameworks without any code changes.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- AWS SAM CLI
- AWS credentials configured

### Installation

```bash
# Install globally from npm
npm install -g serverless-web-mcp-server

# Or clone the repository
git clone https://github.com/bnusunny/serverless-web-mcp-server.git
cd serverless-web-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Start the server (HTTP mode)
MCP_TRANSPORT=http npm start
```

### Configuration

Create a `config.json` file:

```json
{
  "port": 3000,
  "aws": {
    "region": "us-east-1",
    "profile": "default"
  },
  "templates": {
    "path": "./templates"
  }
}
```

## Usage

### Using as a Local MCP Server

To use with Claude for Desktop or other MCP clients, add the server to your client configuration:

For Claude for Desktop, edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "serverless-web": {
      "command": "serverless-web-mcp"
    }
  }
}
```

After configuring, restart Claude for Desktop. You should see the serverless-web tools available in the Claude interface.

### Using as an HTTP Server

MCP clients can connect to the server at:

```
http://localhost:3000/sse    # For SSE transport
http://localhost:3000/messages    # For message handling
```

### Command Line Options

```
Usage:
  serverless-web-mcp [options]

Options:
  --debug, -d                 Enable debug logging
  --templates, -t <path>      Specify templates directory path
  --transport, -m <mode>      Transport method (stdio or http, default: stdio)
  --port, -p <number>         HTTP server port (default: 3000, only used with http transport)
  --help, -h                  Show this help message
  
Environment Variables:
  MCP_TRANSPORT               Transport method (stdio or http, default: stdio)
  PORT                        HTTP server port (default: 3000)
  TEMPLATES_PATH              Path to templates directory
```

### Resource Discovery

To discover available resources and tools, use the following methods:

#### List Resources

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resource/list",
  "params": {}
}
```

This will return a list of all available resources with their patterns and descriptions.

#### List Tools

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tool/list",
  "params": {}
}
```

This will return a list of all available tools with their descriptions and parameter schemas.

### Example Tool Invocation

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tool/invoke",
  "params": {
    "name": "deploy",
    "parameters": {
      "deploymentType": "backend",
      "projectName": "my-api",
      "projectRoot": "/path/to/project",
      "region": "us-east-1",
      "backendConfiguration": {
        "builtArtifactsPath": "/path/to/built/artifacts",
        "runtime": "nodejs18.x",
        "startupScript": "bootstrap",
        "memorySize": 512,
        "timeout": 30,
        "environment": {
          "NODE_ENV": "production"
        }
      }
    }
  }
}
```

### Example Resource Request

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resource/get",
  "params": {
    "uri": "deployment:my-api"
  }
}
```

## Deployment Parameters

### Backend Deployment

```json
{
  "deploymentType": "backend",
  "projectName": "my-api",
  "projectRoot": "/path/to/project",
  "region": "us-east-1",
  "backendConfiguration": {
    "builtArtifactsPath": "/path/to/built/artifacts",
    "runtime": "nodejs18.x",
    "startupScript": "bootstrap",
    "memorySize": 512,
    "timeout": 30,
    "environment": {
      "NODE_ENV": "production"
    },
    "databaseConfiguration": {
      "tableName": "Users",
      "attributeDefinitions": [
        { "name": "id", "type": "S" }
      ],
      "keySchema": [
        { "name": "id", "type": "HASH" }
      ]
    }
  }
}
```

### Frontend Deployment

```json
{
  "deploymentType": "frontend",
  "projectName": "my-website",
  "projectRoot": "/path/to/project",
  "region": "us-east-1",
  "frontendConfiguration": {
    "builtAssetsPath": "/path/to/built/assets",
    "indexDocument": "index.html",
    "customDomain": "example.com",
    "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/abcdef12-3456-7890-abcd-ef1234567890"
  }
}
```

### Fullstack Deployment

```json
{
  "deploymentType": "fullstack",
  "projectName": "my-fullstack-app",
  "projectRoot": "/path/to/project",
  "region": "us-east-1",
  "backendConfiguration": {
    "builtArtifactsPath": "/path/to/backend/artifacts",
    "runtime": "nodejs18.x",
    "environment": {
      "NODE_ENV": "production"
    }
  },
  "frontendConfiguration": {
    "builtAssetsPath": "/path/to/frontend/assets",
    "indexDocument": "index.html"
  }
}
```

## Development

### Project Structure

```
/
├── src/
│   ├── mcp/              # MCP protocol implementation
│   │   ├── tools/        # Tool implementations
│   │   │   └── index.ts  # Tool registration
│   │   ├── resources/    # Resource implementations
│   │   │   └── index.ts  # Resource registration
│   │   └── server.ts     # MCP server setup
│   ├── deployment/       # Deployment service
│   ├── cli/              # Command line interface
│   └── index.ts          # Main server entry point
├── templates/            # Deployment templates
├── examples/             # Example applications
├── docs/                 # Documentation
├── config.json           # Server configuration
├── DESIGN.md             # Detailed design document
└── README.md             # This file
```

### Running Tests

```bash
npm test
```

## Troubleshooting

### Template Not Found

If you encounter a "Template not found" error when using the MCP server installed from npm, you can specify the templates directory path using one of these methods:

1. Use the `--templates` command line option:
   ```bash
   serverless-web-mcp --templates /path/to/templates
   ```

2. Set the `TEMPLATES_PATH` environment variable:
   ```bash
   TEMPLATES_PATH=/path/to/templates serverless-web-mcp
   ```

3. Enable debug logging to see which paths are being checked:
   ```bash
   serverless-web-mcp --debug
   ```

### Resource Not Found

If you encounter a "Resource not found" error, the server will suggest alternative resources that might be what you're looking for. You can also use the `resource/list` method to discover all available resources:

```bash
curl -X POST http://localhost:3000/messages -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"resource/list","params":{}}'
```

Or when using as a local MCP server with Claude or other LLM clients, simply request a list of resources.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
