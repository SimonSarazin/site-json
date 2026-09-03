/**
 * Nature d'un lien écrit en CONFIG — point de vérité unique du contrat 4 voies du parc.
 *
 * Trois surfaces rendent des liens venus du JSON et doivent les trancher de la MÊME façon :
 * `NavLink` (chrome : en-têtes et pieds de page), `CTASection` (boutons impératifs) et
 * `CardsSection` (cartes cliquables). Les deux dernières ne testaient que `#` et `http(s)` et
 * envoyaient tout le reste dans React Router : un `tel:` ou un `mailto:` de config partait en
 * `navigate()`, tombait sur le catch-all et rendait la PAGE D'ACCUEIL en 200 — sans erreur, donc
 * invisible en recette. Sur mobile, le tap-to-call ne se déclenchait jamais.
 *
 * Fonction PURE et SSR-safe : décision fondée sur la seule inspection de la chaîne (aucun hook,
 * aucun accès `window`), pour rester utilisable au rendu serveur comme dans un handler de clic.
 */
export type LinkKind =
  /** `#` ou vide → placeholder, jamais navigable. */
  | "inert"
  /** `#ancre` → défilement vers l'élément de la page courante. */
  | "anchor"
  /** `mailto:` / `tel:` / `sms:` → le handler de l'OS prend la main, jamais un nouvel onglet. */
  | "protocol"
  /** `http(s)://` ou `//` → nouvel onglet, `rel="noopener noreferrer"`. */
  | "external"
  /** Tout le reste → navigation SPA React Router. */
  | "internal";

/** Protocoles remis à l'OS (téléphone, e-mail, SMS) — jamais routés par React Router. */
const PROTOCOL_RE = /^(mailto:|tel:|sms:)/i;

export function classifyHref(href: string | null | undefined): LinkKind {
  if (!href || href === "#") return "inert";
  if (PROTOCOL_RE.test(href)) return "protocol";
  if (href.startsWith("#")) return "anchor";
  if (/^https?:\/\//i.test(href) || href.startsWith("//")) return "external";
  return "internal";
}

/** Raccourci de lisibilité pour les rendus qui n'ont besoin que de « ancre simple ? ». */
export function isProtocolHref(href: string | null | undefined): boolean {
  return classifyHref(href) === "protocol";
}
