import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

/**
 * Deploy using AWS SAM CLI
 */
export async function deploySAM(templateDir: string, configuration: any): Promise<any> {
  const stackName = `${configuration.projectName}-stack`;
  const region = configuration.region || 'us-east-1';
  
  logger.info(`Deploying SAM template from ${templateDir} to stack ${stackName} in ${region}`);
  
  // Build SAM template
  await runSAMCommand(['build', '--template-file', 'template.yaml'], templateDir);
  
  // Deploy SAM template
  const deployResult = await runSAMCommand([
    'deploy',
    '--template-file', '.aws-sam/build/template.yaml',
    '--stack-name', stackName,
    '--region', region,
    '--capabilities', 'CAPABILITY_IAM',
    '--no-confirm-changeset',
    '--no-fail-on-empty-changeset'
  ], templateDir);
  
  // Get stack outputs
  const outputs = await getStackOutputs(stackName, region);
  
  return {
    stackName,
    region,
    outputs,
    deployResult
  };
}

/**
 * Run a SAM CLI command
 */
function runSAMCommand(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sam = spawn('sam', args, { cwd });
    let output = '';
    
    sam.stdout.on('data', (data) => {
      output += data.toString();
      logger.debug(data.toString());
    });
    
    sam.stderr.on('data', (data) => {
      logger.debug(data.toString());
    });
    
    sam.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`SAM command failed with code ${code}`));
      }
    });
    
    sam.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Get CloudFormation stack outputs
 */
async function getStackOutputs(stackName: string, region: string): Promise<any> {
  const args = [
    'list', 'stack-outputs',
    '--stack-name', stackName,
    '--region', region,
    '--output', 'json'
  ];
  
  try {
    const output = await runSAMCommand(args, process.cwd());
    return JSON.parse(output);
  } catch (error) {
    logger.error(`Failed to get stack outputs: ${error}`);
    return {};
  }
}
