// test/helpers/setup.js

// Set up global Jest environment
jest.setTimeout(30000); // Increase timeout for async tests

// Mock AWS SDK v3
jest.mock('@aws-sdk/client-cloudformation', () => {
  return {
    CloudFormationClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({
        StackSummaries: [
          {
            StackName: 'test-api',
            StackStatus: 'CREATE_COMPLETE',
            CreationTime: new Date('2023-01-01T00:00:00Z'),
            TemplateDescription: 'Test API Stack'
          },
          {
            StackName: 'test-website',
            StackStatus: 'CREATE_COMPLETE',
            CreationTime: new Date('2023-01-02T00:00:00Z'),
            TemplateDescription: 'Test Website Stack'
          }
        ]
      })
    })),
    ListStacksCommand: jest.fn().mockImplementation(() => ({})),
    DescribeStacksCommand: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({})
    })),
    PutObjectCommand: jest.fn().mockImplementation(() => ({})),
    ListObjectsV2Command: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('@aws-sdk/client-cloudfront', () => {
  return {
    CloudFrontClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({})
    })),
    CreateInvalidationCommand: jest.fn().mockImplementation(() => ({}))
  };
});

// Mock modules that are imported with .js extension
jest.mock('../../src/deployment/deploy-service.js', () => {
  const mockDeployments = new Map();
  
  return {
    deployApplication: jest.fn().mockImplementation((params) => {
      if (params.projectRoot === '/nonexistent/path') {
        return Promise.resolve({
          success: false,
          url: '',
          resources: {},
          error: 'Project root directory does not exist',
          status: 'FAILED'
        });
      }
      
      return Promise.resolve({
        success: true,
        url: '',
        resources: {},
        status: 'INITIATED',
        stackName: `${params.projectName}-123456`,
        deploymentId: 'deploy-1234567890',
        outputs: {
          message: `Deployment initiated. Check status with resource: deployment:${params.projectName}`
        }
      });
    }),
    
    getDeploymentStatus: jest.fn().mockImplementation((projectName) => {
      if (projectName === 'nonexistent-project') {
        return null;
      }
      
      if (projectName === 'failed-project') {
        return {
          success: false,
          url: '',
          resources: {},
          error: 'SAM build failed with code 1',
          status: 'FAILED',
          stackName: `${projectName}-123456`,
          deploymentId: 'deploy-1234567890'
        };
      }
      
      if (projectName === 'building-project') {
        return {
          success: false,
          url: '',
          resources: {},
          status: 'BUILDING',
          stackName: `${projectName}-123456`,
          deploymentId: 'deploy-1234567890'
        };
      }
      
      // Default to a successful deployment
      return {
        success: true,
        url: `https://${projectName}.example.com`,
        resources: {
          apiGateway: `https://${projectName}-api.example.com`,
          lambda: `${projectName}-lambda`,
          s3Bucket: `${projectName}-bucket`,
          cloudFront: `${projectName}-distribution`
        },
        outputs: {
          ApiEndpoint: `https://${projectName}-api.example.com`,
          WebsiteURL: `https://${projectName}.example.com`
        },
        status: 'COMPLETE',
        stackName: `${projectName}-123456`,
        deploymentId: 'deploy-1234567890'
      };
    }),
    
    // Expose the mock deployments map for test manipulation
    deployments: mockDeployments,
    
    // Add runDeploymentProcess mock
    runDeploymentProcess: jest.fn().mockImplementation((params, deploymentId, stackName) => {
      return Promise.resolve({
        status: 'DEPLOYED',
        message: 'Deployment completed successfully',
        url: 'https://example.com'
      });
    })
  };
}, { virtual: true });

jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}), { virtual: true });

jest.mock('../../src/template/renderer.js', () => ({
  renderTemplate: jest.fn().mockResolvedValue('mock template content')
}), { virtual: true });

