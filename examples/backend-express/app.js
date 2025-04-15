const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(cors());

// Sample in-memory database
const items = [
  { id: 1, name: 'Item 1', description: 'Description for item 1' },
  { id: 2, name: 'Item 2', description: 'Description for item 2' },
];

// Request context middleware
app.use((req, res, next) => {
  // Extract Lambda and API Gateway context from headers
  const requestContext = req.headers['x-amzn-request-context'];
  const lambdaContext = req.headers['x-amzn-lambda-context'];
  
  if (requestContext) {
    try {
      req.apiGatewayContext = JSON.parse(requestContext);
    } catch (e) {
      console.error('Failed to parse request context', e);
    }
  }
  
  if (lambdaContext) {
    try {
      req.lambdaContext = JSON.parse(lambdaContext);
    } catch (e) {
      console.error('Failed to parse lambda context', e);
    }
  }
  
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Express.js API running on AWS Lambda with Web Adapter',
    version: '1.0.0'
  });
});

// Get all items
app.get('/api/items', (req, res) => {
  res.json(items);
});

// Get item by ID
app.get('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = items.find(item => item.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  res.json(item);
});

// Create new item
app.post('/api/items', (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const newId = items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
  const newItem = { id: newId, name, description };
  
  items.push(newItem);
  res.status(201).json(newItem);
});

// Update item
app.put('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const itemIndex = items.findIndex(item => item.id === id);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  items[itemIndex] = { ...items[itemIndex], name, description };
  res.json(items[itemIndex]);
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const itemIndex = items.findIndex(item => item.id === id);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  const deletedItem = items[itemIndex];
  items.splice(itemIndex, 1);
  
  res.json(deletedItem);
});

// Handle non-HTTP event triggers
app.post('/events', (req, res) => {
  console.log('Received non-HTTP event:', req.body);
  
  // Process the event based on its source
  const event = req.body;
  let response = { processed: true };
  
  if (event.Records && Array.isArray(event.Records)) {
    // Handle SQS, SNS, S3, DynamoDB events
    response.recordsProcessed = event.Records.length;
  }
  
  res.json(response);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  // Close any database connections, finish processing requests, etc.
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Export app for testing
module.exports = app;
