import { Footer } from "@/types/site-schema";
import FooterRich from "./FooterRich";

interface DefaultFooterProps {
  footer: Footer;
}

/**
 * Footer par défaut / fallback (cas `default` + types non routés du `switch`).
 *
 * Ce n'est PAS un design : c'est l'indirection « quel footer quand rien n'est
 * spécifié ». Il délègue au design retenu comme défaut — aujourd'hui `FooterRich`
 * (newsletter + colonnes + socials). Pour changer le footer par défaut du projet,
 * ne modifier QUE ce fichier (le `switch` de `SiteFooter` reste inchangé).
 */
export default function DefaultFooter({ footer }: DefaultFooterProps) {
  return <FooterRich footer={footer} />;
}
