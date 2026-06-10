import { Header } from "@/types/site-schema";
import HeaderStandard from "./HeaderStandard";

interface DefaultHeaderProps {
  header: Header;
}

/**
 * Header par défaut / fallback (cas `default` + types non routés du `switch`).
 *
 * Ce n'est PAS un design : c'est l'indirection « quel header quand rien n'est
 * spécifié ». Il délègue au design retenu comme défaut — aujourd'hui
 * `HeaderStandard`. Pour changer le header par défaut du projet, ne modifier QUE
 * ce fichier (le `switch` de `SiteHeader` reste inchangé).
 */
export default function DefaultHeader({ header }: DefaultHeaderProps) {
  return <HeaderStandard header={header} />;
}
