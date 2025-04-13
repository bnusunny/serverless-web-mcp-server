import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', description: '' });

  // API URL - would be replaced with actual API endpoint after deployment
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  // Fetch items from API
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/items`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        setItems(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch items. Using mock data instead.');
        // Mock data for development
        setItems([
          { id: '1', name: 'Mock Item 1', description: 'This is a mock item' },
          { id: '2', name: 'Mock Item 2', description: 'This is another mock item' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [API_URL]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewItem({ ...newItem, [name]: value });
  };

  // Handle form submission to create new item
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newItem.name) {
      alert('Name is required!');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newItem),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const createdItem = await response.json();
      setItems([...items, createdItem]);
      setNewItem({ name: '', description: '' });
    } catch (err) {
      setError('Failed to create item. Using mock data instead.');
      // Mock creation for development
      const mockItem = {
        id: String(items.length + 1),
        name: newItem.name,
        description: newItem.description
      };
      setItems([...items, mockItem]);
      setNewItem({ name: '', description: '' });
    }
  };

  // Handle item deletion
  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/items/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      setError('Failed to delete item. Using mock deletion instead.');
      // Mock deletion for development
      setItems(items.filter(item => item.id !== id));
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Serverless React App</h1>
        <p>Example frontend for serverless deployment</p>
      </header>
      
      <main className="App-main">
        {error && <div className="error-message">{error}</div>}
        
        <section className="item-form">
          <h2>Add New Item</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Name:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={newItem.name}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description:</label>
              <textarea
                id="description"
                name="description"
                value={newItem.description}
                onChange={handleInputChange}
              />
            </div>
            
            <button type="submit" className="btn-submit">Add Item</button>
          </form>
        </section>
        
        <section className="items-list">
          <h2>Items</h2>
          {loading ? (
            <p>Loading items...</p>
          ) : items.length > 0 ? (
            <ul>
              {items.map(item => (
                <li key={item.id} className="item-card">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="btn-delete"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No items found.</p>
          )}
        </section>
      </main>
      
      <footer className="App-footer">
        <p>Serverless Web MCP Server Example &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
