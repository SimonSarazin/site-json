import { useState, useEffect } from 'react';

export interface RouterState {
  currentPath: string;
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
}

export function useRouter(): RouterState {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/'; // Default path for SSR
  });

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
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
    
    // Set initial path on client hydration
    setCurrentPath(window.location.pathname);
    
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