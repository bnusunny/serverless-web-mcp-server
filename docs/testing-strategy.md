# Testing Strategy for Serverless Web MCP Server

This document outlines the comprehensive testing strategy for the Serverless Web MCP Server project. It provides guidelines for structuring tests, setting up the testing environment, and implementing different types of tests.

## Table of Contents

- [Testing Directory Structure](#testing-directory-structure)
- [Test Types](#test-types)
- [Setup and Configuration](#setup-and-configuration)
- [Writing Tests](#writing-tests)
- [Test Fixtures and Mocks](#test-fixtures-and-mocks)
- [Continuous Integration](#continuous-integration)
- [Implementation Plan](#implementation-plan)
- [Test Coverage Improvement Plan](#test-coverage-improvement-plan)

## Testing Directory Structure

We use a separate `test` directory at the root level to organize all test code:

```
/
├── src/                 # Source code
├── test/                # All test code
│   ├── unit/            # Unit tests
│   │   ├── mcp/         # MCP-related tests
│   │   │   ├── resources/
│   │   │   ├── tools/
│   │   │   └── server.test.ts
│   │   ├── deployment/  # Deployment-related tests
│   │   └── utils/       # Utility tests
│   ├── integration/     # Integration tests
│   │   ├── http-transport.test.ts
│   │   └── stdio-transport.test.ts
│   ├── e2e/             # End-to-end tests
│   ├── fixtures/        # Test fixtures and mock data
│   │   ├── templates/   # Mock deployment templates
│   │   ├── artifacts/   # Mock build artifacts
│   │   └── responses/   # Mock AWS responses
│   └── helpers/         # Test helpers and utilities
│       ├── aws-mocks.ts
│       └── test-utils.ts
├── jest.config.js       # Jest configuration
└── package.json
```

This structure provides several benefits:
- Clear separation between source code and tests
- Organized test categories (unit, integration, e2e)
- Centralized location for test fixtures and helpers
- Ability to run specific test categories independently

## Test Types

### Unit Tests

Unit tests focus on testing individual components in isolation:

- **MCP Tools**: Test each tool implementation independently
- **MCP Resources**: Test resource handlers
- **Deployment Services**: Test deployment logic
- **Utility Functions**: Test helper functions

### Integration Tests

Integration tests verify that different components work together correctly:

- **HTTP Transport**: Test the HTTP endpoints and message handling
- **Stdio Transport**: Test the stdio transport mechanism
- **Resource and Tool Discovery**: Test the discovery mechanisms

### End-to-End Tests

E2E tests validate complete workflows:

- **Deployment Flows**: Test the entire deployment process
- **Error Handling**: Test error scenarios and recovery
- **Cross-Component Interactions**: Test how all components work together

## Setup and Configuration

### Dependencies

Install the necessary testing dependencies:

```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest nock aws-sdk-mock
```

### Jest Configuration

Create a Jest configuration file (`jest.config.js`):

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/test/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  moduleNameMapper: {
    // Map source imports to the actual source files
    '^@src/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/test/helpers/setup.ts']
};
```

### TypeScript Path Aliases

Update `tsconfig.json` to support path aliases:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@src/*": ["src/*"],
      "@test/*": ["test/*"]
    }
  }
}
```

### NPM Scripts

Add test scripts to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest test/unit",
    "test:integration": "jest test/integration",
    "test:e2e": "jest test/e2e"
  }
}
```

## Writing Tests

### Unit Test Example

```typescript
// test/unit/mcp/tools/deploy.test.ts
import { handleDeploy } from '@src/mcp/tools/deploy';
import * as deployService from '@src/deployment/deploy-service';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('@src/deployment/deploy-service');
jest.mock('fs');
jest.mock('path');

describe('Deploy Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should validate required parameters', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-project',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: '/path/to/artifacts',
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap'
      }
    };
    
    // Mock fs.existsSync and fs.statSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ mode: 0o755 });
    
    // Mock deploy function
    (deployService.deploy as jest.Mock).mockResolvedValue({
      status: 'success',
      message: 'Deployment completed'
    });
    
    const result = await handleDeploy(params);
    expect(result.status).toBe('success');
    expect(deployService.deploy).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentType: 'backend',
        projectName: 'test-project'
      }),
      expect.any(Function)
    );
  });
});
```

### Integration Test Example

```typescript
// test/integration/http-transport.test.ts
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { toolDefinitions } from '@src/mcp/tools/index';
import resources from '@src/mcp/resources/index';

