import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Chat from './pages/Chat';

export default function App() {
  const [user, setUser] = useState(() => {
    // keep in localStorage for reconnect
    const raw = localStorage.getItem('chat:user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('chat:user', JSON.stringify(user));
    else localStorage.removeItem('chat:user');
  }, [user]);

  return user ? <Chat user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />;
}
