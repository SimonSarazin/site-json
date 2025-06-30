import { type ReactNode } from 'react';
import { useHydrated } from "@/hooks/useHydrated";

interface ClientOnlyProps {
  children: () => ReactNode;
  fallback?: ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps): JSX.Element {
  return useHydrated() ? <>{children()}</> : <>{fallback}</>;
}