describe('MCP Server HTTP Transport', () => {
  let app: express.Application;
  let server: McpServer;

  beforeAll(() => {
    app = express();
    app.use(cors());
    app.use(bodyParser.json());
    
    server = new McpServer();
    
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
});
```

### End-to-End Test Example

```typescript
// test/e2e/deploy-backend.test.ts
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Mock child_process
jest.mock('child_process');

describe('Backend Deployment E2E', () => {
  const fixturesPath = path.join(__dirname, '../fixtures');
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock filesystem
    jest.spyOn(fs, 'existsSync').mockImplementation((path: string) => {
      if (path.includes('bootstrap')) {
        return true;
      }
      return false;
    });
    
    jest.spyOn(fs, 'statSync').mockImplementation((path: string) => {
      return {
        mode: 0o755,
        isDirectory: () => path.includes('artifacts')
      } as any;
    });
  });
  
  test('should deploy backend application end-to-end', async () => {
    // Mock spawn for SAM CLI
    const mockSpawn = {
      stdout: {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback('Successfully deployed');
          }
        })
      },
      stderr: {
        on: jest.fn()
      },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          callback(0); // Exit code 0 means success
        }
      })
    };
    (spawn as jest.Mock).mockReturnValue(mockSpawn);
    
    // Import the module that uses spawn
    const { deploy } = require('@src/deployment/deploy-service');
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-api',
      projectRoot: path.join(fixturesPath, 'project'),
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: path.join(fixturesPath, 'artifacts/backend'),
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap'
      }
    };
    
    const statusCallback = jest.fn();
    const result = await deploy(params, statusCallback);
    
    expect(result.status).toBe('success');
    expect(statusCallback).toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledWith(
      'sam',
      expect.arrayContaining(['deploy']),
      expect.any(Object)
    );
  });
});
```

## Test Fixtures and Mocks

### AWS Service Mocks

Create reusable AWS mocking utilities:

```typescript
// test/helpers/aws-mocks.ts
import { mockClient } from 'aws-sdk-mock';
import AWS from 'aws-sdk';

export function mockCloudFormation() {
  mockClient(AWS.CloudFormation);
  
  AWS.CloudFormation.prototype.describeStacks = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({
        Stacks: [{
          StackName: 'test-stack',
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [
            { OutputKey: 'ApiUrl', OutputValue: 'https://api.example.com' }
          ]
        }]
      })
    };
  });
  
  return AWS.CloudFormation;
}

export function mockS3() {
  mockClient(AWS.S3);
  
  AWS.S3.prototype.putObject = jest.fn().mockImplementation(() => {
    return {
      promise: () => Promise.resolve({ ETag: '"mock-etag"' })
    };
  });
  
  return AWS.S3;
}
```

### Child Process Mocks

Create helpers for mocking child processes:

```typescript
// test/helpers/process-mocks.ts
import { EventEmitter } from 'events';

