import React, { useState } from 'react';

function TodoForm({ onAddTodo }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('Title is required!');
      return;
    }
    
    onAddTodo({
      title: title.trim(),
      description: description.trim(),
      completed: false
    });
    
    // Reset form
    setTitle('');
    setDescription('');
  };

  return (
    <div className="todo-form">
      <h2>Add New Todo</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title:</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details (optional)"
            rows="3"
          />
        </div>
        
        <button type="submit" className="btn-submit">Add Todo</button>
      </form>
    </div>
  );
}

export default TodoForm;
