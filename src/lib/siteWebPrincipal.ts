/**
 * Site web d'une fiche (`serverData`), pour l'affichage et le pré-remplissage d'édition.
 *
 * `link` passe en premier : c'est la clé qu'écrivent les formulaires structure SSBE et Ekilib.re,
 * comme le formulaire legacy de ssbe.re (vérifié le 24/09 sur une fiche créée par l'ancien site :
 * `link` seul, valeur telle que saisie), donc la valeur la plus récente quand les deux coexistent.
 * Repli sur `url`, où vit le site web de la plupart des fiches anciennes (43 fiches SSBE sur 148 en
 * prod n'ont que `url`, mesuré le 24/09).
 * La valeur est rendue telle quelle (sans protocole ajouté) : c'est ce que le formulaire doit relire.
 */
export function siteWebPrincipal(sd: Record<string, unknown> | null | undefined): string | undefined {
  for (const cle of ["link", "url"] as const) {
    const v = sd?.[cle];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}
