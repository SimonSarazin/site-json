import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AuthModalContext, type AuthModalOptions } from "./AuthModalContext";
import { AuthModalLazy } from "../components/AuthModalLazy";

/**
 * Provider global du modal d'authentification — monté une seule fois au niveau
 * `SiteShell`, autour de `<Outlet />`. Tous les déclencheurs (headers, CoForm,
 * news, profil…) ouvrent CE modal via `useAuthModal().openLogin()`, plutôt que
 * de redéclarer leur propre état + `<AuthModalLazy>`.
 *
 * SSR-safe : `open` initial `false`, `AuthModalLazy` rend `null` tant que fermé
 * (le chunk auth n'est chargé qu'à l'ouverture). Pattern calqué sur
 * `CommandPaletteProvider`.
 */
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Options du dernier `openLogin()` (onSuccess / mode initial), routées au modal.
  const [options, setOptions] = useState<AuthModalOptions | null>(null);

  const openLogin = useCallback((opts?: AuthModalOptions) => {
    setOptions(opts ?? null);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    // À la fermeture, on oublie les options pour ne pas les rejouer à la
    // prochaine ouverture déclenchée sans opts.
    if (!next) setOptions(null);
  }, []);

  const value = useMemo(
    () => ({ isOpen: open, openLogin, close }),
    [open, openLogin, close],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModalLazy
        open={open}
        onOpenChange={handleOpenChange}
        onSuccess={options?.onSuccess}
        initialMode={options?.initialMode}
      />
    </AuthModalContext.Provider>
  );
}
