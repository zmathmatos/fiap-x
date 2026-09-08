import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AppShell } from './components/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { VideoLibraryPage } from './features/videos/VideoLibraryPage';
import { VideoDetailPage } from './features/videos/VideoDetailPage';
import { UploadPage } from './features/upload/UploadPage';
import { useAuth } from './features/auth/useAuth';
import { DURATION } from './lib/motion';

/** Wraps one route's element so leaving and entering are a single crossfade. */
function Page({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: DURATION.base, ease: 'easeOut' }}
      className="flex flex-col gap-lg"
    >
      {children}
    </motion.div>
  );
}

function AuthedRoutes(): JSX.Element {
  const location = useLocation();

  return (
    // `mode="wait"` lets the outgoing page finish before the next one arrives;
    // overlapping them would shift the layout twice in a quarter second.
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={
              <Page>
                <VideoLibraryPage />
              </Page>
            }
          />
          <Route
            path="/upload"
            element={
              <Page>
                <UploadPage />
              </Page>
            }
          />
          <Route
            path="/videos/:id"
            element={
              <Page>
                <VideoDetailPage />
              </Page>
            }
          />
        </Route>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export function App(): JSX.Element {
  const { status } = useAuth();

  return (
    // `reducedMotion="user"` is the whole accessibility story for motion here:
    // every animation below collapses to an instant state change for anyone who
    // asked their OS to stop moving things.
    <MotionConfig reducedMotion="user">
      {status === 'loading' ? (
        // Nothing is rendered until the stored session has been checked, so the
        // login screen never flashes for a user who is already signed in.
        <div className="min-h-screen grid place-items-center">
          <span
            className="w-6 h-6 rounded-circle border-2 border-secondary-container border-t-primary animate-spin"
            aria-label="Carregando"
            role="status"
          />
        </div>
      ) : status === 'anonymous' ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      ) : (
        <AuthedRoutes />
      )}
    </MotionConfig>
  );
}
