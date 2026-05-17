import { useEffect, useState } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useInteropConfig } from "./useInteropConfigQuery";
import { asInteropEntity } from "./_interopEntity";

type InteropData = Record<string, Record<string, string | false>>;

interface DiscourseAutoUser {
  username: string;
  name?: string;
  avatar_template?: string;
  [k: string]: unknown;
}

/**
 * Détecte automatiquement si l'email de l'utilisateur correspond à un compte Discourse.
 * Appelle checkDiscourseEmailMatch une seule fois au montage si les conditions sont remplies.
 */
export function useDiscourseAutoDetect() {
  const { me, entity } = useCocolight();
  const { costumSlug, hasDiscourse } = useInteropConfig();
  const [autoUser, setAutoUser] = useState<DiscourseAutoUser | null>(null);
  const [open, setOpen] = useState(false);

  const interop = me?.serverData?.interop as InteropData | undefined;
  const discourseVal = costumSlug
    ? (interop?.discourse?.[costumSlug] as string | false | undefined)
    : undefined;

  const isLinked = typeof discourseVal === "string";
  const isDismissed = discourseVal === false;
  const shouldCheck = !!me && !!entity && hasDiscourse && !isLinked && !isDismissed;

  useEffect(() => {
    if (!shouldCheck || !entity) return;

    let cancelled = false;

    const check = async () => {
      try {
        const result = await asInteropEntity(entity).checkDiscourseEmailMatch();

        if (!cancelled && result.found && result.user) {
          setAutoUser(result.user as DiscourseAutoUser);
          setOpen(true);
        }
      } catch {
        // silencieux si l'API échoue
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
    // On veut que ça s'exécute une seule fois quand shouldCheck devient true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldCheck]);

  return { autoUser, open, setOpen };
}
