/**
 * Test for Template List Resource
 */
import { handleTemplateList } from '../../../../src/mcp/resources/template-list';
import { listTemplates } from '../../../../src/template/registry';

// Mock the template registry
jest.mock('../../../../src/template/registry', () => ({
  listTemplates: jest.fn(),
  DeploymentTypes: {
    BACKEND: 'backend',
    FRONTEND: 'frontend',
    FULLSTACK: 'fullstack'
  }
}));

describe('Template List Resource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return a list of available templates', async () => {
    // Mock listTemplates to return some templates
    (listTemplates as jest.Mock).mockResolvedValue([
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
    ]);

    const result = await handleTemplateList();

    expect(result).toHaveProperty('templates');
    expect(result.templates.length).toBe(3);
    expect(result.templates[0]).toHaveProperty('name');
    expect(result.templates[0]).toHaveProperty('type');
    expect(result.templates[0]).toHaveProperty('framework');
    expect(listTemplates).toHaveBeenCalled();
  });

  test('should handle empty template list', async () => {
    // Mock listTemplates to return empty array
    (listTemplates as jest.Mock).mockResolvedValue([]);

    const result = await handleTemplateList();

    expect(result).toHaveProperty('templates');
    expect(result.templates).toHaveLength(0);
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('No templates found');
  });

  test('should handle errors when listing templates', async () => {
    // Mock listTemplates to throw an error
    (listTemplates as jest.Mock).mockRejectedValue(
      new Error('Failed to read templates directory')
    );

    const result = await handleTemplateList();

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Failed to list templates');
    expect(listTemplates).toHaveBeenCalled();
  });
});
