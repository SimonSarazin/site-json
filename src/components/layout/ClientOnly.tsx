import React, { type ReactNode } from 'react';
import { useHydrated } from "@/hooks/useHydrated";

interface ClientOnlyProps {
  children: () => ReactNode;
  fallback?: ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps): React.ReactNode {
  return useHydrated() ? <>{children()}</> : <>{fallback}</>;
}
