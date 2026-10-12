import { Excalidraw, Footer, MainMenu, WelcomeScreen, getSceneVersion, restoreElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import type { AuthUser, BoardSummary, JoinedBoard, Role } from '@syncboard/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  HiOutlineArrowLeft,
  HiOutlineChatBubbleLeftRight,
  HiOutlineChatBubbleOvalLeftEllipsis,
  HiOutlineClock,
  HiOutlineDocumentArrowDown,
  HiOutlineEye,
  HiOutlineMoon,
  HiOutlinePhone,
  HiOutlineShare,
  HiOutlineSquares2X2,
  HiOutlineSun,
  HiOutlineVariable,
} from 'react-icons/hi2';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api, errorMessage } from '../lib/api';
import { env } from '../lib/env';
import type { AppSocket } from '../lib/socket';
import { copyText, boardUrl } from '../lib/util';
import { CallDock } from './call/CallDock';
import { useCall } from './call/useCall';
import { ChatPanel } from './chat/ChatPanel';
import { CommentsLayer } from './comments/CommentsLayer';
import { EquationDialog } from './equation/EquationDialog';
import { exportPdf, renderThumbnail } from './export/exporters';
import { atLeastEditor } from './roles';
import { ShareDialog } from './share/ShareDialog';
import type { PresenceSync } from './sync/PresenceSync';
import type { SceneSync } from './sync/SceneSync';
import { TemplatesDialog } from './templates/TemplatesDialog';
import { insertTemplate } from './templates/insert';
import type { BoardSession } from './useBoardSession';
import { VersionsDialog } from './versions/VersionsDialog';

const THUMBNAIL_EVERY_MS = 45_000;

type Dialog = 'share' | 'versions' | 'templates' | 'equation' | null;

interface Props {
  socket: AppSocket;
  session: BoardSession;
  initial: JoinedBoard;
  board: BoardSummary;
  role: Role;
  sync: SceneSync;
  presence: PresenceSync;
  user: AuthUser;
  initialTemplate: string | null;
}

