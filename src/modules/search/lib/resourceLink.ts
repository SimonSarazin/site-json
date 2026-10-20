import type { ResourceData } from "../hooks/useResourceData";

/** Ce qu'ouvre une ressource présentée en ligne compacte (design `document`). */
export interface LienPrincipal {
  href: string;
  /** `document` : fichier hébergé sur la plateforme ; `lien` : page ou fichier publié ailleurs. */
  nature: "document" | "lien";
  /** Extension en minuscules pour un document (`pdf`…), chaîne vide sinon. */
  ext: string;
}

/**
 * Le lien qu'ouvre la ligne : le DOCUMENT hébergé d'abord, le lien externe ensuite.
 *
 * Pourquoi le document gagne : un fichier hébergé sur la plateforme survit à la disparition du site
 * d'origine, un lien externe non. Une fiche qui porte les deux — cas d'un numéro dont le PDF a été
 * ré-hébergé après coup — doit donc ouvrir la copie durable.
 *
 * `null` quand la fiche ne porte ni l'un ni l'autre : la ligne retombe alors sur le clic de détail
 * plutôt que d'afficher un lien mort.
 */
export function lienPrincipal(data: Pick<ResourceData, "documents" | "urls">): LienPrincipal | null {
  const doc = data.documents.find((d) => typeof d.url === "string" && d.url.trim() !== "");
  if (doc) return { href: doc.url, nature: "document", ext: doc.ext };
  const url = data.urls.find((u) => typeof u === "string" && u.trim() !== "");
  if (url) return { href: url, nature: "lien", ext: "" };
  return null;
}

/**
 * Format affiché pour un document : son extension en capitales (`PDF`, `DOCX`…), `null` si inconnue.
 * L'extension et non un libellé fixe : une archive peut mêler PDF et documents bureautiques, et annoncer
 * « PDF » sur un `.docx` tromperait sur ce que le clic télécharge.
 */
export function formatDocument(lien: LienPrincipal): string | null {
  return lien.nature === "document" && lien.ext ? lien.ext.toUpperCase() : null;
}
