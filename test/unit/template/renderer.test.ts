/**
 * Test for Template Renderer
 */
import { renderTemplate } from '../../../src/template/renderer';
import { getTemplateForDeployment, DeploymentTypes } from '../../../src/template/registry';
import fs from 'fs';
import Handlebars from 'handlebars';

// Mock dependencies
jest.mock('../../../src/template/registry', () => ({
  getTemplateForDeployment: jest.fn(),
  DeploymentTypes: {
    BACKEND: 'backend',
    FRONTEND: 'frontend',
    FULLSTACK: 'fullstack'
  }
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn()
}));

jest.mock('handlebars', () => ({
  compile: jest.fn(),
  registerHelper: jest.fn()
}));

describe('Template Renderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    (fs.readFileSync as jest.Mock).mockReturnValue('template content');
    (Handlebars.compile as jest.Mock).mockReturnValue(() => 'rendered-template-content');
    (getTemplateForDeployment as jest.Mock).mockResolvedValue({
      name: 'test-template',
      path: '/path/to/template.yaml',
      type: 'backend'
    });
  });
  
  test('should render a backend template successfully', async () => {
    const params = {
      deploymentType: 'backend',
      projectName: 'test-api',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: '/path/to/artifacts',
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap',
        framework: 'express'
      }
    };
    
    const result = await renderTemplate(params);
    
    expect(result).toBe('rendered-template-content');
    expect(getTemplateForDeployment).toHaveBeenCalledWith(DeploymentTypes.BACKEND, 'express');
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/template.yaml', 'utf8');
    expect(Handlebars.compile).toHaveBeenCalledWith('template content');
  });
  
  test('should render a frontend template successfully', async () => {
    const params = {
      deploymentType: 'frontend',
      projectName: 'test-website',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      frontendConfiguration: {
        builtAssetsPath: '/path/to/assets',
        indexDocument: 'index.html',
        framework: 'react'
      }
    };
    
    const result = await renderTemplate(params);
    
    expect(result).toBe('rendered-template-content');
    expect(getTemplateForDeployment).toHaveBeenCalledWith(DeploymentTypes.FRONTEND, 'react');
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/template.yaml', 'utf8');
    expect(Handlebars.compile).toHaveBeenCalledWith('template content');
  });
  
  test('should render a fullstack template with combined framework', async () => {
    const params = {
      deploymentType: 'fullstack',
      projectName: 'test-fullstack',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: '/path/to/backend',
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap',
        framework: 'express'
      },
      frontendConfiguration: {
        builtAssetsPath: '/path/to/frontend',
        indexDocument: 'index.html',
        framework: 'react'
      }
    };
    
    const result = await renderTemplate(params);
    
    expect(result).toBe('rendered-template-content');
    expect(getTemplateForDeployment).toHaveBeenCalledWith(DeploymentTypes.FULLSTACK, 'express-react');
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/template.yaml', 'utf8');
    expect(Handlebars.compile).toHaveBeenCalledWith('template content');
  });
  
  test('should handle template rendering errors', async () => {
    // Mock Handlebars.compile to throw an error
    (Handlebars.compile as jest.Mock).mockImplementation(() => {
      throw new Error('Template compilation error');
    });
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-api',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: '/path/to/artifacts',
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap'
      }
    };
    
    await expect(renderTemplate(params)).rejects.toThrow('Failed to render template');
  });
  
  test('should handle template not found errors', async () => {
    // Mock getTemplateForDeployment to throw an error
    (getTemplateForDeployment as jest.Mock).mockRejectedValue(new Error('Template not found'));
    
    const params = {
      deploymentType: 'backend',
      projectName: 'test-api',
      projectRoot: '/path/to/project',
      region: 'us-east-1',
      backendConfiguration: {
        builtArtifactsPath: '/path/to/artifacts',
        runtime: 'nodejs18.x',
        startupScript: 'bootstrap'
      }
    };
    
    await expect(renderTemplate(params)).rejects.toThrow('Template not found');
  });
});
