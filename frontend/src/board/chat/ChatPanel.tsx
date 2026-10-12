import { LIMITS, type ChatMessage, type Role } from '@syncboard/shared';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { HiOutlineTrash, HiPaperAirplane, HiXMark } from 'react-icons/hi2';
import { useToast } from '../../context/ToastContext';
import { emitWithAck, type AppSocket } from '../../lib/socket';

interface Props {
  socket: AppSocket;
  initial: ChatMessage[];
  initialHasMore: boolean;
  myUserId: string;
  role: Role;
  muted: boolean;
  open: boolean;
  onClose: () => void;
  onUnread: (count: number) => void;
}

export function ChatPanel({ socket, initial, initialHasMore, myUserId, role, muted, open, onClose, onUnread }: Props) {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const unread = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (!openRef.current && msg.user.id !== myUserId) {
        unread.current += 1;
        onUnread(unread.current);
      }
    };
    const onDeleted = ({ messageId }: { messageId: string }) =>
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    socket.on('chat:message', onMessage);
    socket.on('chat:deleted', onDeleted);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:deleted', onDeleted);
    };
  }, [socket, myUserId, onUnread]);

  useEffect(() => {
    if (open) {
      unread.current = 0;
      onUnread(0);
      stickToBottom.current = true;
    }
  }, [open, onUnread]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest) return;
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const res = await emitWithAck<{ messages: ChatMessage[]; hasMore: boolean }>(socket, 'chat:history', {
      before: oldest.id,
    });
    if (!res.ok) return toast(res.error.message, 'error');
    stickToBottom.current = false;
    setMessages((prev) => [...res.data.messages.filter((m) => !prev.some((p) => p.id === m.id)), ...prev]);
    setHasMore(res.data.hasMore);
    // Keep the viewport anchored on the message the user was reading.
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    stickToBottom.current = true;
    const res = await emitWithAck<ChatMessage>(socket, 'chat:send', { text });
    setSending(false);
    if (!res.ok) return toast(res.error.message, 'error');
    setInput('');
  };

  const remove = async (messageId: string) => {
    const res = await emitWithAck(socket, 'chat:delete', { messageId });
    if (!res.ok) toast(res.error.message, 'error');
  };

  return (
    <aside className={`side-panel chat-panel ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Board chat">
      <header className="side-panel-header">
        <h3>Chat</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close chat">
          <HiXMark />
        </button>
      </header>

      <div
        className="chat-messages"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {hasMore && (
          <button className="btn btn-ghost btn-sm load-older" onClick={() => void loadOlder()}>
            Load earlier messages
          </button>
        )}
        {messages.length === 0 && <div className="chat-empty">No messages yet. Ask a question! 👋</div>}
        {messages.map((m) => {
          const own = m.user.id === myUserId;
          return (
            <div key={m.id} className={`chat-msg ${own ? 'own' : ''}`}>
              <span className="chat-msg-user">{own ? 'You' : m.user.displayName}</span>
              <span className="chat-msg-text">{m.text}</span>
              <span className="chat-msg-time">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {(own || role === 'owner') && (
                  <button className="chat-msg-delete" onClick={() => void remove(m.id)} aria-label="Delete message">
                    <HiOutlineTrash />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {muted ? (
        <p className="chat-muted">The board owner has muted you in chat.</p>
      ) : (
        <form className="chat-input-form" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            maxLength={LIMITS.CHAT_MESSAGE_MAX}
            aria-label="Message"
          />
          <button className="chat-send-btn" disabled={!input.trim() || sending} aria-label="Send">
            <HiPaperAirplane />
          </button>
        </form>
      )}
    </aside>
  );
}
