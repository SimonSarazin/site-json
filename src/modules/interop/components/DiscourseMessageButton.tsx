import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { useT } from "@/hooks/useT";
import { useInteropConfig } from "../hooks/useInteropConfigQuery";
import { useInteropUserLinks } from "../hooks/useUserInteropLinks";
import "../i18n";

/**
 * Bouton « Envoyer un message » (interop Discourse) mis en avant en haut du profil,
 * façon LinkedIn / Messenger. Ouvre la composition d'un message privé Discourse
 * vers l'utilisateur du profil consulté.
 *
 * Le même lien existe (plus discret) dans l'en-tête du `DiscoursePod` ; ce composant
 * le promeut comme CTA principal dans `ProfileHeaderComplete`. Mêmes conditions
 * d'affichage que le lien du pod : forum configuré (`discourseUrl`), profil consulté
 * ayant un compte Discourse lié (`discourseUsername`) et profil d'un tiers
 * (`!isOwnProfile`).
 *
 * Rendu client-only : `isOwnProfile` dépend de `me` (toujours `null` au SSR) — sans
 * ça, le serveur afficherait le bouton sur son propre profil et le client le retirerait
 * après hydratation → mismatch.
 */
export default function DiscourseMessageButton() {
  const t = useT("modules/interop");
  const { discourseUrl } = useInteropConfig();
  const { discourseUsername, isOwnProfile } = useInteropUserLinks();

  return (
    <ClientOnly>
      {() => {
        if (!discourseUrl || !discourseUsername || isOwnProfile) return null;
        return (
          <Button asChild>
            <a
              href={`${discourseUrl}/new-message?username=${discourseUsername}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send />
              {t("discourse.send_message")}
            </a>
          </Button>
        );
      }}
    </ClientOnly>
  );
}
