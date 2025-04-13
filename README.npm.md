# Serverless Web MCP Server

A Model Context Protocol (MCP) server implementation for deploying web applications to AWS serverless infrastructure.

## Overview

This package provides an MCP server that enables LLM coding agents to deploy web applications to AWS serverless services. It follows the [Model Context Protocol specification](https://modelcontextprotocol.io) to provide a standardized interface for AI agents to interact with AWS deployment capabilities.

The server supports deploying:
- Backend services using API Gateway, Lambda with Web Adapter, and DynamoDB/Aurora Serverless
- Frontend applications using S3 and CloudFront
- Fullstack applications combining both backend and frontend components

## Installation

```bash
# Install globally
npm install -g serverless-web-mcp-server

# Or install locally in your project
npm install serverless-web-mcp-server
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

Start the server in HTTP mode:

```bash
MCP_TRANSPORT=http serverless-web-mcp
```

MCP clients can connect to the server at:

```
http://localhost:3000/mcp
```

### Configuration

Create a `config.json` file in your working directory:

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

## Prerequisites

- Node.js 18 or higher
- AWS SAM CLI
- AWS credentials configured

## License

MIT
