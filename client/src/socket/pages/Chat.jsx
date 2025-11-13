import React, { useEffect, useState, useRef } from 'react';
import socket from '../socket';
import dayjs from 'dayjs';
import MessageList from '../components/MessageList';
import OnlineList from '../components/OnlineList';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export default function Chat({ user, onLogout }) {
  const [online, setOnline] = useState([]);
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState('global');
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const messageListRef = useRef();

  useEffect(() => {
    // connect and login
    socket.auth = { token: null };
    socket.connect();

    socket.on('connect', () => {
      socket.emit('login', { userId: user.userId, username: user.username });
      // join global room
      socket.emit('join:room', 'global');
      // request permission for notifications
      if (Notification.permission === 'default') Notification.requestPermission();
    });

    socket.on('login:success', (data) => {
      console.log('login success', data);
      // load initial messages for room
      fetchMessages(1, room);
    });

    socket.on('online:updated', (list) => {
      setOnline(list);
    });

    socket.on('message:new', (msg) => {
      // if message not for current room, you can update unread counts (not implemented fully)
      setMessages(prev => [...prev, msg]);
      // browser notif + sound if not focused
      if (document.hidden) {
        if (Notification.permission === 'granted') {
          new Notification(`New message from ${msg.from}`, { body: msg.text || 'file', tag: msg.id });
        }
        const a = new Audio('/notification.mp3'); // include file or omit
        a.play().catch(()=>{});
      }
    });

    socket.on('user:typing', ({ userId, typing }) => {
      setTypingUsers(prev => ({ ...prev, [userId]: typing }));
    });

    socket.on('message:read:update', ({ messageId, userId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, readBy: [...(m.readBy||[]), userId] } : m));
    });

    socket.on('disconnect', (reason) => {
      console.log('socket disconnected', reason);
    });

    return () => {
      socket.offAny();
      socket.disconnect();
    };
  }, [user.userId]);

  async function fetchMessages(pageToLoad = 1, forRoom = room) {
    const res = await fetch(`${SERVER}/messages?room=${encodeURIComponent(forRoom)}&page=${pageToLoad}&limit=20`);
    const data = await res.json();
    if (pageToLoad === 1) setMessages(data.messages || []);
    else setMessages(prev => [...data.messages, ...prev]);
    setHasMore((pageToLoad * 20) < (data.total || 0));
    setPage(pageToLoad);
  }

  function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const payload = {
      fromId: user.userId,
      toId: null,
      room,
      text: text.trim(),
      type: 'text'
    };
    socket.emit('send:message', payload, (ack) => {
      // ack contains id
      // optimistic: message will arrive from server also
    });
    setText('');
    socket.emit('typing', { room, userId: user.userId, typing: false });
  }

  function startTyping(val) {
    setText(val);
    socket.emit('typing', { room, userId: user.userId, typing: !!val });
  }

  function markRead(messageId) {
    socket.emit('message:read', { messageId, userId: user.userId });
  }

  function sendFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      const fileMeta = { name: file.name, size: file.size, mime: file.type, base64 };
      const payload = { fromId: user.userId, room, type: 'file', fileMeta };
      socket.emit('send:message', payload);
    };
    reader.readAsDataURL(file);
  }

  function openPrivateChat(targetUserId) {
    const pmRoom = `pm:${[user.userId, targetUserId].sort().join(':')}`;
    setRoom(pmRoom);
    fetchMessages(1, pmRoom);
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: 250, borderRight: '1px solid #ddd', padding: 10 }}>
        <h3>Hi {user.username}</h3>
        <button onClick={() => { onLogout(); localStorage.removeItem('chat:uid'); localStorage.removeItem('chat:user'); }}>Logout</button>

        <h4>Online</h4>
        <OnlineList online={online} onOpenPrivate={openPrivateChat} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 10, borderBottom: '1px solid #eee' }}>
          <strong>Room:</strong> {room}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
          <button onClick={() => fetchMessages(page + 1, room)} disabled={!hasMore}>Load older</button>
          <MessageList messages={messages} currentUser={user.userId} onSeen={markRead} />
        </div>

        <div style={{ padding: 10, borderTop: '1px solid #eee' }}>
          <div>
            {Object.entries(typingUsers).filter(([id,v])=>v && id!==user.userId).map(([id]) => <span key={id}>{id} is typing…</span>)}
          </div>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
            <input value={text} onChange={e => startTyping(e.target.value)} placeholder="Type a message" style={{ flex: 1 }} />
            <input type="file" onChange={e => sendFile(e.target.files[0])} />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
