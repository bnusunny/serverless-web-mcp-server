# Fullstack Express + React + DynamoDB Example

This is an example fullstack application with persistent data storage. It combines an Express.js backend API with a React frontend and uses DynamoDB for data storage.

## Project Structure

```
/
├── backend/             # Express.js backend API with DynamoDB integration
│   ├── index.js         # Main server file
│   ├── package.json     # Backend dependencies
│   └── template.yaml    # DynamoDB table definition
├── frontend/            # React frontend application
│   ├── public/          # Static assets
│   ├── src/             # React source code
│   │   ├── components/  # React components
│   │   └── App.js       # Main application component
│   └── package.json     # Frontend dependencies
└── README.md            # This file
```

## Features

- Express.js backend with RESTful API
- DynamoDB integration for persistent data storage
- React frontend with responsive design
- Todo application with create, read, update, and delete operations
- CloudFront path-based routing

## Local Development

To run this application locally, you'll need to start both the backend and frontend servers:

### Backend

```bash
cd backend
npm install
# Set up local DynamoDB (using Docker)
docker run -p 8000:8000 amazon/dynamodb-local
# Set environment variables
export DYNAMODB_TABLE=TodoItems
export AWS_ENDPOINT=http://localhost:8000
# Start the server
npm start
```

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend development server will start on port 3000 and proxy API requests to the backend server on port 3001.
