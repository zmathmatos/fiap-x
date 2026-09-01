import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { VideoLibraryPage } from './features/videos/VideoLibraryPage';
import { VideoDetailPage } from './features/videos/VideoDetailPage';
import { UploadPage } from './features/upload/UploadPage';
import { useAuth } from './features/auth/useAuth';

export function App(): JSX.Element {
  const { status } = useAuth();

  // Nothing is rendered until the stored session has been checked, so the login
  // screen never flashes for a user who is already signed in.
  if (status === 'loading') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <span className="spinner" aria-label="Carregando" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<VideoLibraryPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/videos/:id" element={<VideoDetailPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
