import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config.js';

// Define database provisioning parameters interface
export interface DatabaseParams {
  projectName: string;
  databaseType: 'dynamodb' | 'aurora-serverless';
  configuration: {
    tableName?: string;
    primaryKey?: string;
    sortKey?: string;
    dbName?: string;
    engine?: 'mysql' | 'postgresql';
    capacity?: number;
  };
}

// Define database result interface
export interface DatabaseResult {
  projectName: string;
  databaseType: string;
  resourceId: string;
  connectionInfo: {
    endpoint?: string;
    port?: number;
    databaseName?: string;
    tableName?: string;
  };
  status: string;
}

/**
 * Provision a database for an application
 */
export async function provisionDatabase(params: DatabaseParams): Promise<DatabaseResult> {
  const config = loadConfig();
  const { projectName, databaseType, configuration } = params;
  
  console.log(`Provisioning ${databaseType} for project ${projectName}`);
  
  try {
    let resourceId = '';
    let connectionInfo: any = {};
    
    if (databaseType === 'dynamodb') {
      // Provision DynamoDB table
      const result = await provisionDynamoDbTable(
        projectName,
        configuration.tableName || `${projectName}-table`,
        configuration.primaryKey || 'id',
        configuration.sortKey,
        config.aws.region
      );
      
      resourceId = result.tableArn;
      connectionInfo = {
        tableName: result.tableName
      };
    } else if (databaseType === 'aurora-serverless') {
      // Provision Aurora Serverless cluster
      const result = await provisionAuroraServerless(
        projectName,
        configuration.dbName || `${projectName.replace(/-/g, '_')}_db`,
        configuration.engine || 'postgresql',
        configuration.capacity || 2,
        config.aws.region
      );
      
      resourceId = result.clusterArn;
      connectionInfo = {
        endpoint: result.endpoint,
        port: result.port,
        databaseName: result.databaseName
      };
    } else {
      throw new Error(`Unsupported database type: ${databaseType}`);
    }
    
    // Create database result
    const result: DatabaseResult = {
      projectName,
      databaseType,
      resourceId,
      connectionInfo,
      status: 'provisioned'
    };
    
    // Save database information
    saveDatabaseInfo(projectName, result);
    
    return result;
  } catch (error) {
    console.error('Database provisioning failed:', error);
    throw error;
  }
}

/**
 * Provision a DynamoDB table
 */
async function provisionDynamoDbTable(
  projectName: string,
  tableName: string,
  primaryKey: string,
  sortKey: string | undefined,
  region: string
): Promise<{ tableArn: string; tableName: string }> {
  try {
    // Prepare key schema and attribute definitions
    let keySchema = `AttributeName=${primaryKey},KeyType=HASH`;
    let attributeDefinitions = `AttributeName=${primaryKey},AttributeType=S`;
    
    if (sortKey) {
      keySchema += ` AttributeName=${sortKey},KeyType=RANGE`;
      attributeDefinitions += ` AttributeName=${sortKey},AttributeType=S`;
    }
    
    // Create DynamoDB table
    const tableOutput = execSync(
      `aws dynamodb create-table --table-name ${tableName} --attribute-definitions ${attributeDefinitions} --key-schema ${keySchema} --billing-mode PAY_PER_REQUEST --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const tableData = JSON.parse(tableOutput);
    
    // Wait for table to be active
    console.log('Waiting for DynamoDB table to be active...');
    execSync(
      `aws dynamodb wait table-exists --table-name ${tableName} --region ${region}`,
      { stdio: 'inherit' }
    );
    
    return {
      tableArn: tableData.TableDescription.TableArn,
      tableName: tableName
    };
  } catch (error) {
    console.error('Failed to provision DynamoDB table:', error);
    throw new Error('Failed to provision DynamoDB table');
  }
}

/**
 * Provision an Aurora Serverless cluster
 */
async function provisionAuroraServerless(
  projectName: string,
  dbName: string,
  engine: string,
  capacity: number,
  region: string
): Promise<{ clusterArn: string; endpoint: string; port: number; databaseName: string }> {
  try {
    // Create a security group for the database
    const sgOutput = execSync(
      `aws ec2 create-security-group --group-name ${projectName}-db-sg --description "Security group for ${projectName} database" --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const sgData = JSON.parse(sgOutput);
    const securityGroupId = sgData.GroupId;
    
    // Allow inbound access on the database port
    const dbPort = engine === 'postgresql' ? 5432 : 3306;
    execSync(
      `aws ec2 authorize-security-group-ingress --group-id ${securityGroupId} --protocol tcp --port ${dbPort} --cidr 0.0.0.0/0 --region ${region}`,
      { stdio: 'inherit' }
    );
    
    // Create DB subnet group
    const subnetOutput = execSync(
      `aws ec2 describe-subnets --query "Subnets[0:2].SubnetId" --output json --region ${region}`,
      { encoding: 'utf8' }
    );
    
    const subnetIds = JSON.parse(subnetOutput);
    
    execSync(
      `aws rds create-db-subnet-group --db-subnet-group-name ${projectName}-subnet-group --db-subnet-group-description "Subnet group for ${projectName}" --subnet-ids ${subnetIds.join(' ')} --region ${region}`,
      { stdio: 'inherit' }
    );
    
    // Create Aurora Serverless cluster
    const engineMode = engine === 'postgresql' ? 'aurora-postgresql' : 'aurora-mysql';
    const engineVersion = engine === 'postgresql' ? '13.6' : '8.0.mysql_aurora.3.02.0';
    
    const clusterOutput = execSync(
      `aws rds create-db-cluster --db-cluster-identifier ${projectName}-cluster --engine ${engineMode} --engine-mode serverless --engine-version ${engineVersion} --database-name ${dbName} --master-username admin --master-user-password ${generatePassword()} --vpc-security-group-ids ${securityGroupId} --db-subnet-group-name ${projectName}-subnet-group --scaling-configuration MinCapacity=1,MaxCapacity=${capacity},AutoPause=true,SecondsUntilAutoPause=300 --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    
    const clusterData = JSON.parse(clusterOutput);
    
    // Wait for cluster to be available
    console.log('Waiting for Aurora Serverless cluster to be available...');
    execSync(
      `aws rds wait db-cluster-available --db-cluster-identifier ${projectName}-cluster --region ${region}`,
      { stdio: 'inherit' }
    );
    
    return {
      clusterArn: clusterData.DBCluster.DBClusterArn,
      endpoint: clusterData.DBCluster.Endpoint,
      port: clusterData.DBCluster.Port,
      databaseName: dbName
    };
  } catch (error) {
    console.error('Failed to provision Aurora Serverless cluster:', error);
    throw new Error('Failed to provision Aurora Serverless cluster');
  }
}

/**
 * Generate a random password for database
 */
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let password = '';
  
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password;
}

/**
 * Save database information to local storage
 */
function saveDatabaseInfo(projectName: string, databaseInfo: DatabaseResult): void {
  const databasesDir = path.join(process.cwd(), 'databases');
  fs.mkdirSync(databasesDir, { recursive: true });
  
  const databaseFile = path.join(databasesDir, `${projectName}.json`);
  fs.writeFileSync(databaseFile, JSON.stringify(databaseInfo, null, 2));
}
