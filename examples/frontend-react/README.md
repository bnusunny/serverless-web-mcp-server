# React Frontend Example

This is an example React frontend application that can be deployed using the Serverless Web MCP Server. It implements a simple UI for managing items, which can connect to the Express.js backend example.

## Features

- React-based single-page application
- Responsive design with CSS
- API integration with error handling
- Mock data fallback for development

## Components

- Item listing with delete functionality
- Form for adding new items
- Error handling and loading states

## Deployment

This application can be deployed using the Serverless Web MCP Server with the following configuration:

```json
{
  "deploymentType": "frontend",
  "source": {
    "path": "/path/to/this/directory"
  },
  "framework": "react",
  "configuration": {
    "projectName": "react-frontend-example",
    "region": "us-east-1",
    "frontendConfiguration": {
      "indexDocument": "index.html",
      "errorDocument": "index.html",
      "spa": true
    }
  }
}
```

## Environment Variables

To connect this frontend to a deployed backend API, set the following environment variable:

```
REACT_APP_API_URL=https://your-api-endpoint.execute-api.region.amazonaws.com/prod
```

## Local Development

To run this application locally:

```bash
npm install
npm start
```

The development server will start on port 3000 by default.
