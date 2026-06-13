import { Suspense } from "react";
import { useSite } from "@/hooks/useSite";
import { resolveAuthVariant } from "./variants/registry";

type AuthMode = "login" | "register" | "recover";

interface AuthModalLazyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Joué quand la connexion réussit, avant fermeture (routé vers `LoginForm`). */
  onSuccess?: () => void;
  /** Mode affiché à l'ouverture (défaut : `"login"`). */
  initialMode?: AuthMode;
}

/**
 * Point de montage lazy de la modal d'auth, utilisé par les headers.
 *
 * - La modal n'est montée qu'à l'ouverture (`open === true`) : le chunk
 *   `AuthModal` (+ formulaires) est chargé au clic sur « Se connecter », pas
 *   dans le bundle initial de chaque page où le header est rendu.
 * - Le variant de design est résolu via `config.auth.variant` (registry).
 *
 * Pattern : lazy() vite-preload + montage conditionnel (cf. CagnotteDialog) +
 * Suspense (cf. RootLayout).
 */
export function AuthModalLazy({
  open,
  onOpenChange,
  onSuccess,
  initialMode,
}: AuthModalLazyProps) {
  const { config } = useSite();
  const { AuthModal } = resolveAuthVariant(config.auth?.variant);

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <AuthModal
        open={open}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        initialMode={initialMode}
      />
    </Suspense>
  );
}

export default AuthModalLazy;
