# Serverless Web MCP Server

A Model Context Protocol (MCP) server implementation for deploying web applications to AWS serverless infrastructure.

## Overview

This project implements an MCP server that enables LLM coding agents to deploy web applications to AWS serverless services. It follows the [Model Context Protocol specification](https://modelcontextprotocol.io) to provide a standardized interface for AI agents to interact with AWS deployment capabilities.

The server supports deploying:
- Backend services using API Gateway, Lambda with Web Adapter, and DynamoDB/Aurora Serverless
- Frontend applications using S3 and CloudFront
- Fullstack applications combining both backend and frontend components

## MCP Implementation

This server implements the Model Context Protocol with the following features:

### Resources

Provides contextual information about:
- Available deployment templates (`template:list`, `template:{name}`)
- Existing deployments and their status (`deployment:list`, `deployment:{project-name}`)
- Resource discovery (`mcp:resources`) - Lists all available resources

### Tools

Exposes deployment capabilities as tools:
- `deploy`: Deploy web applications to AWS serverless infrastructure
- `configure-domain`: Set up custom domains and SSL certificates
- `provision-database`: Create and configure database resources
- `get-logs`: Retrieve application logs
- `get-metrics`: Fetch performance metrics

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
http://localhost:3000/mcp
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

To discover all available resources, use the `mcp:resources` resource:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resource/get",
  "params": {
    "uri": "mcp:resources"
  }
}
```

This will return a list of all available resources, their descriptions, patterns, and examples.

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
      "source": {
        "path": "/path/to/code"
      },
      "framework": "express",
      "configuration": {
        "projectName": "my-api",
        "region": "us-east-1",
        "backendConfiguration": {
          "runtime": "nodejs18.x",
          "memorySize": 512,
          "timeout": 30
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
│   ├── aws/              # AWS integration
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

If you encounter a "Resource not found" error, the server will suggest alternative resources that might be what you're looking for. You can also use the `mcp:resources` resource to discover all available resources:

```bash
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"resource/get","params":{"uri":"mcp:resources"}}'
```

Or when using as a local MCP server with Claude or other LLM clients, simply request the `mcp:resources` resource.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
