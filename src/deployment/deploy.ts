import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config.js';

// Define deployment parameters interface
export interface DeploymentParams {
  deploymentType: 'backend' | 'frontend' | 'fullstack';
  source: {
    path?: string;
    content?: string;
  };
  framework: string;
  configuration: {
    projectName: string;
    region: string;
    tags?: Record<string, string>;
    backendConfiguration?: {
      runtime: string;
      memorySize: number;
      timeout: number;
      environment?: Record<string, string>;
    };
    frontendConfiguration?: {
      indexDocument: string;
      errorDocument: string;
      spa: boolean;
    };
    domain?: {
      name: string;
      createRoute53Records: boolean;
    };
  };
}

// Define deployment result interface
export interface DeploymentResult {
  deploymentId: string;
  deploymentType: string;
  projectName: string;
  endpoints: {
    api?: string;
    website?: string;
  };
  resources: {
    type: string;
    id: string;
    name: string;
  }[];
  timestamp: string;
}

/**
 * Deploy an application to AWS serverless infrastructure
 */
export async function deployApplication(params: DeploymentParams): Promise<DeploymentResult> {
  const config = loadConfig();
  const { deploymentType, source, framework, configuration } = params;
  const { projectName, region } = configuration;
  
  console.log(`Starting ${deploymentType} deployment for project ${projectName}`);
  
  // Create a temporary directory for the deployment
  const deploymentDir = path.join(process.cwd(), 'deployments', projectName);
  fs.mkdirSync(deploymentDir, { recursive: true });
  
  try {
    // Handle source code
    let sourcePath = '';
    if (source.path) {
      sourcePath = source.path;
    } else if (source.content) {
      // Create a temporary file with the provided content
      sourcePath = path.join(deploymentDir, 'source');
      fs.mkdirSync(sourcePath, { recursive: true });
      fs.writeFileSync(path.join(sourcePath, 'index.js'), source.content);
    } else {
      throw new Error('Either source.path or source.content must be provided');
    }
    
    // Generate SAM template based on deployment type
    const templatePath = await generateSamTemplate(deploymentType, framework, configuration, deploymentDir);
    
    // Execute SAM build
    console.log('Building application with SAM CLI...');
    execSync(`sam build -t ${templatePath} --use-container`, {
      cwd: deploymentDir,
      stdio: 'inherit'
    });
    
    // Execute SAM deploy
    console.log('Deploying application with SAM CLI...');
    execSync(`sam deploy --stack-name ${projectName} --region ${region} --no-confirm-changeset --capabilities CAPABILITY_IAM`, {
      cwd: deploymentDir,
      stdio: 'inherit'
    });
    
    // Get deployment outputs
    const outputs = getDeploymentOutputs(projectName, region);
    
    // Create deployment result
    const result: DeploymentResult = {
      deploymentId: `${projectName}-${Date.now()}`,
      deploymentType,
      projectName,
      endpoints: {
        api: outputs.ApiEndpoint,
        website: outputs.WebsiteUrl
      },
      resources: [
        // Add resources based on deployment type
        ...(deploymentType === 'backend' || deploymentType === 'fullstack' 
          ? [
              { type: 'ApiGateway', id: outputs.ApiId, name: `${projectName}-api` },
              { type: 'Lambda', id: outputs.LambdaFunctionArn, name: `${projectName}-function` }
            ] 
          : []),
        ...(deploymentType === 'frontend' || deploymentType === 'fullstack'
          ? [
              { type: 'S3Bucket', id: outputs.WebsiteBucket, name: `${projectName}-website` },
              { type: 'CloudFront', id: outputs.CloudFrontDistribution, name: `${projectName}-distribution` }
            ]
          : [])
      ],
      timestamp: new Date().toISOString()
    };
    
    // Save deployment information
    saveDeploymentInfo(result);
    
    return result;
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

/**
 * Generate a SAM template based on deployment type and configuration
 */
async function generateSamTemplate(
  deploymentType: string,
  framework: string,
  configuration: DeploymentParams['configuration'],
  deploymentDir: string
): Promise<string> {
  const config = loadConfig();
  const templatesPath = path.resolve(config.templates.path);
  
  // Determine which template to use based on deployment type and framework
  let templateFile = '';
  
  switch (deploymentType) {
    case 'backend':
      templateFile = `${framework}-backend.yaml`;
      break;
    case 'frontend':
      templateFile = 'frontend-website.yaml';
      break;
    case 'fullstack':
      templateFile = `${framework}-fullstack.yaml`;
      break;
    default:
      throw new Error(`Unsupported deployment type: ${deploymentType}`);
  }
  
  // Check if template exists
  let templateSourcePath = path.join(templatesPath, templateFile);
  if (!fs.existsSync(templateSourcePath)) {
    // Try fallback to old naming convention if new template doesn't exist
    const legacyTemplateFile = getLegacyTemplateFilename(deploymentType, framework);
    const legacyTemplatePath = path.join(templatesPath, legacyTemplateFile);
    
    if (fs.existsSync(legacyTemplatePath)) {
      console.log(`Template ${templateFile} not found, using legacy template ${legacyTemplateFile}`);
      templateFile = legacyTemplateFile;
    } else {
      throw new Error(`Template not found: ${templateFile} or ${legacyTemplateFile}`);
    }
  }
  
  // Read template content
  templateSourcePath = path.join(templatesPath, templateFile);
  let templateContent = fs.readFileSync(templateSourcePath, 'utf8');
  
  // Replace placeholders with configuration values
  templateContent = templateContent
    .replace(/\${PROJECT_NAME}/g, configuration.projectName)
    .replace(/\${REGION}/g, configuration.region);
  
  // Add backend-specific configurations
  if (deploymentType === 'backend' || deploymentType === 'fullstack') {
    const backendConfig = configuration.backendConfiguration;
    if (!backendConfig) {
      throw new Error('Backend configuration is required for backend or fullstack deployments');
    }
    
    templateContent = templateContent
      .replace(/\${RUNTIME}/g, backendConfig.runtime)
      .replace(/\${MEMORY_SIZE}/g, backendConfig.memorySize.toString())
      .replace(/\${TIMEOUT}/g, backendConfig.timeout.toString());
    
    // Handle environment variables
    if (backendConfig.environment) {
      const envVars = Object.entries(backendConfig.environment)
        .map(([key, value]) => `      ${key}: ${value}`)
        .join('\n');
      
      templateContent = templateContent.replace(/\${ENVIRONMENT_VARIABLES}/g, envVars);
    } else {
      templateContent = templateContent.replace(/\${ENVIRONMENT_VARIABLES}/g, '');
    }
  }
  
  // Add frontend website configurations
  if (deploymentType === 'frontend' || deploymentType === 'fullstack') {
    const frontendConfig = configuration.frontendConfiguration;
    if (!frontendConfig) {
      const defaultConfig = {
        indexDocument: 'index.html',
        errorDocument: 'index.html',
        spa: false
      };
      
      templateContent = templateContent
        .replace(/\${INDEX_DOCUMENT}/g, defaultConfig.indexDocument)
        .replace(/\${ERROR_DOCUMENT}/g, defaultConfig.errorDocument);
    } else {
      templateContent = templateContent
        .replace(/\${INDEX_DOCUMENT}/g, frontendConfig.indexDocument)
        .replace(/\${ERROR_DOCUMENT}/g, frontendConfig.errorDocument);
    }
  }
  
  // Write the processed template to the deployment directory
  const outputTemplatePath = path.join(deploymentDir, 'template.yaml');
  fs.writeFileSync(outputTemplatePath, templateContent);
  
  return outputTemplatePath;
}

/**
 * Get legacy template filename for backward compatibility
 */
function getLegacyTemplateFilename(deploymentType: string, framework: string): string {
  switch (deploymentType) {
    case 'backend':
      return `${framework}-api.yaml`;
    case 'frontend':
      return 'static-website.yaml';
    case 'fullstack':
      return `${framework}-fullstack.yaml`;
    default:
      return '';
  }
}

/**
 * Get deployment outputs from CloudFormation stack
 */
function getDeploymentOutputs(projectName: string, region: string): Record<string, string> {
  try {
    const outputJson = execSync(
      `aws cloudformation describe-stacks --stack-name ${projectName} --region ${region} --query "Stacks[0].Outputs" --output json`,
      { encoding: 'utf8' }
    );
    
    const outputs = JSON.parse(outputJson);
    const result: Record<string, string> = {};
    
    outputs.forEach((output: { OutputKey: string; OutputValue: string }) => {
      result[output.OutputKey] = output.OutputValue;
    });
    
    return result;
  } catch (error) {
    console.error('Failed to get deployment outputs:', error);
    return {};
  }
}

/**
 * Save deployment information to local storage
 */
function saveDeploymentInfo(deploymentResult: DeploymentResult): void {
  const deploymentsDir = path.join(process.cwd(), 'deployments');
  fs.mkdirSync(deploymentsDir, { recursive: true });
  
  const deploymentFile = path.join(deploymentsDir, `${deploymentResult.projectName}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResult, null, 2));
}
