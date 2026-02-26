import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Hook SSR-safe pour détecter si le composant est monté côté client.
 * Utilise `useSyncExternalStore` au lieu de `useState` + `useEffect`
 * pour éviter le warning `set-state-in-effect` du React Compiler.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
