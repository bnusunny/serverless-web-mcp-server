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
  return {
    templates: [
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
    ]
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
