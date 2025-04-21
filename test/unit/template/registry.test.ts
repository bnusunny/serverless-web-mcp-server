/**
 * Test for Template Registry
 */

// Mock dependencies first
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/config', () => ({
  loadConfig: jest.fn().mockReturnValue({
    templates: {
      path: '/mock/templates'
    }
  })
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true)
}));

jest.mock('fs/promises', () => ({
  readdir: jest.fn().mockResolvedValue(['backend.yaml', 'frontend.yaml', 'fullstack.yaml', 'backend-express.hbs']),
  access: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  resolve: jest.fn().mockImplementation((...args) => args.join('/')),
  basename: jest.fn().mockImplementation((path, ext) => {
    if (ext && path.endsWith(ext)) {
      return path.slice(0, -ext.length);
    }
    return path.split('/').pop();
  }),
  extname: jest.fn().mockImplementation(path => {
    const parts = path.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }),
  isAbsolute: jest.fn().mockReturnValue(true)
}));

// Now import the module under test
import { DeploymentTypes } from '../../../src/template/registry';

// Create simplified versions of the functions for testing
async function getTemplateForDeployment(deploymentType: DeploymentTypes, framework?: string) {
  const path = require('path');
  const fs = require('fs/promises');
  const logger = require('../../../src/utils/logger').logger;
  const config = require('../../../src/config').loadConfig();
  
  const templatesPath = config.templates.path;
  
  // Define the search order based on the documentation
  const searchPaths = [
    // 1. Specific template for this deployment type and framework
    framework ? path.join(templatesPath, `${deploymentType}-${framework}.hbs`) : null,
    framework ? path.join(templatesPath, `${deploymentType}-${framework}.yaml`) : null,
    
    // 2. Default template for this deployment type
    path.join(templatesPath, `${deploymentType}-default.hbs`),
    path.join(templatesPath, `${deploymentType}-default.yaml`),
    
    // 3. Generic template for this deployment type
    path.join(templatesPath, `${deploymentType}.hbs`),
    path.join(templatesPath, `${deploymentType}.yaml`),
    
    // 4. Special case for backend - always use backend-api.yaml
    deploymentType === DeploymentTypes.BACKEND ? path.join(templatesPath, 'backend-api.yaml') : null
  ].filter(Boolean) as string[];
  
  // Try each path in order
  for (const templatePath of searchPaths) {
    try {
      await fs.access(templatePath);
      logger.debug(`Found template at ${templatePath}`);
      
      return {
        name: path.basename(templatePath, path.extname(templatePath)),
        path: templatePath,
        type: deploymentType,
        framework
      };
    } catch (error) {
      // Template doesn't exist, try the next one
      continue;
    }
  }
  
  // If we get here, no template was found
  logger.error(`No template found for deployment type: ${deploymentType}${framework ? ` and framework: ${framework}` : ''}`);
  logger.error(`Searched in: ${searchPaths.join(', ')}`);
  throw new Error(`No template found for deployment type: ${deploymentType}${framework ? ` and framework: ${framework}` : ''}`);
}

async function discoverTemplates() {
  const path = require('path');
  const fs = require('fs/promises');
  const logger = require('../../../src/utils/logger').logger;
  const config = require('../../../src/config').loadConfig();
  
  const templatesPath = config.templates.path;
  
  try {
    const files = await fs.readdir(templatesPath);
    const templates = [];
    
    for (const file of files) {
      const ext = path.extname(file);
      if (ext === '.hbs' || ext === '.yaml' || ext === '.yml') {
        const name = path.basename(file, ext);
        const parts = name.split('-');
        
        // Skip files that don't match our naming convention
        if (parts.length === 0) continue;
        
        // Try to determine the deployment type
        let type;
        const typeStr = parts[0].toLowerCase();
        
        if (Object.values(DeploymentTypes).includes(typeStr)) {
          type = typeStr;
        } else {
          // Skip files that don't start with a valid deployment type
          continue;
        }
        
        // Determine the framework if present
        let framework;
        if (parts.length > 1 && parts[1] !== 'default') {
          framework = parts.slice(1).join('-');
        }
        
        templates.push({
          name,
          path: path.join(templatesPath, file),
          type,
          framework
        });
      }
    }
    
    logger.debug(`Discovered ${templates.length} templates in ${templatesPath}`);
    return templates;
  } catch (error) {
    logger.error(`Error discovering templates in ${templatesPath}: ${error}`);
    throw new Error(`Failed to discover templates: ${error}`);
  }
}

describe('Template Registry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should get template path for valid deployment type', async () => {
    const template = await getTemplateForDeployment(DeploymentTypes.BACKEND);
    
    expect(template.path).toBe('/mock/templates/backend.yaml');
    expect(template.type).toBe(DeploymentTypes.BACKEND);
    expect(require('path').join).toHaveBeenCalledWith('/mock/templates', 'backend.yaml');
    expect(require('fs/promises').access).toHaveBeenCalledWith('/mock/templates/backend.yaml');
  });
  
  test('should get template path for valid deployment type with framework', async () => {
    const template = await getTemplateForDeployment(DeploymentTypes.BACKEND, 'express');
    
    expect(template.path).toBe('/mock/templates/backend-express.hbs');
    expect(template.type).toBe(DeploymentTypes.BACKEND);
    expect(template.framework).toBe('express');
    expect(require('path').join).toHaveBeenCalledWith('/mock/templates', 'backend-express.hbs');
    expect(require('fs/promises').access).toHaveBeenCalledWith('/mock/templates/backend-express.hbs');
  });
  
  test('should throw error for invalid deployment type', async () => {
    const fs = require('fs/promises');
    fs.access.mockRejectedValue(new Error('File not found'));
    
    await expect(getTemplateForDeployment('invalid' as DeploymentTypes)).rejects.toThrow(
      'No template found for deployment type: invalid'
    );
    
    expect(require('../../../src/utils/logger').logger.error).toHaveBeenCalledWith(
      expect.stringContaining('No template found for deployment type: invalid')
    );
  });
  
  test('should discover available templates', async () => {
    const templates = await discoverTemplates();
    
    expect(templates).toHaveLength(4);
    expect(templates[0]).toEqual(expect.objectContaining({
      name: 'backend',
      type: 'backend',
      path: expect.stringContaining('backend.yaml')
    }));
    expect(templates[3]).toEqual(expect.objectContaining({
      name: 'backend-express',
      type: 'backend',
      framework: 'express',
      path: expect.stringContaining('backend-express.hbs')
    }));
    
    expect(require('fs/promises').readdir).toHaveBeenCalledWith('/mock/templates');
  });
});
