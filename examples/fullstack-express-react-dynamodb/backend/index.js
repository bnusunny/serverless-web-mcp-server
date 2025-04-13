const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  GetCommand, 
  PutCommand, 
  UpdateCommand,
  DeleteCommand 
} = require('@aws-sdk/lib-dynamodb');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Get table name from environment variable or use default
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'TodoItems';

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Serverless Express API with DynamoDB' });
});

// Get all items
app.get('/api/todos', async (req, res) => {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME
    });
    
    const response = await docClient.send(command);
    res.json(response.Items || []);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// Get item by ID
app.get('/api/todos/:id', async (req, res) => {
  try {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        id: req.params.id
      }
    });
    
    const response = await docClient.send(command);
    
    if (!response.Item) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    res.json(response.Item);
  } catch (error) {
    console.error('Error fetching todo:', error);
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

// Create new item
app.post('/api/todos', async (req, res) => {
  try {
    const { title, description, completed } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const newTodo = {
      id: uuidv4(),
      title,
      description: description || '',
      completed: completed || false,
      createdAt: new Date().toISOString()
    };
    
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: newTodo
    });
    
    await docClient.send(command);
    res.status(201).json(newTodo);
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// Update item
app.put('/api/todos/:id', async (req, res) => {
  try {
    const { title, description, completed } = req.body;
    const id = req.params.id;
    
    // First check if the item exists
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id }
    });
    
    const existingItem = await docClient.send(getCommand);
    
    if (!existingItem.Item) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    // Build update expression
    let updateExpression = 'SET ';
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    if (title !== undefined) {
      updateExpression += '#title = :title, ';
      expressionAttributeNames['#title'] = 'title';
      expressionAttributeValues[':title'] = title;
    }
    
    if (description !== undefined) {
      updateExpression += '#desc = :desc, ';
      expressionAttributeNames['#desc'] = 'description';
      expressionAttributeValues[':desc'] = description;
    }
    
    if (completed !== undefined) {
      updateExpression += '#comp = :comp, ';
      expressionAttributeNames['#comp'] = 'completed';
      expressionAttributeValues[':comp'] = completed;
    }
    
    // Add updatedAt timestamp
    updateExpression += '#updatedAt = :updatedAt';
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });
    
    const response = await docClient.send(command);
    res.json(response.Attributes);
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// Delete item
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // First check if the item exists
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id }
    });
    
    const existingItem = await docClient.send(getCommand);
    
    if (!existingItem.Item) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id },
      ReturnValues: 'ALL_OLD'
    });
    
    const response = await docClient.send(command);
    res.json(response.Attributes);
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export the Express app
module.exports = app;
