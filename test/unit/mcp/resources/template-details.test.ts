import templateDetails from '../../../../src/mcp/resources/template-details';

describe('Template Details Resource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return details for a valid template', async () => {
    const result = await templateDetails.handler('template:backend', { name: 'backend' }, {});

    expect(result).toHaveProperty('contents');
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]).toHaveProperty('uri', 'template:backend');
    
    const content = JSON.parse(result.contents[0].text);
    expect(content).toHaveProperty('name', 'backend');
    expect(content).toHaveProperty('description');
    expect(content).toHaveProperty('frameworks');
    expect(content).toHaveProperty('parameters');
    expect(content).toHaveProperty('example');
  });

  test('should handle template not found error', async () => {
    const result = await templateDetails.handler('template:non-existent', { name: 'non-existent' }, {});

    expect(result).toHaveProperty('contents');
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]).toHaveProperty('uri', 'template:non-existent');
    
    const content = JSON.parse(result.contents[0].text);
    expect(content).toHaveProperty('error', "Template 'non-existent' not found");
    
    expect(result).toHaveProperty('metadata');
    expect(result.metadata).toHaveProperty('error', "Template 'non-existent' not found");
  });

  test('should handle missing template name', async () => {
    const result = await templateDetails.handler('template:', { name: undefined }, {});

    expect(result).toHaveProperty('contents');
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]).toHaveProperty('uri', 'template:unknown');
    
    const content = JSON.parse(result.contents[0].text);
    expect(content).toHaveProperty('error', 'Missing template name');
    
    expect(result).toHaveProperty('metadata');
    expect(result.metadata).toHaveProperty('error', 'Missing template name');
  });
});
