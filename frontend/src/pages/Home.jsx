import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import env from '../config/env';
import {
  HiOutlinePlus,
  HiOutlineArrowRightOnRectangle,
  HiOutlineSignal,
  HiOutlineArrowRightStartOnRectangle,
  HiOutlineGlobeAlt,
  HiOutlineLockClosed,
  HiOutlineUserCircle,
} from 'react-icons/hi2';

export default function Home() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user, logout } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('create'); // 'create' or 'join'
  const [isPublic, setIsPublic] = useState(true);

  const username = user?.displayName || 'Anonymous';

  // Load active rooms
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await api.getRooms();
        if (res.success) setRooms(res.data);
      } catch (err) {
        console.error('Failed to fetch rooms', err);
      }
    };
    fetchRooms();

    if (socket) {
      socket.on('rooms:updated', (updatedRooms) => {
        setRooms(updatedRooms);
      });
      return () => socket.off('rooms:updated');
    }
  }, [socket]);

  const handleCreate = () => {
    setError('');

    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    socket.emit(
      'room:create',
      { roomName: roomName.trim(), username, isPublic },
      (response) => {
        if (response.success) {
          navigate(`/board/${response.data.room.id}`, {
            state: { username, user: response.data.user, roomName: response.data.room.name },
          });
        } else {
          setError(response.message);
        }
      }
    );
  };

  const handleJoin = () => {
    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    setError('');

    const code = joinCode.trim().toUpperCase();
    socket.emit(
      'room:join',
      { roomId: code, username },
      (response) => {
        if (response.success) {
          navigate(`/board/${code}`, {
            state: { username, user: response.data.user, roomName: response.data.room.name },
          });
        } else {
          setError(response.message || 'Room not found');
        }
      }
    );
  };

  const handleQuickJoin = (roomId) => {
    setError('');

    socket.emit(
      'room:join',
      { roomId, username },
      (response) => {
        if (response.success) {
          navigate(`/board/${roomId}`, {
            state: { username, user: response.data.user, roomName: response.data.room.name },
          });
        } else {
          setError(response.message || 'Failed to join room');
        }
      }
    );
  };

  const handleLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="home-page">
      {/* Top Nav for Profile */}
      <nav className="home-top-nav">
        <div className={`home-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <HiOutlineSignal />
          <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
        </div>

        <div className="user-badge" id="user-badge">
          <div className="user-badge-avatar">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={username} referrerPolicy="no-referrer" />
            ) : (
              <span>{username.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <span className="user-badge-name">{username}</span>
          <button
            className="logout-btn"
            onClick={handleLogout}
            title="Sign Out"
            id="logout-btn"
          >
            <HiOutlineArrowRightStartOnRectangle />
          </button>
          <button
            className="logout-btn"
            onClick={() => navigate('/profile')}
            title="Profile"
            id="profile-btn"
            style={{ marginLeft: 4 }}
          >
            <HiOutlineUserCircle />
          </button>
        </div>
      </nav>

      <div className="home-container">
        {/* Hero Section */}
        <header className="home-hero">
          <div className="logo-wrapper">
            <div className="logo-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="40" height="40" rx="12" fill="#FF2D2D" />
                <path d="M16 32L20 16L28 28L36 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 24H14M34 24H36M24 12V14M24 34V36" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
              </svg>
            </div>
            <h1 className="logo-text">{env.APP_NAME}</h1>
          </div>
          <p className="home-subtitle">
            Real-time collaborative whiteboard. Draw, sketch, and brainstorm together.
          </p>
        </header>

        {/* Main Card */}
        <main className="home-card glass" id="home-card">
          {/* Mode tabs */}
          <div className="tabs" id="mode-tabs">
            <button
              className={`tab ${mode === 'create' ? 'active' : ''}`}
              onClick={() => { setMode('create'); setError(''); }}
              id="tab-create"
            >
              <HiOutlinePlus /> Create Room
            </button>
            <button
              className={`tab ${mode === 'join' ? 'active' : ''}`}
              onClick={() => { setMode('join'); setError(''); }}
              id="tab-join"
            >
              <HiOutlineArrowRightOnRectangle /> Join Room
            </button>
          </div>

          {/* Create room form */}
          {mode === 'create' && (
            <div className="fade-in" id="create-section" style={{ marginTop: '1.2rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label" htmlFor="room-name-input">Room Name</label>
                <input
                  id="room-name-input"
                  className="input"
                  type="text"
                  placeholder="My Awesome Board"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={30}
                />
              </div>

              {/* Public/Private toggle */}
              <div className="visibility-toggle" id="visibility-toggle">
                <div className="visibility-option">
                  <div
                    className={`visibility-card ${isPublic ? 'active' : ''}`}
                    onClick={() => setIsPublic(true)}
                  >
                    <HiOutlineGlobeAlt className="visibility-icon" />
                    <div>
                      <span className="visibility-label">Public</span>
                      <span className="visibility-desc">Anyone can see & join</span>
                    </div>
                  </div>
                </div>
                <div className="visibility-option">
                  <div
                    className={`visibility-card ${!isPublic ? 'active' : ''}`}
                    onClick={() => setIsPublic(false)}
                  >
                    <HiOutlineLockClosed className="visibility-icon" />
                    <div>
                      <span className="visibility-label">Private</span>
                      <span className="visibility-desc">Invite only via code</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                id="create-room-btn"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!isConnected}
                style={{ width: '100%' }}
              >
                <HiOutlinePlus /> Create & Enter
              </button>
            </div>
          )}

          {/* Join room form */}
          {mode === 'join' && (
            <div className="fade-in" id="join-section" style={{ marginTop: '1.2rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label" htmlFor="join-code-input">Room Code</label>
                <input
                  id="join-code-input"
                  className="input"
                  type="text"
                  placeholder="e.g. A1B2C3D4"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                />
              </div>
              <button
                id="join-room-btn"
                className="btn btn-primary"
                onClick={handleJoin}
                disabled={!isConnected}
                style={{ width: '100%' }}
              >
                <HiOutlineArrowRightOnRectangle /> Join Room
              </button>
            </div>
          )}

          {error && <p className="error" id="error-message">{error}</p>}
        </main>

        {/* Active Public Rooms */}
        {rooms.length > 0 && (
          <section className="active-rooms" id="active-rooms">
            <h2>🌐 Public Rooms</h2>
            <div className="rooms-grid">
              {rooms.map((room) => (
                <div key={room.id} className="room-card" id={`room-${room.id}`}>
                  <div className="room-card-header">
                    <span className="room-name">{room.name}</span>
                    <div className="room-card-badges">
                      <span className="room-visibility-badge public">
                        <HiOutlineGlobeAlt /> Public
                      </span>
                      <span className="room-code">{room.id}</span>
                    </div>
                  </div>
                  <div className="room-card-body">
                    <span className="room-users">
                      👥 {room.userCount} participant{room.userCount !== 1 ? 's' : ''}
                    </span>
                    <button
                      className="room-join-btn"
                      onClick={() => handleQuickJoin(room.id)}
                    >
                      Join →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}


      </div>
    </div>
  );
}
