// Bundle i18n du module profil : le toast de `useRequestToJoin` parle avec ses
// clés (`toast.relationship.*`) alors qu'il est déclenché ICI, hors profil —
// sans cet import la confirmation s'afficherait en clé brute.
import "@/modules/profil/i18n";

import { useState } from "react";
import { Clock, UserRoundCheck, UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { useT } from "@/hooks/useT";
import { useAuthModal } from "@/modules/auth/hooks/useAuthModal";
import { useRequestToJoin } from "@/modules/profil/actions/mutations/relationship";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";

/**
 * Bouton « Rejoindre la communauté » du hero — envoie une VRAIE demande
 * d'adhésion à l'entité qui porte le site (`useCocolight().entity`, une
 * organisation ou un projet), via la mutation du module profil.
 *
 * L'entité décide du vocabulaire : une organisation a des *membres*
 * (`canRequestMembership`), un projet des *contributeurs*
 * (`canRequestContributor`). `requestToJoin` couvre les deux — le bouton lit
 * donc les deux permissions, sinon il resterait inerte sur un site porté par
 * un projet.
 */
export function AmpliJoinButton({ className }: { className?: string }) {
  const t = useT("modules/ampli");
  const { entity, me } = useCocolight();
  const { openLogin } = useAuthModal();
  const hydrated = useHydrated();
  const permissions = useProfilPermissions(entity);
  const join = useRequestToJoin(entity);
  /** Retour immédiat après l'envoi : les liens de l'entité ne se rafraîchissent
   *  pas dans la foulée, l'utilisateur ne doit pas pouvoir redemander. */
  const [requested, setRequested] = useState(false);

  // `me` et les liens de l'entité sont TOUJOURS vides au SSR : les lire avant
  // l'hydratation ferait diverger le premier rendu client du HTML serveur.
  // Avant hydratation on rend l'appel à l'action nu — c'est de toute façon le
  // bon libellé pour un visiteur anonyme, qui est le cas majoritaire ici.
  const joined =
    hydrated && (permissions.isMember || permissions.isContributor || permissions.isAdmin);
  const pending = hydrated && (requested || permissions.isToBeValidated);
  const canJoin = permissions.canRequestMembership || permissions.canRequestContributor;
  // Anonyme → le clic ouvre la connexion ; connecté → il faut une entité et le
  // droit de demander.
  const actionable = !me || (!!entity && canJoin);

  const handleClick = () => {
    // Rejoindre exige un compte (la demande porte l'userId) : on ouvre la
    // connexion plutôt que de laisser partir un appel voué à l'échec. Pas de
    // demande automatique au retour : l'utilisateur reprend la main sur un
    // bouton qui affiche enfin son vrai état.
    if (!me) {
      openLogin();
      return;
    }
    if (!entity || !canJoin) return;
    join.mutate(undefined, { onSuccess: () => setRequested(true) });
  };

  const [label, Icon] = joined
    ? [t("AmpliHero.joined"), UserRoundCheck]
    : pending
      ? [t("AmpliHero.joinPending"), Clock]
      : [t("AmpliHero.join"), UserRoundPlus];

  return (
    <Button
      variant="secondary"
      size="lg"
      className={className}
      disabled={join.isPending || joined || pending || (hydrated && !actionable)}
      onClick={handleClick}
    >
      <Icon />
      {label}
    </Button>
  );
}

export default AmpliJoinButton;
