/**
 * Template List Resource
 * 
 * Provides a list of available deployment templates.
 */

import { McpResource } from './index.js';

/**
 * Handler for the template:list resource
 * 
 * @returns - List of available templates
 */
async function handleTemplateList(): Promise<any> {
  const templates = [
    {
      name: 'backend',
      description: 'Backend service using API Gateway and Lambda',
      frameworks: ['express', 'flask', 'fastapi', 'nodejs']
    },
    {
      name: 'frontend',
      description: 'Frontend application using S3 and CloudFront',
      frameworks: ['react', 'vue', 'angular', 'static']
    },
    {
      name: 'fullstack',
      description: 'Combined backend and frontend deployment',
      frameworks: ['express+react', 'flask+vue', 'fastapi+react', 'nextjs']
    },
    {
      name: 'database',
      description: 'DynamoDB database',
      type: 'dynamodb'
    }
  ];

  // Format the response according to MCP protocol requirements
  const contents = templates.map(template => ({
    uri: `template:${template.name}`,
    text: JSON.stringify(template)
  }));

  return {
    contents: contents,
    metadata: {
      count: templates.length
    }
  };
}

/**
 * Template List resource definition
 */
const templateList: McpResource = {
  name: 'template-list',
  uri: 'template:list',
  description: 'List of available deployment templates',
  handler: handleTemplateList
};

export default templateList;
