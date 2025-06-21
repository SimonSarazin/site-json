import { useEffect } from 'react';
import { useCocolight } from './useCocolight';
import { useRouterContext } from '@/contexts/RouterContext';

interface MiddlewareContext {
  user: any;
  path: string;
  navigate: (path: string) => void;
}

// Registry of middleware functions
const middlewareRegistry: Record<string, (context: MiddlewareContext) => Promise<boolean> | boolean> = {
  // Example middleware functions
  'auth-required': ({ user }) => {
    return !!user?.isConnected;
  },
  
  'admin-only': ({ user }) => {
    return user?.isConnected && user?.serverData?.roles?.includes('admin');
  },
  
  'redirect-if-authenticated': ({ user, navigate }) => {
    if (user?.isConnected) {
      navigate('/dashboard');
      return false;
    }
    return true;
  },
  
  'maintenance-mode': () => {
    // Check if site is in maintenance mode
    const maintenanceMode = localStorage.getItem('maintenance-mode');
    return maintenanceMode !== 'true';
  }
};

export function useMiddleware(middlewareList: string[] = []) {
  const { me } = useCocolight();
  const { currentPath, navigate } = useRouterContext();

  useEffect(() => {
    const runMiddleware = async () => {
      for (const middlewareName of middlewareList) {
        const middleware = middlewareRegistry[middlewareName];
        
        if (middleware) {
          const context: MiddlewareContext = {
            user: me,
            path: currentPath,
            navigate
          };
          
          const result = await middleware(context);
          
          if (!result) {
            // Middleware failed, stop execution
            break;
          }
        } else {
          console.warn(`Middleware "${middlewareName}" not found in registry`);
        }
      }
    };

    if (middlewareList.length > 0) {
      runMiddleware();
    }
  }, [middlewareList, me, currentPath, navigate]);
}

// Function to register custom middleware
export function registerMiddleware(name: string, middleware: (context: MiddlewareContext) => Promise<boolean> | boolean) {
  middlewareRegistry[name] = middleware;
}