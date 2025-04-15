# Template System

The Serverless Web MCP Server uses a flexible template system based on Handlebars to generate CloudFormation/SAM templates for different types of deployments.

## Template Naming Convention

The template system uses a predictable naming convention to find the right template for your deployment:

### Template Search Order

When deploying an application with deployment type `{deploymentType}` and framework `{framework}`, the system looks for templates in this order:

1. `{deploymentType}-{framework}.hbs` - Specific template for this deployment type and framework
2. `{deploymentType}-{framework}.yaml` - YAML version of specific template
3. `{deploymentType}-default.hbs` - Default template for this deployment type
4. `{deploymentType}-default.yaml` - YAML version of default template
5. `{deploymentType}.hbs` - Generic template for this deployment type
6. `{deploymentType}.yaml` - YAML version of generic template

### Examples

For a frontend React application (`deploymentType=FRONTEND`, `framework=react`):
1. `frontend-react.hbs`
2. `frontend-react.yaml`
3. `frontend-default.hbs`
4. `frontend-default.yaml`
5. `frontend.hbs`
6. `frontend.yaml`

For a DynamoDB database (`deploymentType=DATABASE`, `framework=dynamodb`):
1. `database-dynamodb.hbs`
2. `database-dynamodb.yaml`
3. `database-default.hbs`
4. `database-default.yaml`
5. `database.hbs`
6. `database.yaml`

## Supported Deployment Types

- `FRONTEND`: Frontend web applications (S3 + CloudFront)
- `BACKEND`: Backend API services (Lambda + API Gateway)
- `FULLSTACK`: Combined frontend and backend applications
- `DATABASE`: Database resources (DynamoDB, Aurora Serverless)

## Template Customization

You can customize the templates by:

1. Creating your own templates following the naming convention
2. Using environment variables to specify a custom template directory:
   ```
   TEMPLATES_PATH=/path/to/custom/templates serverless-web-mcp
   ```
3. Using the command line option:
   ```
   serverless-web-mcp --templates /path/to/custom/templates
   ```

## Handlebars Helpers

The template system provides several Handlebars helpers to make template creation easier:

### ifEquals

Checks if two values are equal:

```handlebars
{{#ifEquals value1 value2}}
  <!-- Content if values are equal -->
{{else}}
  <!-- Content if values are not equal -->
{{/ifEquals}}
```

### ifExists

Checks if a value exists (is not null, undefined, or empty):

```handlebars
{{#ifExists value}}
  <!-- Content if value exists -->
{{else}}
  <!-- Content if value doesn't exist -->
{{/ifExists}}
```

### eachInObject

Iterates over the properties of an object:

```handlebars
{{#eachInObject object}}
  {{key}}: {{value}}
{{/eachInObject}}
```

### cf

Helper for CloudFormation intrinsic functions:

```handlebars
{{cf "Ref" "ResourceName"}}
{{cf "GetAtt" "ResourceName" "AttributeName"}}
{{cf "Sub" "string-with-${references}"}}
```

## Database Configuration in Fullstack Applications

For fullstack applications, database configuration is optional. If you include a `databaseConfiguration` object in your deployment parameters, the system will set up the database resources as part of the fullstack deployment.

Example configuration:
```json
{
  "deploymentType": "FULLSTACK",
  "framework": "express-react",
  "configuration": {
    "projectName": "my-fullstack-app",
    "region": "us-east-1",
    "frontendConfiguration": {
      "indexDocument": "index.html",
      "errorDocument": "index.html"
    },
    "backendConfiguration": {
      "runtime": "nodejs18.x",
      "memorySize": 512,
      "timeout": 30,
      "stage": "prod",
      "environment": {
        "STAGE": "prod"
      }
    },
    "databaseConfiguration": {
      "type": "dynamodb",
      "tableName": "users",
      "billingMode": "PAY_PER_REQUEST",
      "attributeDefinitions": [
        { "name": "id", "type": "S" }
      ],
      "keySchema": [
        { "name": "id", "type": "HASH" }
      ]
    }
  },
  "source": {
    "path": "./examples/fullstack-app"
  }
}
```
