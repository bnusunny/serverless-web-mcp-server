const express = require('express');
const cors = require('cors');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Sample in-memory database
const items = [
  { id: '1', name: 'Item 1', description: 'This is item 1' },
  { id: '2', name: 'Item 2', description: 'This is item 2' },
  { id: '3', name: 'Item 3', description: 'This is item 3' }
];

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Serverless Express API' });
});

// Get all items
app.get('/api/items', (req, res) => {
  res.json(items);
});

// Get item by ID
app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === req.params.id);
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
  
  const newItem = {
    id: String(items.length + 1),
    name,
    description: description || ''
  };
  
  items.push(newItem);
  res.status(201).json(newItem);
});

// Update item
app.put('/api/items/:id', (req, res) => {
  const { name, description } = req.body;
  const itemIndex = items.findIndex(i => i.id === req.params.id);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  items[itemIndex] = {
    ...items[itemIndex],
    name: name || items[itemIndex].name,
    description: description !== undefined ? description : items[itemIndex].description
  };
  
  res.json(items[itemIndex]);
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
  const itemIndex = items.findIndex(i => i.id === req.params.id);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  const deletedItem = items[itemIndex];
  items.splice(itemIndex, 1);
  
  res.json(deletedItem);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export the Express app
module.exports = app;
