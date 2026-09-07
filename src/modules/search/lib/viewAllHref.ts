/**
 * Lien « voir tous » d'un `customHeader` : destination de config + filtres actifs de la page.
 *
 * Le `linkHref` de config PORTE SOUVENT DÉJÀ une query — c'est ainsi qu'on scope la page cible
 * (`/ressources?territoire=arrageois` sur une page de territoire). D'où la fusion plutôt qu'une
 * concaténation `${base}?${params}` : celle-ci donne une URL à DEUX `?` (`…?territoire=X?theme=Y`)
 * dès qu'un filtre est actif sur la page de départ, et tout ce qui suit le second `?` devient une
 * valeur — le scope de destination, raison d'être du lien, est alors perdu.
 *
 * En cas de clé présente des deux côtés, la config GAGNE : elle définit le périmètre de la page
 * cible, le filtre de la page de départ ne doit pas le déborder.
 */
export function buildViewAllHref(
  linkHref: string,
  currentParams: URLSearchParams,
  searchQuery?: string,
): string {
  const [path, queryDeConfig = ""] = linkHref.split("?");
  const params = new URLSearchParams(currentParams);
  if (searchQuery) params.set("search", searchQuery);

  const scope = new URLSearchParams(queryDeConfig);
  for (const [cle, valeur] of scope) params.set(cle, valeur);

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
