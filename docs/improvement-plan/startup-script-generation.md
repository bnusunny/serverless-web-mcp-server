# Startup Script Generation

## Problem Statement

AI coding agents struggle with the Lambda Web Adapter's startup script requirements. While they can create application entry points correctly, they often don't understand:

1. The need for an executable startup script
2. The specific format requirements for different runtimes
3. How to make scripts executable in Linux environments

This creates a significant barrier to successful deployments, as the startup script is a critical component for the Lambda Web Adapter.

## Proposed Solution

Implement automatic startup script generation based on the runtime and entry point. This will:

1. Remove the burden from AI agents to create startup scripts manually
2. Ensure scripts are properly formatted for each runtime
3. Guarantee scripts are executable in the Lambda environment
4. Reduce deployment failures due to startup script issues

## Implementation Plan

### 1. Create Startup Script Generator Module

Create a new module that generates appropriate startup scripts for different runtimes:

```typescript
// src/deployment/startup-script-generator.ts

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const writeFileAsync = promisify(fs.writeFile);
const chmodAsync = promisify(fs.chmod);

export interface StartupScriptOptions {
  runtime: string;
  entryPoint: string;
  builtArtifactsPath: string;
  startupScriptName?: string;
  additionalEnv?: Record<string, string>;
}

/**
 * Generate a startup script based on runtime and entry point
 * @param options - Options for generating the startup script
 * @returns Path to the generated startup script
 */
export async function generateStartupScript(options: StartupScriptOptions): Promise<string> {
  const { runtime, entryPoint, builtArtifactsPath } = options;
  const startupScriptName = options.startupScriptName || getDefaultStartupScriptName(runtime);
  const scriptPath = path.join(builtArtifactsPath, startupScriptName);
  
  logger.info(`Generating startup script for runtime: ${runtime}, entry point: ${entryPoint}`);
  
  // Generate script content based on runtime
  const scriptContent = generateScriptContent(runtime, entryPoint, options.additionalEnv);
  
  // Write script to file
  await writeFileAsync(scriptPath, scriptContent, 'utf8');
  
  // Make script executable
  await chmodAsync(scriptPath, 0o755);
  
  logger.info(`Startup script generated at: ${scriptPath}`);
  
  return startupScriptName;
}

/**
 * Get default startup script name for a runtime
 * @param runtime - Lambda runtime
 * @returns Default startup script name
 */
function getDefaultStartupScriptName(runtime: string): string {
  if (runtime.startsWith('nodejs')) {
    return 'bootstrap';
  } else if (runtime.startsWith('python')) {
    return 'bootstrap';
  } else if (runtime.startsWith('java')) {
    return 'bootstrap';
  } else if (runtime.startsWith('dotnet')) {
    return 'bootstrap';
  } else if (runtime.startsWith('go')) {
    return 'bootstrap';
  } else if (runtime.startsWith('ruby')) {
    return 'bootstrap';
  } else {
    return 'bootstrap';
  }
}

/**
 * Generate script content based on runtime and entry point
 * @param runtime - Lambda runtime
 * @param entryPoint - Application entry point
 * @param additionalEnv - Additional environment variables
 * @returns Script content
 */
function generateScriptContent(runtime: string, entryPoint: string, additionalEnv?: Record<string, string>): string {
  // Generate environment variables setup
  const envSetup = additionalEnv ? 
    Object.entries(additionalEnv)
      .map(([key, value]) => `export ${key}="${value}"`)
      .join('\n') + '\n\n' 
    : '';
  
  if (runtime.startsWith('nodejs')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec node ${entryPoint}
`;
  } else if (runtime.startsWith('python')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec python ${entryPoint}
`;
  } else if (runtime.startsWith('java')) {
    // Determine if it's a JAR file or a class
    const isJar = entryPoint.toLowerCase().endsWith('.jar');
    
    if (isJar) {
      return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec java -jar ${entryPoint}
`;
    } else {
      return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec java ${entryPoint}
`;
    }
  } else if (runtime.startsWith('dotnet')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec dotnet ${entryPoint}
`;
  } else if (runtime.startsWith('go')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec ./${entryPoint}
`;
  } else if (runtime.startsWith('ruby')) {
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec ruby ${entryPoint}
`;
  } else {
    // Generic script for unknown runtimes
    return `#!/bin/bash
${envSetup}# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec ${entryPoint}
`;
  }
}
```

### 2. Integrate with Deployment Process

Modify the deployment process to use the startup script generator:

```typescript
// src/deployment/deploy-service.ts

import { generateStartupScript } from './startup-script-generator.js';

async function deployBackend(options: DeployOptions): Promise<DeploymentResult> {
  try {
    logger.info("Preparing backend deployment...");
    
    // Check if we need to generate a startup script
    if (options.backendConfiguration?.generateStartupScript && options.backendConfiguration?.entryPoint) {
      logger.info("Generating startup script...");
      
      const startupScriptName = await generateStartupScript({
        runtime: options.backendConfiguration.runtime,
        entryPoint: options.backendConfiguration.entryPoint,
        builtArtifactsPath: options.backendConfiguration.builtArtifactsPath,
        startupScriptName: options.backendConfiguration.startupScript,
        additionalEnv: options.backendConfiguration.environment
      });
      
      // Update the configuration with the generated script name
      options.backendConfiguration.startupScript = startupScriptName;
      
      logger.info(`Startup script generated: ${startupScriptName}`);
    }
    
    // Continue with existing deployment process
    // ...
  } catch (error) {
    // Error handling
  }
}
```

### 3. Update Type Definitions

Add new fields to the backend configuration type:

```typescript
// src/deployment/types.ts

