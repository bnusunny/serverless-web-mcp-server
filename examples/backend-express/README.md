# Express.js Backend Example

This is a sample Express.js backend application that can be deployed using the Serverless Web MCP Server.

## Features

- RESTful API with CRUD operations
- In-memory data store (for demonstration purposes)
- CORS support
- Ready for AWS Lambda deployment with Lambda Web Adapter

## API Endpoints

- `GET /` - Welcome message
- `GET /api/items` - Get all items
- `GET /api/items/:id` - Get item by ID
- `POST /api/items` - Create a new item
- `PUT /api/items/:id` - Update an item
- `DELETE /api/items/:id` - Delete an item

## Local Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
npm install
```

### Running Locally

```bash
npm start
```

The server will start on port 8080 (or the port specified in the `PORT` environment variable).
