import { useDiscourseAutoDetect } from "../hooks/useDiscourseAutoDetect";
import DiscourseAutoLinkModal from "./DiscourseAutoLinkModal";

/**
 * Modal globale de liaison Discourse — à monter une seule fois dans le layout racine.
 * Détecte automatiquement si l'email de l'utilisateur correspond à un compte Discourse
 * et affiche la modal de liaison si c'est le cas.
 */
export default function DiscourseGlobalModal() {
  const { autoUser, open, setOpen } = useDiscourseAutoDetect();

  return (
    <DiscourseAutoLinkModal
      open={open}
      onOpenChange={setOpen}
      autoUser={autoUser}
    />
  );
}
