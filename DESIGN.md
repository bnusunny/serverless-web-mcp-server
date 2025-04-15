# Serverless Web MCP Server Design Document

## Overview

The Serverless Web MCP Server is a Model Context Protocol (MCP) server that enables LLM coding agents to deploy web applications to AWS serverless services. It provides a unified interface for deploying both backend services (API Gateway, Lambda with Web Adapter, DynamoDB/Aurora Serverless) and frontend applications (S3 + CloudFront).

## Purpose

This server bridges the gap between natural language interactions with LLM coding agents and the technical implementation of deploying web applications to AWS serverless infrastructure. It allows users to describe their web application needs in natural language to an AI agent, which then uses this MCP server to handle the actual deployment process.

## Core Components

### 1. MCP Protocol Handler

Implements the Model Context Protocol specification to facilitate communication between LLM coding agents and the deployment services.

- **Responsibilities**:
  - Process incoming MCP requests from LLM agents
  - Format responses according to MCP specifications
  - Handle resource retrieval and tool invocation
  - Manage capability negotiation and error reporting

- **Transport Options**:
  - **stdio**: For direct integration with LLM clients as a local MCP server
  - **HTTP**: For web-based integration with remote clients

### 2. Unified Deployment Service

Handles the deployment of web applications to AWS serverless services using a unified approach for both backend and frontend components.

- **Responsibilities**:
  - Translate LLM-generated code into deployable projects
  - Generate AWS SAM templates for different deployment types
  - Execute AWS SAM CLI commands for deployment
  - Configure additional AWS resources as needed

- **Deployment Types**:
  - `backend` - Backend services using Lambda + API Gateway
  - `frontend` - Frontend applications using S3 + CloudFront
  - `fullstack` - Combined backend and frontend deployment

### 3. Context Management

Maintains state information about projects, deployments, and resources to provide context to the LLM agent.

- **Responsibilities**:
  - Track project state and deployment history
  - Store templates and configurations
  - Maintain relationships between frontend and backend components
  - Provide resource inventory and status information

- **Resource Types**:
  - Deployment resources (status, endpoints, configurations)
  - Template resources (available templates and their metadata)

### 4. AWS Integration Layer

Handles interaction with AWS services and resources through AWS SAM CLI and direct AWS SDK calls.

- **Responsibilities**:
  - Manage AWS IAM authentication and permissions
  - Configure custom domains and SSL certificates
  - Set up CloudWatch monitoring and logging
  - Handle S3 bucket and CloudFront distribution management

## MCP Implementation

### Resources

The server exposes the following resource types through the MCP protocol:

- **deployment**: Information about deployed applications
  - URI format: `deployment:{project-name}` or `deployment:list`
  - Example: `deployment:my-api`

- **template**: Information about available deployment templates
  - URI format: `template:{name}` or `template:list`
  - Example: `template:backend`

- **mcp:resources**: Resource discovery
  - URI format: `mcp:resources`
  - Lists all available resources and their patterns

### Tools

The server exposes the following tools through the MCP protocol:

- **deploy**: Deploy web applications to AWS serverless infrastructure
- **configure-domain**: Set up custom domains and SSL certificates
- **provision-database**: Create and configure database resources
- **get-logs**: Retrieve application logs
- **get-metrics**: Fetch performance metrics

## Resource Implementation

The server implements resources using a modular approach with a consistent interface:

```typescript
interface McpResource {
  name: string;
  uri: string;
  description: string;
  handler: (uri: URL, variables?: any) => Promise<any>;
}
```

Each resource is implemented as a separate module that exports a default object conforming to this interface. Resources are registered with the MCP server using a simple loop:

```typescript
resources.forEach((resource: McpResource) => {
  server.resource(resource.name, resource.uri, resource.handler);
});
```

This approach provides several benefits:
- Consistent resource handling
- Easy addition of new resources
- Clear separation of concerns
- Improved testability

## Unified Deployment Approach

The server uses a unified approach for all deployment types, with configuration parameters that specify the type of deployment.

### Deployment Action Structure

```
deploy:
  - deploymentType: "backend" | "frontend" | "fullstack"
  - source: { path or code content }
  - framework: { web framework type }
  - configuration: {
      // Common parameters
      projectName: string,
      region: string,
      tags: object,
      
      // Backend-specific parameters
      backendConfiguration: {
        runtime: string,
        memorySize: number,
        timeout: number,
        environment: object,
        database: { type, config }
      },
      
      // Frontend-specific parameters
      frontendConfiguration: {
        indexDocument: string,
        errorDocument: string,
        cachePolicy: object,
        spa: boolean  // Single Page App handling
      },
      
      // Domain configuration
      domain: {
        name: string,
        certificate: string,
        createRoute53Records: boolean
      }
    }
```

