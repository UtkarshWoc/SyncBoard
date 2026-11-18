import { GoogleOAuthProvider } from '@react-oauth/google';
import { Analytics } from '@vercel/analytics/react';
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { RedirectIfAuthed, RequireAuth } from './components/RouteGuards';
import { Spinner } from './components/ui';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { env } from './lib/env';
import AuthPage from './pages/AuthPage';
import { ForgotPasswordPage, NotFoundPage, ResetPasswordPage, VerifyEmailPage } from './pages/AccountPages';
import DashboardPage from './pages/DashboardPage';
import InvitePage from './pages/InvitePage';
import ProfilePage from './pages/ProfilePage';

// The whiteboard (Excalidraw) is by far the largest chunk; load it only when a board opens.
const BoardPage = lazy(() => import('./pages/BoardPage'));

function Providers({ children }: { children: ReactNode }) {
  const tree = (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>{children}</SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
  return env.GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={env.GOOGLE_CLIENT_ID}>{tree}</GoogleOAuthProvider>
  ) : (
    tree
  );
}

export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Suspense fallback={<Spinner label="Loading…" />}>
          <Routes>
            <Route
              path="/auth"
              element={
                <RedirectIfAuthed>
                  <AuthPage />
                </RedirectIfAuthed>
              }
            />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/board/:boardId"
              element={
                <RequireAuth>
                  <BoardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/invite/:token"
              element={
                <RequireAuth>
                  <InvitePage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Analytics />
    </Providers>
  );
}
