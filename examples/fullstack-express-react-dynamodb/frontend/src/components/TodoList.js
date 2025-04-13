import React from 'react';
import TodoItem from './TodoItem';

function TodoList({ todos, loading, onToggleTodo, onDeleteTodo }) {
  if (loading) {
    return <div className="loading">Loading todos...</div>;
  }

  if (todos.length === 0) {
    return <div className="empty-list">No todos yet. Add one above!</div>;
  }

  // Sort todos by creation date (newest first)
  const sortedTodos = [...todos].sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="todo-list">
      <h2>Your Todos</h2>
      <ul>
        {sortedTodos.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={() => onToggleTodo(todo.id)}
            onDelete={() => onDeleteTodo(todo.id)}
          />
        ))}
      </ul>
    </div>
  );
}

export default TodoList;
