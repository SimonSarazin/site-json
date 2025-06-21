import { useState, useEffect } from 'react';

export interface RouterState {
  currentPath: string;
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
}

export function useRouter(initialPath?: string): RouterState {
  const [currentPath, setCurrentPath] = useState(() => {
    // Prioritize initialPath for SSR consistency
    if (initialPath) {
      return initialPath;
    }
    // Fallback to window location for client-side
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    // Default for SSR
    return '/';
  });

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

  const goBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  const goForward = () => {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return {
    currentPath,
    navigate,
    goBack,
    goForward,
  };
}