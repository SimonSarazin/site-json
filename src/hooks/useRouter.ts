import { useCallback, useSyncExternalStore } from 'react';

export interface RouterState {
  currentPath: string;
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
}

function subscribeToPathname(callback: () => void) {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}

function getPathnameSnapshot() {
  return window.location.pathname;
}

function getServerPathnameSnapshot() {
  return '/';
}

export function useRouter(): RouterState {
  const currentPath = useSyncExternalStore(
    subscribeToPathname,
    getPathnameSnapshot,
    getServerPathnameSnapshot,
  );

  const navigate = useCallback((path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      // Dispatch popstate so useSyncExternalStore picks up the change
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, []);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }, []);

  const goForward = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  }, []);

  return {
    currentPath,
    navigate,
    goBack,
    goForward,
  };
}