export function createMockChildProcess(options = {}) {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const childProcess = new EventEmitter();
  
  return {
    stdout,
    stderr,
    ...childProcess,
    // Helper to simulate process completion
    simulateSuccess: (output = 'Success') => {
      stdout.emit('data', output);
      childProcess.emit('close', 0);
    },
    simulateError: (error = 'Error') => {
      stderr.emit('data', error);
      childProcess.emit('close', 1);
    },
    ...options
  };
}
```

### Mock Files

Create sample files for testing:

```
test/fixtures/artifacts/backend/bootstrap
test/fixtures/artifacts/frontend/index.html
test/fixtures/templates/backend-template.yaml
test/fixtures/templates/frontend-template.yaml
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    - run: npm ci
    - run: npm run build
    - run: npm test
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
```

### Coverage Thresholds

Set coverage thresholds in `package.json`:

```json
"jest": {
  "collectCoverageFrom": [
    "src/**/*.{ts,js}",
    "!src/**/*.d.ts"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

## Implementation Plan

### Phase 1: Setup Test Infrastructure

1. Create the test directory structure
2. Configure Jest and TypeScript
3. Set up test helpers and mocks
4. Create initial test fixtures

### Phase 2: Unit Tests

1. Test MCP tools
   - Deploy tool
   - Configure domain tool
   - Provision database tool
   - Get logs tool
   - Get metrics tool
2. Test MCP resources
   - Template resources
   - Deployment resources
3. Test deployment services
   - CloudFormation integration
   - Frontend upload
   - Database provisioning
4. Test utility functions

### Phase 3: Integration Tests

1. Test HTTP transport
   - Resource endpoints
   - Tool invocation
   - Error handling
2. Test stdio transport
3. Test resource and tool discovery

### Phase 4: End-to-End Tests

1. Test backend deployment flow
2. Test frontend deployment flow
3. Test fullstack deployment flow
4. Test error scenarios and edge cases

### Phase 5: CI/CD and Reporting

1. Configure GitHub Actions
2. Set up coverage reporting
3. Implement coverage thresholds
4. Create test documentation

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on the state from other tests
2. **Mock External Dependencies**: Always mock AWS services, file system, and child processes
3. **Clear Test Names**: Use descriptive test names that explain what is being tested
4. **Arrange-Act-Assert**: Structure tests with clear setup, action, and verification phases
5. **Test Edge Cases**: Include tests for error conditions and edge cases
6. **Keep Tests Fast**: Optimize tests to run quickly to encourage frequent testing
7. **Maintain Test Coverage**: Aim for high test coverage, especially for critical components

## Test Coverage Improvement Plan

### 1. Summary of Current State

After analyzing the current test coverage, we've identified several areas for improvement:

- A well-structured test directory following best practices
- Unit tests for most components
- Integration tests for HTTP transport
- Coverage thresholds set in Jest configuration

However, there are several issues to address:

1. **Failed Tests**: Many tests are failing due to:
   - TypeScript type annotation issues in Jest
   - Module import problems
   - Mock implementation issues

2. **Coverage Gaps**: Some areas have low coverage:
   - Template rendering (47.79%)
   - Deployment validation
   - Dependency installation

### 2. Immediate Fixes

#### 2.1 Fix TypeScript Test Issues

The main issue is with TypeScript type annotations in tests. We need to:

1. Update Jest configuration to properly handle TypeScript:
   - Add `ts-jest` transformer instead of `esbuild-jest`
   - Configure proper handling of type annotations

2. Fix module import paths:
   - Update relative imports to use the correct paths
   - Ensure mocks are properly set up

#### 2.2 Fix Mock Implementation Issues

Several tests fail because mocks aren't properly implemented:

1. Update AWS mocks to use the correct AWS SDK v3 structure
2. Fix process utility mocks
3. Ensure Handlebars is properly mocked for template rendering

### 3. New Tests to Add

#### 3.1 Template Module Tests

- Improve template registry tests
- Add more comprehensive template rendering tests
- Test template discovery with various configurations

#### 3.2 Deployment Service Tests

- Add tests for deployment validation
- Improve dependency installation tests
- Add tests for startup script generation
- Test error handling scenarios

#### 3.3 MCP Resource Tests

- Complete deployment list resource tests
- Add template list resource tests
- Test resource error handling

#### 3.4 Utility Tests

- Expand file system utility tests
- Add process utility tests
- Improve logger tests

### 4. Integration Tests

- Add tests for the MCP server with HTTP transport
- Test tool invocation through the MCP interface
- Test resource retrieval through the MCP interface

### 5. End-to-End Tests

- Add tests for complete deployment workflows
- Test backend deployment
- Test frontend deployment
- Test fullstack deployment

### 6. Implementation Plan

#### Phase 1: Fix Existing Tests

1. Update Jest configuration to properly handle TypeScript
2. Fix module import issues
3. Update mock implementations

#### Phase 2: Improve Unit Test Coverage

1. Add missing tests for template module
2. Add missing tests for deployment service
3. Complete MCP resource tests
4. Expand utility tests

#### Phase 3: Add Integration and E2E Tests

1. Implement integration tests for MCP server
2. Add end-to-end tests for deployment workflows

### 7. Recommendations for Test Infrastructure

1. **Update Jest Configuration**: Switch to `ts-jest` for better TypeScript support
2. **Improve Mock Helpers**: Enhance AWS and process mock helpers
3. **Add Test Fixtures**: Create more comprehensive test fixtures
4. **CI Integration**: Ensure tests run in CI pipeline

## Conclusion

This testing strategy provides a comprehensive approach to ensuring the quality and reliability of the Serverless Web MCP Server. By implementing these testing practices and the test coverage improvement plan, we can confidently make changes to the codebase, add new features, and fix bugs without introducing regressions.
