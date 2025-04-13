import React from 'react';

function TodoItem({ todo, onToggle, onDelete }) {
  const { title, description, completed, createdAt } = todo;
  
  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <li className={`todo-item ${completed ? 'completed' : ''}`}>
      <div className="todo-header">
        <label className="todo-checkbox">
          <input
            type="checkbox"
            checked={completed}
            onChange={onToggle}
          />
          <span className="checkmark"></span>
        </label>
        <h3 className="todo-title">{title}</h3>
        <button 
          onClick={onDelete}
          className="btn-delete"
          aria-label="Delete todo"
        >
          ×
        </button>
      </div>
      
      {description && (
        <p className="todo-description">{description}</p>
      )}
      
      <div className="todo-meta">
        <span className="todo-date">Created: {formatDate(createdAt)}</span>
        {todo.updatedAt && (
          <span className="todo-date">Updated: {formatDate(todo.updatedAt)}</span>
        )}
      </div>
    </li>
  );
}

export default TodoItem;
