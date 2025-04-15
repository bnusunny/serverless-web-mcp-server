import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

// Type for status update callback
type StatusCallback = (status: string) => void;

/**
 * Provision a database for an application
 */
export async function provisionDatabase(params: any, statusCallback?: StatusCallback): Promise<any> {
  const { projectName, databaseType, configuration } = params;
  
  try {
    // Send status update
    sendStatus(statusCallback, `Starting database provisioning for ${projectName}...`);
    
    // Validate parameters
    if (!projectName) {
      throw new Error('projectName is required');
    }
    
    if (!databaseType) {
      throw new Error('databaseType is required');
    }
    
    // Provision the database based on type
    if (databaseType === 'dynamodb') {
      return await provisionDynamoDBTable(projectName, configuration, statusCallback);
    } else if (databaseType === 'aurora-serverless') {
      return await provisionAuroraServerless(projectName, configuration, statusCallback);
    } else {
      throw new Error(`Unsupported database type: ${databaseType}`);
    }
  } catch (error) {
    logger.error('Database provisioning failed:', error);
    sendStatus(statusCallback, `Database provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Send a status update via the callback if provided
 */
function sendStatus(callback?: StatusCallback, message?: string): void {
  if (callback && message) {
    callback(message);
    logger.info(message); // Also log to file
  }
}

/**
 * Provision a DynamoDB table
 */
async function provisionDynamoDBTable(
  projectName: string,
  configuration: any,
  statusCallback?: StatusCallback
): Promise<any> {
  try {
    const tableName = configuration.tableName || `${projectName}-table`;
    const primaryKey = configuration.primaryKey || 'id';
    const sortKey = configuration.sortKey;
    
    sendStatus(statusCallback, `Creating DynamoDB table ${tableName}...`);
    
    // Build the create-table command
    const createTableParams: any = {
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        {
          AttributeName: primaryKey,
          AttributeType: 'S'
        }
      ],
      KeySchema: [
        {
          AttributeName: primaryKey,
          KeyType: 'HASH'
        }
      ]
    };
    
    // Add sort key if provided
    if (sortKey) {
      createTableParams.AttributeDefinitions.push({
        AttributeName: sortKey,
        AttributeType: 'S'
      });
      
      createTableParams.KeySchema.push({
        AttributeName: sortKey,
        KeyType: 'RANGE'
      });
      
      sendStatus(statusCallback, `Adding sort key: ${sortKey}`);
    }
    
    // Execute the create-table command
    const createResult = await executeAwsCommand([
      'dynamodb', 'create-table',
      '--cli-input-json', JSON.stringify(createTableParams),
      '--output', 'json'
    ], statusCallback);
    
    sendStatus(statusCallback, `Waiting for table to become active...`);
    
    // Wait for the table to become active
    await executeAwsCommand([
      'dynamodb', 'wait', 'table-exists',
      '--table-name', tableName
    ], statusCallback);
    
    // Get the table details
    const describeResult = await executeAwsCommand([
      'dynamodb', 'describe-table',
      '--table-name', tableName,
      '--output', 'json'
    ], statusCallback);
    
    const tableDetails = JSON.parse(describeResult.stdout).Table;
    
    sendStatus(statusCallback, `DynamoDB table ${tableName} created successfully.`);
    
    return {
      status: 'provisioned',
      projectName,
      databaseType: 'dynamodb',
      tableName,
      arn: tableDetails.TableArn,
      primaryKey,
      sortKey: sortKey || undefined
    };
  } catch (error) {
    throw new Error(`Failed to provision DynamoDB table: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Provision an Aurora Serverless cluster
 */
async function provisionAuroraServerless(
  projectName: string,
  configuration: any,
  statusCallback?: StatusCallback
): Promise<any> {
  try {
    const dbName = configuration.dbName || `${projectName.replace(/-/g, '_')}_db`;
    const engine = configuration.engine || 'postgresql';
    const capacity = configuration.capacity || 2;
    const clusterIdentifier = `${projectName}-cluster`;
    
    sendStatus(statusCallback, `Creating Aurora Serverless cluster ${clusterIdentifier}...`);
    
    // Create a security group for the cluster
    sendStatus(statusCallback, `Creating security group...`);
    const sgResult = await executeAwsCommand([
      'ec2', 'create-security-group',
      '--group-name', `${projectName}-db-sg`,
      '--description', `Security group for ${projectName} Aurora Serverless cluster`,
      '--output', 'json'
    ], statusCallback);
    
    const securityGroupId = JSON.parse(sgResult.stdout).GroupId;
    
    // Create the DB subnet group
    sendStatus(statusCallback, `Creating DB subnet group...`);
    
    // Get the default VPC
    const vpcResult = await executeAwsCommand([
      'ec2', 'describe-vpcs',
      '--filters', 'Name=isDefault,Values=true',
      '--output', 'json'
    ], statusCallback);
    
    const vpcId = JSON.parse(vpcResult.stdout).Vpcs[0].VpcId;
    
    // Get the subnets in the VPC
    const subnetResult = await executeAwsCommand([
      'ec2', 'describe-subnets',
      '--filters', `Name=vpc-id,Values=${vpcId}`,
      '--output', 'json'
    ], statusCallback);
    
    const subnets = JSON.parse(subnetResult.stdout).Subnets;
    const subnetIds = subnets.slice(0, 2).map((subnet: any) => subnet.SubnetId);
    
    // Create the DB subnet group
    await executeAwsCommand([
      'rds', 'create-db-subnet-group',
      '--db-subnet-group-name', `${projectName}-subnet-group`,
      '--db-subnet-group-description', `Subnet group for ${projectName} Aurora Serverless cluster`,
      '--subnet-ids', ...subnetIds,
      '--output', 'json'
    ], statusCallback);
    
    // Create the Aurora Serverless cluster
    sendStatus(statusCallback, `Creating Aurora Serverless cluster with ${engine} engine...`);
    
    const createResult = await executeAwsCommand([
      'rds', 'create-db-cluster',
      '--db-cluster-identifier', clusterIdentifier,
      '--engine', engine === 'postgresql' ? 'aurora-postgresql' : 'aurora',
      '--engine-mode', 'serverless',
      '--scaling-configuration', `MinCapacity=1,MaxCapacity=${capacity},AutoPause=true,SecondsUntilAutoPause=300`,
      '--master-username', 'admin',
      '--master-user-password', `${projectName}-password-${Math.floor(Math.random() * 10000)}`,
      '--db-subnet-group-name', `${projectName}-subnet-group`,
      '--vpc-security-group-ids', securityGroupId,
      '--database-name', dbName,
      '--output', 'json'
    ], statusCallback);
    
    sendStatus(statusCallback, `Waiting for Aurora Serverless cluster to become available...`);
    
    // Wait for the cluster to become available
    await executeAwsCommand([
      'rds', 'wait', 'db-cluster-available',
      '--db-cluster-identifier', clusterIdentifier
    ], statusCallback);
    
    // Get the cluster details
    const describeResult = await executeAwsCommand([
      'rds', 'describe-db-clusters',
      '--db-cluster-identifier', clusterIdentifier,
      '--output', 'json'
    ], statusCallback);
    
    const clusterDetails = JSON.parse(describeResult.stdout).DBClusters[0];
    
    sendStatus(statusCallback, `Aurora Serverless cluster created successfully.`);
    
    return {
      status: 'provisioned',
      projectName,
      databaseType: 'aurora-serverless',
      dbName,
      engine: engine === 'postgresql' ? 'postgresql' : 'mysql',
      endpoint: clusterDetails.Endpoint,
      port: clusterDetails.Port,
      capacity
    };
  } catch (error) {
    throw new Error(`Failed to provision Aurora Serverless cluster: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Execute AWS CLI command
 */
async function executeAwsCommand(command: string[], statusCallback?: StatusCallback): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    sendStatus(statusCallback, `Executing: aws ${command.join(' ')}`);
    
    const process = spawn('aws', command);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
    });
    
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      sendStatus(statusCallback, `[ERROR] ${chunk.trim()}`);
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`AWS CLI command failed with exit code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}
