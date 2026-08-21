import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useCocolight } from "./useCocolight";
import type { Page } from "@/types/site";
import type { User } from "@communecter/cocolight-api-client";
import { LOGIN_PATH, buildReturnTo } from "@/lib/authRedirect";
import { evaluatePageAccess } from "@/lib/pageAccess";

/**
 * Toutes les redirections de garde sont en `replace`, jamais en `push` : sinon la page refusée
 * reste dans l'historique et le bouton Retour y renvoie, ce qui la fait re-rediriger aussitôt —
 * l'utilisateur était piégé dans son onglet.
 *
 * `to("/login")` mémorise la page visée dans le `state` (cf. `src/lib/authRedirect.ts`), que les
 * formulaires d'auth relisent pour y ramener après connexion.
 */
type GuardNavigate = (path: string, opts?: { state?: unknown }) => void;

const registry: Record<
  string,
  (args: { me: User | null; navigate: GuardNavigate; returnTo: string }) => void
> = {
  "auth-required": ({ me, navigate, returnTo }) => {
    if (!me?.isConnected) navigate(LOGIN_PATH, { state: { from: returnTo } });
  },
  "admin-only": ({ me, navigate }) => {
    if (!me?.serverData?.roles?.["admin"]) navigate("/");
  },
  "redirect-if-authenticated": ({ me, navigate }) => {
    if (me?.isConnected) navigate("/");
  },
};

export function usePageGuards(page: Page) {
  const { me, loading } = useCocolight();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!page || loading) return;

    const returnTo = buildReturnTo(pathname, search);
    // `replace` systématique — cf. l'en-tête du registre.
    const go: GuardNavigate = (path, opts) => navigate(path, { replace: true, state: opts?.state });

    // Seul le mode `redirect` NAVIGUE. En `prompt` et en `hide`, la page reste à l'écran et
    // c'est `SiteRenderer` qui décide de ce qu'elle montre (`GatedPageNotice`) — même décision
    // d'accès pour les deux, via `evaluatePageAccess`, elles ne peuvent pas diverger.
    const acces = evaluatePageAccess(page, me);
    if (acces.gated) {
      if (acces.granted || acces.mode !== "redirect") return;
      if (acces.reason === "anonymous") go(LOGIN_PATH, { state: { from: returnTo } });
      else go("/");
      return;
    }

    page.middleware?.forEach((mw) => {
      registry[mw]?.({ me, navigate: go, returnTo });
    });
  }, [page, me, loading, navigate, pathname, search]);
}
