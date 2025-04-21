import { handleDeploymentHelp } from '../../../../src/mcp/tools/deployment-help';

describe('Deployment Help Tool', () => {
  test('should provide startup script help', async () => {
    const result = await handleDeploymentHelp({ topic: 'startup_script' });
    
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty('type', 'text');
    
    const helpContent = JSON.parse(result.content[0].text);
    expect(helpContent).toHaveProperty('success', true);
    expect(helpContent).toHaveProperty('topic', 'startup_script');
    expect(helpContent).toHaveProperty('content');
    expect(helpContent.content).toContain('Startup Script Help');
  });

  test('should provide artifacts path help', async () => {
    const result = await handleDeploymentHelp({ topic: 'artifacts_path' });
    
    expect(result).toHaveProperty('content');
    
    const helpContent = JSON.parse(result.content[0].text);
    expect(helpContent).toHaveProperty('success', true);
    expect(helpContent).toHaveProperty('topic', 'artifacts_path');
    expect(helpContent).toHaveProperty('content');
    expect(helpContent.content).toContain('Built Artifacts Path Help');
  });

  test('should provide permissions help', async () => {
    const result = await handleDeploymentHelp({ topic: 'permissions' });
    
    expect(result).toHaveProperty('content');
    
    const helpContent = JSON.parse(result.content[0].text);
    expect(helpContent).toHaveProperty('success', true);
    expect(helpContent).toHaveProperty('topic', 'permissions');
    expect(helpContent).toHaveProperty('content');
    expect(helpContent.content).toContain('AWS Permissions Help');
  });

  test('should provide project structure help', async () => {
    const result = await handleDeploymentHelp({ topic: 'project_structure' });
    
    expect(result).toHaveProperty('content');
    
    const helpContent = JSON.parse(result.content[0].text);
    expect(helpContent).toHaveProperty('success', true);
    expect(helpContent).toHaveProperty('topic', 'project_structure');
    expect(helpContent).toHaveProperty('content');
    expect(helpContent.content).toContain('Project Structure Help');
  });

  test('should provide database help', async () => {
    const result = await handleDeploymentHelp({ topic: 'database' });
    
    expect(result).toHaveProperty('content');
    
    const helpContent = JSON.parse(result.content[0].text);
    expect(helpContent).toHaveProperty('success', true);
    expect(helpContent).toHaveProperty('topic', 'database');
    expect(helpContent).toHaveProperty('content');
    expect(helpContent.content).toContain('Database Configuration Help');
  });

  test('should provide general help', async () => {
    const result = await handleDeploymentHelp({ topic: 'general' });
    
    expect(result).toHaveProperty('content');
    
    const helpContent = JSON.parse(result.content[0].text);
    expect(helpContent).toHaveProperty('success', true);
    expect(helpContent).toHaveProperty('topic', 'general');
    expect(helpContent).toHaveProperty('content');
    expect(helpContent.content).toContain('General Deployment Help');
  });

  test('should handle invalid topic gracefully', async () => {
    // @ts-ignore - Testing with invalid topic
    const result = await handleDeploymentHelp({ topic: 'invalid_topic' });
    
    expect(result).toHaveProperty('content');
    
    const helpContent = JSON.parse(result.content[0].text);
    expect(helpContent).toHaveProperty('success', true);
    expect(helpContent).toHaveProperty('topic', 'invalid_topic');
    expect(helpContent).toHaveProperty('content');
    expect(helpContent.content).toContain('General Deployment Help');
  });
});
