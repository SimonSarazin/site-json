import { useCallback, useState } from "react";
import type { User } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { useProfilPermissions } from "./useProfilPermissions";
import { getEntityType } from "../actions/mutations/core";

/**
 * Détecte si l'utilisateur connecté a une invitation en attente pour rejoindre
 * (ou administrer) l'entité du site courant (organisation ou projet costum),
 * pour piloter une modale globale — même principe que useDiscourseAutoDetect
 * (modules/interop), mais sans appel réseau : les flags `isInviting`/
 * `isInvitingAdmin` sont déjà dérivés de `me.serverData.links` par
 * useProfilPermissions (elle-même basée sur entity.isInviting()/isInvitingAdmin()
 * côté SDK), donc dispo dès que `me`/`entity` sont chargés via useCocolight().
 *
 * `open` est calculé au rendu (pas de useEffect + setState : évite les
 * cascades de re-render et respecte react-hooks/set-state-in-effect) en
 * comparant l'id de l'entité invitante à `dismissedEntityId` : fermer la
 * modale (croix, clic extérieur, accepter, refuser) mémorise cet id pour ne
 * pas la rouvrir tant que la même invitation reste active ; si une nouvelle
 * invitation apparaît (id différent), elle rouvre automatiquement.
 *
 * `useHydrated()` : `me` est toujours `null` au SSR (cf. bonnes-pratiques
 * §5) → un utilisateur déjà connecté+invité au chargement de la page verrait
 * la modale s'ouvrir dès le 1er render client, avant que React n'ait fini de
 * réconcilier le HTML serveur. Radix marque alors `aria-hidden` sur les
 * autres éléments de la page (masquage a11y du fond pendant qu'un Dialog est
 * ouvert) — un attribut absent du HTML serveur (Dialog fermé côté SSR) →
 * mismatch d'hydratation sur des nœuds sans rapport (ex. AdminPanel). En
 * gardant `open` à `false` tant que `hydrated` est `false`, le 1er render
 * client reste identique au SSR ; la modale ne s'ouvre qu'au render suivant.
 */
export function usePendingSiteInvitation() {
  const { me, entity } = useCocolight();
  const permissions = useProfilPermissions(entity);
  const hydrated = useHydrated();
  const [dismissedEntityId, setDismissedEntityId] = useState<string | null>(null);

  // `me` change de RÉFÉRENCE à chaque connexion/déconnexion (CocolightProvider
  // instancie un nouvel objet à chaque événement userLoggedIn/sessionReset),
  // même pour le même compte. On repart d'une mémoire de fermeture propre à
  // chaque connexion : sinon, une invitation fermée pendant une session
  // précédente dans le même onglet resterait bloquée (invisible) après une
  // reconnexion sans reload — la modale ne réapparaîtrait qu'après un F5, qui
  // remonte tout le composant et réinitialise `dismissedEntityId`. Pattern
  // « ajuster l'état pendant le rendu » (recommandé par React : state, pas
  // ref — un accès à `ref.current` pendant le rendu est proscrit par
  // react-hooks/refs, incompatible React Compiler).
  const [prevMe, setPrevMe] = useState<User | null>(me);
  if (prevMe !== me) {
    setPrevMe(me);
    if (dismissedEntityId !== null) {
      setDismissedEntityId(null);
    }
  }

  const { isInviting, isInvitingAdmin } = permissions;
  const invitationEntityId = entity?.id ?? null;
  const shouldShow = hydrated && !!me && !!entity && (isInviting || isInvitingAdmin);
  const open = shouldShow && invitationEntityId !== dismissedEntityId;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!next) {
        setDismissedEntityId(invitationEntityId);
      }
    },
    [invitationEntityId]
  );

  return {
    open,
    setOpen,
    entity,
    isInvitingAdmin,
    entityType: entity ? getEntityType(entity) : null,
  };
}
