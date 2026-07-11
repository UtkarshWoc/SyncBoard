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

    socket.emit(
      'room:create',
      { roomName: roomName.trim() || undefined, username, isPublic },
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
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
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
        </div>
      </nav>

      {/* Animated background */}
      <div className="home-bg">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>

      <div className="home-container">
        {/* Hero Section */}
        <header className="home-hero">
          <div className="logo-wrapper">
            <div className="logo-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#logoGrad)" />
                <path d="M16 32L20 16L28 28L36 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 24H14M34 24H36M24 12V14M24 34V36" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                <defs>
                  <linearGradient id="logoGrad" x1="4" y1="4" x2="44" y2="44">
                    <stop stopColor="#6C5CE7" />
                    <stop offset="1" stopColor="#00CEC9" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="logo-text">{env.APP_NAME}</h1>
          </div>
          <p className="home-subtitle">
            Real-time collaborative whiteboard. Draw, sketch, and brainstorm together.
          </p>
        </header>

        {/* Main Card */}
        <main className="home-card" id="home-card">
          {/* Mode tabs */}
          <div className="mode-tabs" id="mode-tabs">
            <button
              className={`mode-tab ${mode === 'create' ? 'active' : ''}`}
              onClick={() => { setMode('create'); setError(''); }}
              id="tab-create"
            >
              <HiOutlinePlus /> Create Room
            </button>
            <button
              className={`mode-tab ${mode === 'join' ? 'active' : ''}`}
              onClick={() => { setMode('join'); setError(''); }}
              id="tab-join"
            >
              <HiOutlineArrowRightOnRectangle /> Join Room
            </button>
          </div>

          {/* Create room form */}
          {mode === 'create' && (
            <div className="form-section" id="create-section">
              <div className="input-group">
                <label htmlFor="room-name-input">Room Name</label>
                <input
                  id="room-name-input"
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
                className="primary-btn"
                onClick={handleCreate}
                disabled={!isConnected}
              >
                <HiOutlinePlus /> Create & Enter
              </button>
            </div>
          )}

          {/* Join room form */}
          {mode === 'join' && (
            <div className="form-section" id="join-section">
              <div className="input-group">
                <label htmlFor="join-code-input">Room Code</label>
                <input
                  id="join-code-input"
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
                className="primary-btn join-btn"
                onClick={handleJoin}
                disabled={!isConnected}
              >
                <HiOutlineArrowRightOnRectangle /> Join Room
              </button>
            </div>
          )}

          {error && <p className="error-msg" id="error-message">{error}</p>}
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