export function BoardWorkspace({
  socket,
  session,
  initial,
  board,
  role,
  sync,
  presence,
  user,
  initialTemplate,
}: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const { isConnected } = useSocket();
  const call = useCall(socket);

  const [excalidraw, setExcalidraw] = useState<ExcalidrawImperativeAPI | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [commenting, setCommenting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [openComments, setOpenComments] = useState(0);
  const [viewVersion, setViewVersion] = useState(0);
  const canEdit = atLeastEditor(role);
  const muted = session.mutedUserIds.includes(user.id);
  const mySocketId = session.me?.socketId ?? null;

  // Excalidraw reads initialData once; restore() fills in any fields older elements lack.
  const initialData = useMemo(
    () => ({
      elements: restoreElements(initial.elements as never, null),
      appState: { theme, collaborators: new Map() },
      scrollToContent: true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial],
  );

  // ─── Wire the canvas to sync/presence once its scene is initialised ─────
  // Excalidraw loads initialData asynchronously after the API callback fires, and
  // anything applied before that is overwritten. Its first onChange marks the
  // scene as ready, so remote updates and templates are applied from there.
  const initialised = useRef(false);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const onFirstChange = (api: ExcalidrawImperativeAPI) => {
    initialised.current = true;
    sync.attach(api);
    sync.init(initial.elements, initial.fileIds, false);
    presence.attach(api);
    if (initialTemplate && canEdit && api.getSceneElements().length === 0) {
      insertTemplate(api, initialTemplate);
      // Don't re-insert on refresh.
      navigate('.', { replace: true, state: null });
    } else if (api.getSceneElements().length > 0) {
      // Open on the content rather than wherever the origin happens to be.
      requestAnimationFrame(() => api.scrollToContent(undefined, { fitToContent: true }));
    }
  };

  useEffect(() => {
    presence.setParticipants(session.participants, mySocketId);
  }, [presence, session.participants, mySocketId]);

  // Leave the call if our access to the board goes away.
  useEffect(() => () => call.leave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Thumbnails for the dashboard ────────────────────────────
  const lastThumbVersion = useRef(-1);
  const pushThumbnail = useCallback(async () => {
    if (!excalidraw || !atLeastEditor(role)) return;
    const version = getSceneVersion(excalidraw.getSceneElementsIncludingDeleted());
    if (version === lastThumbVersion.current) return;
    lastThumbVersion.current = version;
    try {
      const dataURL = await renderThumbnail(excalidraw);
      if (dataURL) await api.setThumbnail(board.id, dataURL);
    } catch {
      // Thumbnails are best-effort.
    }
  }, [excalidraw, role, board.id]);

  useEffect(() => {
    lastThumbVersion.current = excalidraw ? getSceneVersion(excalidraw.getSceneElementsIncludingDeleted()) : -1;
    const timer = setInterval(() => void pushThumbnail(), THUMBNAIL_EVERY_MS);
    return () => {
      clearInterval(timer);
      void pushThumbnail();
    };
  }, [pushThumbnail, excalidraw]);

  // ─── Actions ─────────────────────────────────────────────────
  const onExportPdf = async () => {
    if (!excalidraw) return;
    try {
      await exportPdf(excalidraw, board.name);
    } catch (err) {
      toast(errorMessage(err, 'Export failed'), 'error');
    }
  };

  const copyLink = async () => {
    toast((await copyText(boardUrl(board.id))) ? 'Board link copied' : 'Could not copy the link', 'info');
  };

  const onUnread = useCallback((n: number) => setUnread(n), []);
  const onCommentCount = useCallback((n: number) => setOpenComments(n), []);
  const inCallCount = session.participants.filter((p) => p.inCall).length;

  const renderTopRightUI = () => (
    <div className="board-toolbar">
      <button
        className={`tb-btn ${commenting ? 'active' : ''}`}
        onClick={() => setCommenting((c) => !c)}
        title={commenting ? 'Click on the board to place a comment (Esc to cancel)' : 'Add a comment'}
        aria-pressed={commenting}
      >
        <HiOutlineChatBubbleOvalLeftEllipsis />
        {openComments > 0 && <span className="tb-badge">{openComments}</span>}
      </button>
      <button className={`tb-btn ${chatOpen ? 'active' : ''}`} onClick={() => setChatOpen((o) => !o)} title="Chat">
        <HiOutlineChatBubbleLeftRight />
        {unread > 0 && <span className="tb-badge">{unread}</span>}
      </button>
      {!call.inCall && (
        <button
          className="tb-btn"
          onClick={() => void call.join(false)}
          disabled={call.joining}
          title={inCallCount ? `Join the call (${inCallCount} in call)` : 'Start a voice/video call'}
        >
          <HiOutlinePhone />
          {inCallCount > 0 && <span className="tb-badge live">{inCallCount}</span>}
        </button>
      )}
      <button className="tb-btn primary" onClick={() => setDialog('share')} title="Share">
        <HiOutlineShare />
        <span className="hide-sm">Share</span>
      </button>
    </div>
  );

  useEffect(() => {
    if (call.error) toast(call.error, 'error');
  }, [call.error, toast]);

  useEffect(() => {
    if (!commenting) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCommenting(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commenting]);

  return (
    <div className="board-page" data-testid="board-page">
      <div className="board-canvas">
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
            setExcalidraw(api);
            if (env.EXPOSE_TEST_HOOKS) {
              (window as unknown as { __excalidraw?: ExcalidrawImperativeAPI }).__excalidraw = api;
            }
          }}
          initialData={initialData}
          isCollaborating
          theme={theme}
          viewModeEnabled={!canEdit}
          gridModeEnabled={board.background === 'grid'}
          name={board.name}
          onChange={(_elements, appState) => {
            if (!initialised.current) {
              if (apiRef.current) onFirstChange(apiRef.current);
              return;
            }
            sync.onLocalChange();
            presence.onAppStateChange(appState);
          }}
          onPointerUpdate={(p) => presence.onPointerUpdate(p)}
          onScrollChange={() => {
            presence.onScrollChange();
            setViewVersion((v) => v + 1);
          }}
          onUserFollow={(p) => presence.follow(p.action === 'FOLLOW' ? p.userToFollow.socketId : null)}
          renderTopRightUI={renderTopRightUI}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              clearCanvas: canEdit,
              changeViewBackgroundColor: canEdit,
              export: { saveFileToDisk: true },
            },
          }}
        >
          <MainMenu>
            <MainMenu.Item icon={<HiOutlineArrowLeft />} onSelect={() => navigate('/')}>
              Back to my boards
            </MainMenu.Item>
            <MainMenu.Separator />
            {canEdit && (
              <>
                <MainMenu.Item icon={<HiOutlineSquares2X2 />} onSelect={() => setDialog('templates')}>
                  Insert template…
                </MainMenu.Item>
                <MainMenu.Item icon={<HiOutlineVariable />} onSelect={() => setDialog('equation')}>
                  Insert equation…
                </MainMenu.Item>
              </>
            )}
            <MainMenu.Item icon={<HiOutlineClock />} onSelect={() => setDialog('versions')}>
              Version history
            </MainMenu.Item>
            <MainMenu.Item icon={<HiOutlineShare />} onSelect={() => setDialog('share')}>
              Share…
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.Item icon={<HiOutlineDocumentArrowDown />} onSelect={() => void onExportPdf()}>
              Export as PDF
            </MainMenu.Item>
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.Export />
            {canEdit && <MainMenu.DefaultItems.ClearCanvas />}
            <MainMenu.Separator />
            <MainMenu.Item icon={theme === 'dark' ? <HiOutlineSun /> : <HiOutlineMoon />} onSelect={toggleTheme}>
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </MainMenu.Item>
            <MainMenu.DefaultItems.Help />
            {canEdit && <MainMenu.DefaultItems.ChangeCanvasBackground />}
          </MainMenu>

          <WelcomeScreen>
            <WelcomeScreen.Hints.MenuHint />
            <WelcomeScreen.Hints.ToolbarHint />
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Heading>{board.name}</WelcomeScreen.Center.Heading>
              <WelcomeScreen.Center.Menu>
                {canEdit && (
                  <>
                    <WelcomeScreen.Center.MenuItem
                      onSelect={() => setDialog('templates')}
                      icon={<HiOutlineSquares2X2 />}
                    >
                      Start from a template
                    </WelcomeScreen.Center.MenuItem>
                    <WelcomeScreen.Center.MenuItem onSelect={() => setDialog('equation')} icon={<HiOutlineVariable />}>
                      Insert an equation
                    </WelcomeScreen.Center.MenuItem>
                  </>
                )}
                <WelcomeScreen.Center.MenuItem onSelect={() => void copyLink()} icon={<HiOutlineShare />}>
                  Copy invite link
                </WelcomeScreen.Center.MenuItem>
                <WelcomeScreen.Center.MenuItemHelp />
              </WelcomeScreen.Center.Menu>
            </WelcomeScreen.Center>
          </WelcomeScreen>

          <Footer>
            <div className="board-footer">
              <span
                className={`status-dot ${isConnected ? 'online' : 'offline'}`}
                title={isConnected ? 'Live' : 'Reconnecting…'}
              />
              <span className="board-footer-name" title={board.name}>
                {board.name}
              </span>
              <button className="code-chip" onClick={() => void copyLink()} title="Copy board link">
                {board.id}
              </button>
              {!canEdit && (
                <span className="role-chip">
                  <HiOutlineEye /> View only
                </span>
              )}
            </div>
          </Footer>
        </Excalidraw>

        {excalidraw && (
          <CommentsLayer
            socket={socket}
            api={excalidraw}
            initial={initial.comments}
            viewVersion={viewVersion}
            placing={commenting}
            onPlaced={() => setCommenting(false)}
            showResolved={showResolved}
            myUserId={user.id}
            role={role}
            onCountChange={onCommentCount}
          />
        )}
        {commenting && (
          <div className="comment-mode-banner">
            Click anywhere to pin a comment ·{' '}
            <label className="check small">
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> show
              resolved
            </label>{' '}
            ·{' '}
            <button className="link-btn" onClick={() => setCommenting(false)}>
              Cancel
            </button>
          </div>
        )}
        {!isConnected && (
          <div className="reconnect-banner">Reconnecting… your changes will sync when you're back online.</div>
        )}
      </div>

      <ChatPanel
        socket={socket}
        initial={initial.chat}
        initialHasMore={initial.hasMoreChat}
        myUserId={user.id}
        role={role}
        muted={muted}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onUnread={onUnread}
      />

      <CallDock call={call} participants={session.participants} mySocketId={mySocketId} />

      {dialog === 'share' && (
        <ShareDialog
          boardId={board.id}
          role={role}
          myUserId={user.id}
          socket={socket}
          mutedUserIds={session.mutedUserIds}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'versions' && excalidraw && (
        <VersionsDialog
          boardId={board.id}
          role={role}
          socket={socket}
          excalidraw={excalidraw}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'templates' && excalidraw && <TemplatesDialog api={excalidraw} onClose={() => setDialog(null)} />}
      {dialog === 'equation' && excalidraw && <EquationDialog api={excalidraw} onClose={() => setDialog(null)} />}
    </div>
  );
}
