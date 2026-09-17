import { ExternalLink, FileText } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useResourceData } from "../../../hooks/useResourceData";
import { formatDocument, lienPrincipal } from "../../../lib/resourceLink";
import { SearchCardProps } from "../../../schema";

/**
 * Design « document » de la card resource — une LIGNE compacte qui ouvre directement le fichier ou
 * le lien, sans passer par une fiche de détail.
 *
 * Pour quoi : une archive de publications (numéros d'une lettre d'information, comptes rendus…)
 * dont chaque entrée n'est qu'un titre et un fichier. Le design `card` y mettrait une grande
 * couverture typée par entrée — 56 couvertures identiques pour 56 numéros, qui noieraient les titres.
 *
 * Le document hébergé passe avant le lien externe (cf. `lienPrincipal`). Sans l'un ni l'autre, la
 * ligne retombe sur le clic de détail plutôt que d'offrir un lien mort.
 */
export default function CardResourceDocument({ item, onClick, list }: SearchCardProps) {
  const t = useT("modules/search");
  const data = useResourceData(item, list?.resource);
  const lien = lienPrincipal(data);
  const Icone = lien?.nature === "lien" ? ExternalLink : FileText;
  const nature = !lien ? "" : lien.nature === "lien" ? t("resource.externalLink") : formatDocument(lien) ?? t("resource.document");

  const contenu = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug text-foreground group-hover:underline">{data.title}</span>
        {lien && <span className="block text-xs text-muted-foreground">{nature}</span>}
      </span>
    </>
  );

  const classe =
    "group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (!lien) {
    return (
      <button type="button" onClick={onClick} className={classe}>
        {contenu}
      </button>
    );
  }

  return (
    // Nouvel onglet : on quitte la page d'archive pour un PDF ou un site tiers, et le visiteur doit
    // pouvoir y revenir sans perdre sa position dans la liste des années.
    <a href={lien.href} target="_blank" rel="noopener noreferrer" className={classe}>
      {contenu}
      <span className="sr-only">({t("resource.newTab")})</span>
    </a>
  );
}
