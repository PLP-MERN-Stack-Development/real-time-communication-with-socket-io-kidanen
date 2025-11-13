const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json({limit: '10mb'})); // allow base64 file payloads

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// In-memory stores (swap to DB for production)
const users = new Map(); // socketId -> { username, userId }
const onlineUsers = new Map(); // userId -> socketId
const messages = []; // { id, room, from, to, text, ts, type:'text'|'file', fileMeta, readBy: [] }

// Utility
const makeId = () => Math.random().toString(36).slice(2, 9);
const globalRoom = 'global';

app.get('/health', (req, res) => res.json({ ok: true }));

// Simple REST endpoint to get paginated messages for a room/pm
app.get('/messages', (req, res) => {
  // query: room, page (1-based), limit
  const { room = globalRoom, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const lim = Math.max(1, parseInt(limit));
  const roomMessages = messages.filter(m => m.room === room);
  // newest last: provide pages of older messages
  const start = Math.max(0, roomMessages.length - pageNum * lim);
  const end = roomMessages.length - (pageNum - 1) * lim;
  const pageItems = roomMessages.slice(start, end);
  res.json({ messages: pageItems, total: roomMessages.length });
});

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  // client sends 'login' with { userId, username }
  socket.on('login', ({ userId, username }) => {
    if (!userId) userId = makeId(); // assign if not provided
    users.set(socket.id, { userId, username });
    onlineUsers.set(userId, socket.id);

    // join global room
    socket.join(globalRoom);

    // broadcast updated online list
    const onlineList = Array.from(onlineUsers.keys()).map(id => {
      return { userId: id, username: (Array.from(users.values()).find(u => u.userId === id) || {}).username || id };
    });
    io.emit('online:updated', onlineList);

    // notify join
    io.to(globalRoom).emit('notification', { msg: `${username} joined the chat`, ts: Date.now() });

    // ack login
    socket.emit('login:success', { userId, username });
  });

  socket.on('send:message', (payload, ack) => {
    // payload: { room, fromId, toId, text, type, fileMeta }
    const id = makeId();
    const ts = Date.now();
    const room = payload.room || (payload.toId ? `pm:${[payload.fromId, payload.toId].sort().join(':')}` : globalRoom);
    const msg = {
      id, room,
      from: payload.fromId,
      to: payload.toId || null,
      text: payload.text || null,
      ts,
      type: payload.type || 'text',
      fileMeta: payload.fileMeta || null,
      readBy: payload.readBy || []
    };
    messages.push(msg);

    // emit to room
    io.to(room).emit('message:new', msg);

    // send ack to sender (delivered to server)
    if (ack) ack({ ok: true, id });

    // if private, ensure recipient socket joined the pm room
    if (payload.toId) {
      const pmRoom = room;
      // make both users join the private room
      const recipientSocket = onlineUsers.get(payload.toId);
      if (recipientSocket) io.sockets.sockets.get(recipientSocket)?.join(pmRoom);
      const senderSocket = onlineUsers.get(payload.fromId);
      if (senderSocket) io.sockets.sockets.get(senderSocket)?.join(pmRoom);
    }
  });

  socket.on('typing', ({ room, userId, typing }) => {
    socket.to(room || globalRoom).emit('user:typing', { userId, typing });
  });

  socket.on('message:read', ({ messageId, userId }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && !msg.readBy.includes(userId)) {
      msg.readBy.push(userId);
      // notify others about read status
      io.to(msg.room).emit('message:read:update', { messageId, userId });
    }
  });

  socket.on('disconnect', () => {
    const u = users.get(socket.id);
    if (u) {
      onlineUsers.delete(u.userId);
      users.delete(socket.id);
      io.emit('online:updated', Array.from(onlineUsers.keys()).map(id => ({ userId: id })));
      io.to(globalRoom).emit('notification', { msg: `${u.username} left`, ts: Date.now() });
    }
    console.log('disconnected', socket.id);
  });

  // allow joining arbitrary rooms (channels)
  socket.on('join:room', (roomName, cb) => {
    socket.join(roomName);
    if (cb) cb({ ok: true });
  });

  socket.on('leave:room', (roomName, cb) => {
    socket.leave(roomName);
    if (cb) cb({ ok: true });
  });

});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
