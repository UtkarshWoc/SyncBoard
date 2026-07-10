import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { HiPaperAirplane } from 'react-icons/hi2';

export default function Chat({ username }) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat:message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!isOpen) setUnread((prev) => prev + 1);
    });

    socket.on('chat:history', (history) => {
      setMessages(history);
    });

    return () => {
      socket.off('chat:message');
      socket.off('chat:history');
    };
  }, [socket, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    socket.emit('chat:message', { text: input.trim() });
    setInput('');
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setUnread(0);
  };

  return (
    <>
      <button
        id="chat-toggle-btn"
        className={`chat-toggle ${isOpen ? 'open' : ''}`}
        onClick={toggleChat}
      >
        💬
        {unread > 0 && <span className="chat-badge">{unread}</span>}
      </button>

      <div className={`chat-panel ${isOpen ? 'open' : ''}`} id="chat-panel">
        <div className="chat-header">
          <h3>Room Chat</h3>
          <button className="chat-close" onClick={toggleChat}>
            ✕
          </button>
        </div>

        <div className="chat-messages" id="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">No messages yet. Say hi! 👋</div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-msg ${msg.username === username ? 'own' : ''}`}
            >
              <span className="chat-msg-user">{msg.username}</span>
              <span className="chat-msg-text">{msg.text}</span>
              <span className="chat-msg-time">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-form" onSubmit={sendMessage}>
          <input
            id="chat-input"
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" id="chat-send-btn" className="chat-send-btn">
            <HiPaperAirplane />
          </button>
        </form>
      </div>
    </>
  );
}
