import { useState, useEffect } from "react";
import { useCocolight } from "@/hooks/useCocolight";

/**
 * Hook qui retourne userContextId de manière compatible avec l'hydratation SSR.
 * - Premier render (hydratation) : retourne null pour matcher le SSR
 * - Après mount : retourne le vrai userContextId
 *
 * Cela permet d'éviter les erreurs d'hydratation quand le serveur rend avec
 * userContextId=null et le client avec userContextId="user123".
 */
export function useHydratedUserContextId(): string | null {
  const { entity } = useCocolight();
  const [hydratedUserContextId, setHydratedUserContextId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration: defers userContextId to avoid server/client mismatch
    setHydratedUserContextId(entity?.userContext?.id ?? null);
  }, [entity?.userContext?.id]);

  return hydratedUserContextId;
}
