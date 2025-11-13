import React from 'react';
import dayjs from 'dayjs';

export default function MessageList({ messages = [], currentUser, onSeen }) {
  return (
    <div>
      {messages.map(m => (
        <div key={m.id} style={{ padding: 6, marginBottom: 6, background: m.from === currentUser ? '#e6ffe6' : '#fff' }}>
          <div style={{ fontSize: 12, color: '#555' }}>
            <strong>{m.from}</strong> · {dayjs(m.ts).format('HH:mm')}
          </div>
          <div>
            {m.type === 'file' ? (
              <div>
                <div>{m.fileMeta?.name} ({Math.round((m.fileMeta?.size || 0)/1024)} KB)</div>
                <a href={`data:${m.fileMeta?.mime};base64,${m.fileMeta?.base64}`} download={m.fileMeta?.name}>Download</a>
              </div>
            ) : (
              <div>{m.text}</div>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#777' }}>
            Read by: {m.readBy?.length || 0}
            {onSeen && <button onClick={() => onSeen(m.id)}>Mark read</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
