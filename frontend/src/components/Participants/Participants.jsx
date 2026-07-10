import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import api from '../../api';

export default function Participants() {
  const { roomId } = useParams();
  const { socket } = useSocket();
  const [users, setUsers] = useState([]);
  const [isOpen, setIsOpen] = useState(true);

  // Fetch initial users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.getRoom(roomId);
        if (res.success && res.data.users) {
          setUsers(res.data.users);
        }
      } catch (err) {
        console.error('Failed to fetch initial participants', err);
      }
    };
    fetchUsers();
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;

    socket.on('room:users', (userList) => {
      setUsers(userList);
    });

    socket.on('room:user-joined', (user) => {
      setUsers((prev) => {
        if (prev.find((u) => u.id === user.id)) return prev;
        return [...prev, user];
      });
    });

    socket.on('room:user-left', (user) => {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    });

    return () => {
      socket.off('room:users');
      socket.off('room:user-joined');
      socket.off('room:user-left');
    };
  }, [socket]);

  return (
    <div className={`participants-panel ${isOpen ? 'open' : ''}`} id="participants-panel">
      <button
        className="participants-toggle"
        onClick={() => setIsOpen(!isOpen)}
        id="participants-toggle-btn"
      >
        <span className="participants-icon">👥</span>
        <span className="participants-count">{users.length}</span>
      </button>

      {isOpen && (
        <div className="participants-list">
          <h4 className="participants-title">
            Participants ({users.length})
          </h4>
          {users.map((user) => (
            <div key={user.id} className="participant-item">
              <div
                className="participant-avatar"
                style={{ backgroundColor: user.color }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="participant-name">{user.username}</span>
              <span className="participant-dot"></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
