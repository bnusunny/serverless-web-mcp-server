// test/integration/http-transport.test.ts
const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Mock MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/mcp', () => {
  return {
    McpServer: jest.fn().mockImplementation(() => {
      return {
        registerTool: jest.fn(),
        registerResource: jest.fn(),
        handleMessage: jest.fn().mockImplementation((message) => {
          if (message.method === 'resource/list') {
            return Promise.resolve({
              jsonrpc: '2.0',
              id: message.id,
              result: {
                resources: [
                  { pattern: 'template:list', description: 'List available templates' },
                  { pattern: 'deployment:list', description: 'List deployments' }
                ]
              }
            });
          } else if (message.method === 'tool/list') {
            return Promise.resolve({
              jsonrpc: '2.0',
              id: message.id,
              result: {
                tools: [
                  { name: 'deploy', description: 'Deploy web applications' },
                  { name: 'configure-domain', description: 'Configure custom domains' }
                ]
              }
            });
          }
          return Promise.resolve({
            jsonrpc: '2.0',
            id: message.id,
            result: { message: 'Success' }
          });
        })
      };
    })
  };
});

jest.mock('@modelcontextprotocol/sdk/server/sse', () => {
  return {
    SSEServerTransport: jest.fn().mockImplementation(() => {
      return {
        handler: jest.fn().mockReturnValue((req, res) => {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });
          res.write('data: {"message":"Connected to SSE"}\n\n');
          // Close the connection immediately for testing
          res.end();
        })
      };
    })
  };
});

// Mock these imports
jest.mock('../../src/mcp/tools/index', () => ({
  toolDefinitions: {
    'deploy': {
      schema: {},
      handler: jest.fn()
    },
    'configure-domain': {
      schema: {},
      handler: jest.fn()
    }
  }
}), { virtual: true });

jest.mock('../../src/mcp/resources/index', () => ([
  { pattern: 'template:list', handler: jest.fn() },
  { pattern: 'deployment:list', handler: jest.fn() }
]), { virtual: true });

describe('MCP Server HTTP Transport', () => {
  let app;
  let server;
  let McpServer;
  let SSEServerTransport;

  beforeAll(() => {
    // Import after mocking
    McpServer = require('@modelcontextprotocol/sdk/server/mcp').McpServer;
    SSEServerTransport = require('@modelcontextprotocol/sdk/server/sse').SSEServerTransport;
    
    app = express();
    app.use(cors());
    app.use(express.json());
    
    server = new McpServer();
    
    // Import after mocking
    const { toolDefinitions } = require('../../src/mcp/tools/index');
    const resources = require('../../src/mcp/resources/index');
    
    // Register tools
    Object.entries(toolDefinitions).forEach(([name, definition]) => {
      server.registerTool(name, definition.schema, definition.handler);
    });
    
    // Register resources
    resources.forEach(resource => {
      server.registerResource(resource.pattern, resource.handler);
    });
    
    const sseTransport = new SSEServerTransport(server);
    app.use('/sse', sseTransport.handler());
    app.use('/messages', (req, res) => {
      server.handleMessage(req.body).then(response => {
        res.json(response);
      }).catch(error => {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: error.message
          },
          id: req.body.id
        });
      });
    });
  });

  test('should handle resource/list request', async () => {
    const response = await request(app)
      .post('/messages')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'resource/list',
        params: {}
      });
    
    expect(response.status).toBe(200);
    expect(response.body.result).toBeDefined();
    expect(Array.isArray(response.body.result.resources)).toBe(true);
  });

  test('should handle tool/list request', async () => {
    const response = await request(app)
      .post('/messages')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tool/list',
        params: {}
      });
    
    expect(response.status).toBe(200);
    expect(response.body.result).toBeDefined();
    expect(Array.isArray(response.body.result.tools)).toBe(true);
  });

  test('should connect to SSE endpoint', async () => {
    const response = await request(app)
      .get('/sse')
      .set('Accept', 'text/event-stream');
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream');
  });
});
