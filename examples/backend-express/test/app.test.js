const request = require('supertest');
const app = require('../app');

describe('Express API', () => {
  // Test root endpoint
  describe('GET /', () => {
    it('should return welcome message', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  // Test GET all items
  describe('GET /api/items', () => {
    it('should return all items', async () => {
      const res = await request(app).get('/api/items');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // Test GET item by ID
  describe('GET /api/items/:id', () => {
    it('should return a single item', async () => {
      const res = await request(app).get('/api/items/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', 1);
      expect(res.body).toHaveProperty('name');
    });

    it('should return 404 for non-existent item', async () => {
      const res = await request(app).get('/api/items/999');
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  // Test POST new item
  describe('POST /api/items', () => {
    it('should create a new item', async () => {
      const newItem = {
        name: 'New Test Item',
        description: 'Created during test'
      };
      
      const res = await request(app)
        .post('/api/items')
        .send(newItem);
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', newItem.name);
      expect(res.body).toHaveProperty('description', newItem.description);
    });

    it('should return 400 when name is missing', async () => {
      const invalidItem = {
        description: 'Missing name field'
      };
      
      const res = await request(app)
        .post('/api/items')
        .send(invalidItem);
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // Test PUT update item
  describe('PUT /api/items/:id', () => {
    it('should update an existing item', async () => {
      const updatedItem = {
        name: 'Updated Item',
        description: 'Updated description'
      };
      
      const res = await request(app)
        .put('/api/items/2')
        .send(updatedItem);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', 2);
      expect(res.body).toHaveProperty('name', updatedItem.name);
      expect(res.body).toHaveProperty('description', updatedItem.description);
    });

    it('should return 404 for non-existent item', async () => {
      const res = await request(app)
        .put('/api/items/999')
        .send({ name: 'Test', description: 'Test' });
      
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  // Test DELETE item
  describe('DELETE /api/items/:id', () => {
    it('should delete an existing item', async () => {
      // First create an item to delete
      const newItem = {
        name: 'Item to delete',
        description: 'This will be deleted'
      };
      
      const createRes = await request(app)
        .post('/api/items')
        .send(newItem);
      
      const idToDelete = createRes.body.id;
      
      // Now delete it
      const deleteRes = await request(app)
        .delete(`/api/items/${idToDelete}`);
      
      expect(deleteRes.statusCode).toEqual(200);
      expect(deleteRes.body).toHaveProperty('id', idToDelete);
      
      // Verify it's gone
      const checkRes = await request(app).get(`/api/items/${idToDelete}`);
      expect(checkRes.statusCode).toEqual(404);
    });

    it('should return 404 for non-existent item', async () => {
      const res = await request(app).delete('/api/items/999');
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error');
    });
  });
});
