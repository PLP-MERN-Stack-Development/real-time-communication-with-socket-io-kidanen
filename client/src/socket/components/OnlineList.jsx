import React from 'react';

export default function OnlineList({ online = [], onOpenPrivate }) {
  return (
    <div>
      {online.map(u => (
        <div key={u.userId} style={{ padding: 6, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
          <div>{u.username || u.userId}</div>
          <div>
            <button onClick={() => onOpenPrivate(u.userId)}>PM</button>
          </div>
        </div>
      ))}
    </div>
  );
}
