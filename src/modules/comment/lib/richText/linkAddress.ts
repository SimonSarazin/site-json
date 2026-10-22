/**
 * L'adresse qu'on tape dans le champ « lien » → celle qu'on enregistre, ou `null` si elle ne mène
 * nulle part.
 *
 * On écrit rarement le protocole : `exemple.org` devient `https://exemple.org`, une adresse de
 * courriel un `mailto:`. Seuls `http`, `https` et `mailto` passent — ce que le fil sait rendre en
 * lien sans surprise ; `javascript:` et consorts ne sont pas des adresses.
 */
export function normalizeLinkAddress(saisie: string): string | null {
  const texte = saisie.trim();
  if (texte === "" || /\s/.test(texte)) return null;

  const protocole = /^([a-z][a-z0-9+.-]*):/i.exec(texte)?.[1]?.toLowerCase() ?? null;
  // `exemple.org:8080` n'est pas un protocole : seuls les trois connus comptent comme tels.
  const connu = protocole === "http" || protocole === "https" || protocole === "mailto";
  if (protocole !== null && !connu && !/^[^/:]+:\d+(\/|$)/.test(texte)) return null;

  const candidate = connu
    ? texte
    : /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(texte) ? `mailto:${texte}` : `https://${texte}`;
  try {
    const url = new URL(candidate);
    if (url.protocol === "mailto:") return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(candidate) ? candidate : null;
    // Un hôte sans point (« bonjour ») n'est pas une adresse qu'on a voulu écrire.
    return url.hostname.includes(".") || url.hostname === "localhost" ? candidate : null;
  } catch {
    return null;
  }
}
