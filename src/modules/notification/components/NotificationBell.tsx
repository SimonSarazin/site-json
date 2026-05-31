import { Suspense } from "react";
import { lazy } from "vite-preload";
import { useHydrated } from "@/hooks/useHydrated";

/**
 * Wrapper lazy de la cloche de notifications — le drop-in des headers.
 *
 * Le code lourd (panel, hooks React Query, navigation, i18n…) vit dans
 * `NotificationBellImpl` et n'est **téléchargé que lorsque ce composant est
 * rendu**, c.-à-d. uniquement sur les sites où `header.utilities.notifications`
 * est activé. Sur les autres, le `&&` du header court-circuite → le chunk n'est
 * jamais chargé (zéro JS, zéro requête).
 *
 * Le gate `useHydrated` évite de déclencher l'import côté SSR (la cloche est de
 * toute façon masquée au SSR, cf. gotcha #10) → markup serveur/client identique.
 *
 * Les headers l'appellent via `{header.utilities?.notifications && <NotificationBell />}`.
 */
const NotificationBellImpl = lazy(() => import("./NotificationBellImpl"));

export default function NotificationBell() {
  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <Suspense fallback={null}>
      <NotificationBellImpl />
    </Suspense>
  );
}
