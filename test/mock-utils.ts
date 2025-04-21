/**
 * Common mock utilities for tests
 */

// Mock logger
export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock deployment service
export const mockDeployApplication = jest.fn().mockResolvedValue({
  success: true,
  status: 'INITIATED',
  deploymentId: 'test-deployment-id',
  stackName: 'test-stack'
});

// Mock template renderer
export const mockRenderTemplate = jest.fn().mockResolvedValue('mock SAM template');

// Mock process utilities
export const mockExecuteCommand = jest.fn().mockResolvedValue({
  success: true,
  stdout: 'command output',
  stderr: ''
});

// Mock fs utilities
export const mockFsUtils = {
  copyDirectory: jest.fn(),
  ensureDirectoryExists: jest.fn(),
  isExecutable: jest.fn().mockReturnValue(true)
};

// Setup common mocks for tests
export function setupCommonMocks() {
  // Mock logger
  jest.mock('../src/utils/logger', () => ({
    logger: mockLogger
  }));

  // Mock deployment service
  jest.mock('../src/deployment/deploy-service', () => ({
    deployApplication: mockDeployApplication,
    getDeploymentStatus: jest.fn().mockResolvedValue({
      status: 'COMPLETE',
      outputs: {
        ApiUrl: 'https://example.com/api'
      }
    })
  }));

  // Mock template renderer
  jest.mock('../src/template/renderer', () => ({
    renderTemplate: mockRenderTemplate
  }));

  // Mock process utilities
  jest.mock('../src/utils/process', () => ({
    executeCommand: mockExecuteCommand
  }));

  // Mock fs utilities
  jest.mock('../src/utils/fs-utils', () => mockFsUtils);
}
