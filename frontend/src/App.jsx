import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import env from './config/env';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Whiteboard from './pages/Whiteboard';

/**
 * Protected route — redirects to /auth if not logged in
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/board/:roomId"
        element={
          <ProtectedRoute>
            <Whiteboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  const googleClientId = env.GOOGLE_CLIENT_ID;
  const hasGoogleId = googleClientId && googleClientId !== 'your-google-client-id-here';

  const appContent = (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );

  // Only wrap with GoogleOAuthProvider if a valid client ID is configured
  if (hasGoogleId) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        {appContent}
      </GoogleOAuthProvider>
    );
  }

  return appContent;
}