jest.mock('../../src/template/registry.js', () => ({
  getTemplateForDeployment: jest.fn().mockImplementation((type, framework) => {
    if (type === 'frontend' && framework === 'react') {
      return Promise.resolve({
        name: 'frontend-react',
        path: '/path/to/templates/frontend-react.hbs',
        type: 'frontend',
        framework: 'react'
      });
    }
    
    if (type === 'fullstack') {
      return Promise.resolve({
        name: 'fullstack',
        path: '/path/to/templates/fullstack.hbs',
        type: 'fullstack'
      });
    }
    
    return Promise.resolve({
      name: 'backend',
      path: '/path/to/templates/backend.hbs',
      type: 'backend'
    });
  }),
  DeploymentTypes: {
    BACKEND: 'backend',
    FRONTEND: 'frontend',
    FULLSTACK: 'fullstack'
  },
  discoverTemplates: jest.fn().mockResolvedValue([
    {
      name: 'backend-express',
      path: 'templates/backend-express.yaml',
      type: 'backend',
      framework: 'express'
    },
    {
      name: 'frontend-react',
      path: 'templates/frontend-react.yaml',
      type: 'frontend',
      framework: 'react'
    },
    {
      name: 'fullstack',
      path: 'templates/fullstack.yaml',
      type: 'fullstack'
    }
  ]),
  listTemplates: jest.fn().mockResolvedValue([
    {
      name: 'backend-express',
      path: 'templates/backend-express.yaml',
      type: 'backend',
      framework: 'express'
    },
    {
      name: 'frontend-react',
      path: 'templates/frontend-react.yaml',
      type: 'frontend',
      framework: 'react'
    }
  ]),
  getTemplateInfo: jest.fn().mockImplementation((name) => {
    if (name === 'frontend-react') {
      return Promise.resolve({
        name: 'frontend-react',
        path: 'templates/frontend-react.yaml',
        type: 'frontend',
        framework: 'react'
      });
    }
    if (name === 'backend-express') {
      return Promise.resolve({
        name: 'backend-express',
        path: 'templates/backend-express.yaml',
        type: 'backend',
        framework: 'express'
      });
    }
    return Promise.reject(new Error(`Template not found: ${name}`));
  })
}), { virtual: true });

// Mock child_process
jest.mock('child_process', () => {
  return {
    spawn: jest.fn().mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: jest.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              callback('mock output');
            }
            return mockProcess.stdout;
          })
        },
        stderr: {
          on: jest.fn().mockImplementation((event, callback) => {
            return mockProcess.stderr;
          })
        },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
          return mockProcess;
        })
      };
      return mockProcess;
    }),
    exec: jest.fn().mockImplementation((command, options, callback) => {
      if (callback) {
        callback(null, 'mock output', '');
      }
      return {
        stdout: {
          on: jest.fn()
        },
        stderr: {
          on: jest.fn()
        },
        on: jest.fn()
      };
    })
  };
});

// Mock fs
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue('mock file content'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    copyFileSync: jest.fn(),
    readdirSync: jest.fn().mockReturnValue(['file1.txt', 'file2.txt']),
    statSync: jest.fn().mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      mode: 0o755
    }),
    chmodSync: jest.fn(),
    access: jest.fn().mockImplementation((path, mode, callback) => {
      if (callback) {
        callback(null);
      } else {
        return Promise.resolve();
      }
    })
  };
});

// Mock path
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    join: jest.fn((...args) => args.join('/')),
    resolve: jest.fn((...args) => args.join('/')),
    dirname: jest.fn(p => p.split('/').slice(0, -1).join('/')),
    basename: jest.fn(p => p.split('/').pop()),
    extname: jest.fn(p => {
      const parts = p.split('.');
      return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
    })
  };
});

// Mock Handlebars
jest.mock('handlebars', () => {
  return {
    compile: jest.fn().mockReturnValue(() => 'mock compiled template'),
    registerHelper: jest.fn()
  };
});

// Add more mocks as needed
