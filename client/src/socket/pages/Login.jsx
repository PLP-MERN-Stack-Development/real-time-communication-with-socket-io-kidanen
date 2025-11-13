import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const userId = localStorage.getItem('chat:uid') || Math.random().toString(36).slice(2,9);
    localStorage.setItem('chat:uid', userId);
    onLogin({ userId, username: name.trim() });
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Login</h2>
      <form onSubmit={submit}>
        <input placeholder="Enter a display name" value={name} onChange={e => setName(e.target.value)} />
        <button type="submit">Enter Chat</button>
      </form>
    </div>
  );
}
