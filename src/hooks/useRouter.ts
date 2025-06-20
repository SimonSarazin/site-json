import { useState, useEffect } from 'react';

export interface RouterState {
  currentPath: string;
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
}

export function useRouter(): RouterState {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.pathname;
  });

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const goBack = () => {
    window.history.back();
  };

  const goForward = () => {
    window.history.forward();
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle initial load and route changes
  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  return {
    currentPath,
    navigate,
    goBack,
    goForward,
  };
}