export interface BackendDeployOptions {
  builtArtifactsPath: string;
  framework?: string;
  runtime: string;
  startupScript?: string;  // Now optional if entryPoint is provided
  entryPoint?: string;     // New field for application entry point
  generateStartupScript?: boolean; // Flag to enable startup script generation
  // ... existing fields
}
```

### 4. Update Tool Definition

Update the deploy tool definition to include the new parameters:

```typescript
// src/mcp/tools/index.ts

export const toolDefinitions = [
  {
    name: 'deploy',
    // ...
    parameters: z.object({
      // ...
      backendConfiguration: z.object({
        // ...
        startupScript: z.string().optional().describe('Name of the startup script file within the artifacts directory. If not provided with entryPoint, this must be created manually and be executable.'),
        entryPoint: z.string().optional().describe('Application entry point file (e.g., app.js, app.py). If provided with generateStartupScript=true, a startup script will be automatically generated.'),
        generateStartupScript: z.boolean().optional().default(false).describe('Whether to automatically generate a startup script based on the runtime and entry point'),
        // ...
      }).optional(),
      // ...
    })
  },
  // ...
]
```

### 5. Update Validation Logic

Update the validation logic to handle the new parameters:

```typescript
// src/deployment/validation.ts

function validateStartupScript(config: BackendDeployOptions, result: ValidationResult): void {
  // If generateStartupScript is true and entryPoint is provided, we don't need to validate startupScript
  if (config.generateStartupScript && config.entryPoint) {
    // Validate entryPoint instead
    const entryPointPath = path.join(config.builtArtifactsPath, config.entryPoint);
    
    if (!fs.existsSync(entryPointPath)) {
      result.errors.push({
        code: 'ENTRY_POINT_NOT_FOUND',
        message: `Entry point file not found: ${entryPointPath}`,
        path: 'backendConfiguration.entryPoint',
        suggestion: 'Check that your entry point file is included in your built artifacts'
      });
    }
    
    return;
  }
  
  // Otherwise, validate startupScript as before
  if (!config.startupScript) {
    result.errors.push({
      code: 'MISSING_STARTUP_SCRIPT',
      message: 'Either startupScript or entryPoint with generateStartupScript=true is required',
      path: 'backendConfiguration.startupScript',
      suggestion: 'Provide a startup script name or set entryPoint and generateStartupScript=true'
    });
    return;
  }
  
  // Existing validation logic for startupScript
  // ...
}
```

### 6. Add Documentation

Add documentation about the new feature:

```markdown
# Automatic Startup Script Generation

The serverless-web-mcp tool now supports automatic generation of startup scripts for Lambda Web Adapter. This feature simplifies the deployment process by eliminating the need to manually create and configure startup scripts.

## How It Works

Instead of providing a pre-created startup script, you can now provide:

1. The application entry point file (e.g., `app.js`, `app.py`)
2. Set `generateStartupScript` to `true`

The tool will automatically:
- Generate an appropriate startup script for your runtime
- Make it executable
- Configure it to work with Lambda Web Adapter

## Example

```json
{
  "deploymentType": "backend",
  "projectName": "my-api",
  "projectRoot": "/path/to/project",
  "backendConfiguration": {
    "builtArtifactsPath": "/path/to/built/artifacts",
    "runtime": "nodejs18.x",
    "entryPoint": "app.js",
    "generateStartupScript": true
  }
}
```

## Supported Runtimes

- Node.js (nodejs14.x, nodejs16.x, nodejs18.x)
- Python (python3.7, python3.8, python3.9)
- Java (java8, java8.al2, java11)
- .NET (dotnet3.1, dotnet5.0, dotnet6)
- Go (go1.x)
- Ruby (ruby2.7)

## Generated Script Format

The generated startup script sets up the necessary environment for Lambda Web Adapter and executes your application. For example, for Node.js:

```bash
#!/bin/bash
# Set up Lambda Web Adapter
export PORT=8080

# Start the application
exec node app.js
```
```

## Benefits

This improvement offers several key benefits:

1. **Simplifies Deployment for AI Agents**: AI coding agents can focus on creating the application code without worrying about Lambda Web Adapter specifics

2. **Reduces Deployment Failures**: Eliminates a common source of deployment failures (missing or non-executable startup scripts)

3. **Improves User Experience**: Makes the tool more accessible to users unfamiliar with Lambda Web Adapter

4. **Maintains Flexibility**: Advanced users can still provide custom startup scripts if needed

5. **Consistent Configuration**: Ensures startup scripts follow best practices for each runtime

## Implementation Considerations

1. **Backward Compatibility**: The existing approach (manually providing a startup script) will continue to work

2. **Default Behavior**: By default, `generateStartupScript` is false to maintain backward compatibility

3. **Validation**: The validation system will check either the startup script or the entry point, depending on which approach is used

4. **Error Handling**: Clear error messages will be provided if the entry point file doesn't exist

## Testing Plan

1. Test automatic script generation for each supported runtime
2. Verify scripts are executable and work correctly with Lambda Web Adapter
3. Test with various entry point configurations
4. Verify backward compatibility with existing deployments