### Benefits of Unified Approach

- **Simplified Agent Interface**: LLM agents only need to learn one set of commands
- **Consistent Experience**: Similar workflow for all deployment types
- **Flexible Deployment Options**: Support for various application architectures
- **Holistic Application View**: Complete picture of the application stack

## Deployment Workflows

### Backend Deployment

1. LLM agent generates backend code based on user requirements
2. Agent sends deployment request with `deploymentType: "backend"`
3. MCP server prepares SAM template with Lambda Web Adapter configuration
4. Server executes SAM CLI to deploy API Gateway and Lambda resources
5. Server configures database resources if requested
6. Server returns API endpoint information to the agent

### Frontend Deployment

1. LLM agent generates frontend code based on user requirements
2. Agent sends deployment request with `deploymentType: "frontend"`
3. MCP server prepares SAM template with S3 and CloudFront resources
4. Server builds the frontend application if necessary
5. Server uploads assets to S3 and configures CloudFront distribution
6. Server returns CloudFront domain information to the agent

### Fullstack Deployment

1. LLM agent generates both frontend and backend code
2. Agent sends deployment request with `deploymentType: "fullstack"`
3. MCP server prepares comprehensive SAM template
4. Server deploys backend resources first
5. Server injects API endpoint information into frontend code
6. Server builds and deploys frontend application
7. Server configures CloudFront to route API requests appropriately
8. Server returns application URLs to the agent

## Technical Implementation

### Language and Framework

The MCP server is implemented using Node.js with TypeScript, chosen for:
- Strong AWS SDK support
- Efficient handling of asynchronous operations
- Type safety and better developer experience
- Good performance characteristics for a local server

### Transport Options

The server supports two transport methods:

1. **stdio Transport**:
   - Default transport for local MCP server usage
   - Direct integration with LLM clients like Claude for Desktop
   - Executable as a command-line tool when installed globally

2. **HTTP Transport**:
   - Web-based transport for remote clients
   - Exposes an MCP endpoint over HTTP
   - Supports CORS for cross-origin requests

### State Management

Project state and deployment information is stored using:
- Local file system for project files and templates
- JSON files for deployment history and resource tracking
- In-memory cache for active deployment operations

### AWS SAM Integration

The server integrates with AWS SAM CLI by:
- Programmatically generating SAM templates
- Executing SAM CLI commands via child processes
- Parsing SAM CLI output for status updates and error handling
- Managing SAM build artifacts and deployment packages

### Security Considerations

- AWS IAM authentication for all AWS operations
- Secure handling of AWS credentials
- Input validation for all MCP requests
- Proper error handling and logging

## Monitoring and Logging

### Deployment Monitoring

- Track deployment status and progress
- Capture and stream SAM CLI output
- Provide detailed error information for failed deployments

### Application Monitoring

- Configure CloudWatch Logs for Lambda functions
- Set up CloudWatch Metrics for API Gateway, Lambda, S3, and CloudFront
- Provide access to logs and metrics through MCP resources

## Custom Domain and SSL Management

- Integration with ACM for SSL certificate provisioning
- Configuration of custom domains for API Gateway
- Setup of custom domains for CloudFront distributions
- Optional Route 53 record creation

## Database Integration

- Provisioning of DynamoDB tables or Aurora Serverless clusters
- Configuration of database access permissions
- Connection information management
- Basic schema creation capabilities

## Extension Points

The MCP server design includes several extension points for future enhancements:

1. **Additional Deployment Types**: Support for other AWS serverless services
2. **Framework-Specific Optimizations**: Custom handling for popular web frameworks
3. **CI/CD Integration**: Hooks for continuous deployment workflows
4. **Local Development**: Potential addition of local emulation capabilities
5. **Multi-Region Deployment**: Support for deploying to multiple AWS regions

## Implementation Roadmap

1. **Phase 1**: Core MCP protocol implementation and basic backend deployment
2. **Phase 2**: Frontend website deployment capabilities
3. **Phase 3**: Fullstack deployment integration
4. **Phase 4**: Custom domain and SSL management
5. **Phase 5**: Enhanced monitoring and logging features
6. **Phase 6**: Database provisioning and management

## Conclusion

The Serverless Web MCP Server provides a powerful bridge between natural language interactions and AWS serverless deployments. By implementing the Model Context Protocol, it enables LLM coding agents to deploy web applications to AWS infrastructure with minimal human intervention, supporting both backend services and frontend applications through a unified interface.
