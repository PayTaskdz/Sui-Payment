import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getProfile } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
const FullscreenLoader = () => (
  <div className="app-container flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
  </div>
);

export default function ProtectedRoute({
  children,
  requireOnboarded = true,
}: {
  children: JSX.Element;
  requireOnboarded?: boolean;
}) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const location = useLocation();

  const [profileLoading, setProfileLoading] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  const shouldCheckProfile = useMemo(
    () => Boolean(isAuthenticated && requireOnboarded),
    [isAuthenticated, requireOnboarded]
  );

  useEffect(() => {
    if (!shouldCheckProfile) {
      setIsOnboarded(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setProfileLoading(true);
      try {
        const res = await getProfile();
        const data = res.data as unknown as { username?: unknown };
        const username = typeof data?.username === 'string' ? data.username : null;

        if (cancelled) return;
        setIsOnboarded(Boolean(username));
      } catch {
        if (cancelled) return;
        setIsOnboarded(null);
      } finally {
        if (cancelled) return;
        setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldCheckProfile]);

  if (!isAuthenticated && !isAuthLoading) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isAuthLoading || (shouldCheckProfile && profileLoading)) {
    return <FullscreenLoader />;
  }

  if (shouldCheckProfile && isOnboarded === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

