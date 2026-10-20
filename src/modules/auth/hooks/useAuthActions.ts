import { useNavigate } from "react-router";
import { useCocolight } from "@/hooks/useCocolight";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";

/** Fiche de l'utilisateur connecté (`/profil/<slug>`), `null` tant que son slug est inconnu. */
export function profileUrlOf(me: { serverData?: { slug?: string } } | null | undefined): string | null {
  const slug = me?.serverData?.slug;
  return slug ? `/profil/${slug}` : null;
}

/**
 * Logique d'authentification partagée (état + actions), indépendante de l'UI.
 * Source unique de vérité pour : qui est connecté, la déconnexion, l'URL de
 * profil, et les propriétés réactives d'affichage (nom, avatar, email).
 *
 * Remplace l'ex-`useHeaderAuth` (qui vivait dans `components/layout/header`) :
 * c'est de l'auth, pas du comportement de header.
 *
 * NB : pas de `useCallback`/`useMemo` manuel — le React Compiler gère la
 * mémoïsation (règle eslint `react-hooks/preserve-manual-memoization`).
 */
export function useAuthActions() {
  const { me, api } = useCocolight();
  const navigate = useNavigate();

  const isConnected = !!me?.isConnected;

  const avatarUrl =
    useReactiveProperty<string>(me?.serverData, "profilThumbImageUrl") ?? null;
  const name = useReactiveProperty<string>(me?.serverData, "name") ?? null;
  const email = useReactiveProperty<string>(me?.serverData, "email") ?? null;

  const logout = () => {
    try {
      api?.logout();
      navigate("/");
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  // URL du profil de l'utilisateur courant ; repli neutre tant que le slug est inconnu.
  const profileUrl = profileUrlOf(me) ?? "/profile";

  return { me, isConnected, logout, profileUrl, name, avatarUrl, email };
}
