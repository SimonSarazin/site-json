/**
 * Lecture des DEEP-LINKS EN FRAGMENT (`#…`) des e-mails legacy.
 *
 * Beaucoup de templates d'e-mail du legacy pointent vers `<base>/#page.type.<collection>.id.<id>`
 * (`confirmYouTo`, `referenceEmailInElement`, `inviteYouTo`, `milestoneProgression`, `askToBecome`,
 * `bookmarkNotif`, `passwordRetreive`, `notification`…). Le fragment n'est **jamais envoyé au
 * serveur** : quand le domaine d'un costum pointe sur site-json, ces liens atterrissent donc sur
 * l'ACCUEIL, sans erreur mais sans jamais montrer l'élément visé (cf. `cocolight-backend/docs/24`,
 * AXE 2 — « dette hash »).
 *
 * Ces e-mails sont **déjà partis** et le legacy continuera d'en émettre : on ne peut pas les
 * changer. Le seul rattrapage possible est **côté client**, en lisant le fragment au montage —
 * c'est l'étage A du design de `docs/23`.
 *
 * Ce module ne fait QUE l'analyse (fonction pure, testable) ; la résolution id→slug et la
 * navigation sont dans `useLegacyHashRedirect`.
 *
 * ⚠️ Tout fragment non reconnu est ignoré (`null`) : les ancres normales (`#section`) et les hash
 * applicatifs des costums encore servis par le legacy ne doivent JAMAIS être détournés.
 */

/** Collections routables vers une fiche `/profil/:slug`. */
const COLLECTIONS = new Set(['organizations', 'projects', 'events', 'poi', 'citoyens']);

export type LegacyHashTarget =
  /** `#page.type.<collection>.id.<id>[.view.<vue>…]` — nécessite une résolution id → slug. */
  | { kind: 'element'; type: string; id: string; view: string | null }
  /** `#@<slug>` — le slug est déjà là, aucune résolution nécessaire. */
  | { kind: 'slug'; slug: string }
  /**
   * `#settings.redirect` — le lien « ici » du PIED DE PAGE de TOUS les e-mails legacy
   * (`themes/CO2/views/layouts/mail/footer.php:87`, « pour ne plus recevoir ces e-mails, cliquez ici »),
   * qui ouvre les réglages du compte CONNECTÉ. Aucun id : la cible est « moi ».
   */
  | { kind: 'settings' };

/**
 * Analyse un fragment d'URL legacy.
 *
 * @param hash - le fragment, avec ou sans `#` (ex. `window.location.hash`).
 * @returns la cible reconnue, ou `null` si le fragment ne nous concerne pas.
 */
export function parseLegacyHash(hash: string | null | undefined): LegacyHashTarget | null {
  if (!hash) return null;
  const brut = hash.replace(/^#/, '');
  // ⚠️ `decodeURIComponent` LÈVE (`URIError: URI malformed`) sur un `%` isolé ou une séquence
  // d'échappement incomplète — et une ancre parfaitement légitime peut en contenir (`#100%`,
  // `#soldes-50%`, `#caf%E9`). Comme ce parseur est appelé depuis un effet monté à la racine
  // (`SiteShell`), une exception ferait tomber l'ErrorBoundary de `RootLayout` et remplacerait
  // TOUT le site par un écran d'erreur — pour une simple ancre. On retombe donc sur la chaîne
  // brute, qui reste analysable (aucun fragment legacy réel ne contient de `%`).
  let raw: string;
  try { raw = decodeURIComponent(brut); } catch { raw = brut; }
  raw = raw.trim();
  if (!raw) return null;

  // `#settings.redirect` — réglages du compte connecté (pied de page de chaque e-mail legacy).
  if (/^settings\.redirect(?:[./?#].*)?$/.test(raw)) return { kind: 'settings' };

  // `#@slug` — profil par slug (le legacy l'émet dans quelques templates ; site-json n'a pas de
  // route `/@slug`, mais `/profil/:slug` fait le même travail).
  if (raw.startsWith('@')) {
    const slug = raw.slice(1).split(/[./?#]/)[0];
    return /^[a-zA-Z0-9_-]+$/.test(slug) ? { kind: 'slug', slug } : null;
  }

  // `page.type.<collection>.id.<id>` + suffixe de vue optionnel (`.view.settings`,
  // `.view.directory.dir.<dir>`…). Les segments sont séparés par des points, l'id est un ObjectId.
  const m = /^page\.type\.([a-zA-Z]+)\.id\.([a-f0-9]{24})(?:\.(.*))?$/.exec(raw);
  if (m) {
    const [, type, id, rest] = m;
    if (!COLLECTIONS.has(type)) return null; // type inconnu (cms, classifieds…) → on ne détourne pas
    // `view.<vue>` : on ne garde que le NOM de la vue (`settings`, `directory`…), les paramètres
    // qui suivent (`dir.<x>`) n'ont pas d'équivalent site-json.
    const view = rest ? (/^view\.([a-zA-Z]+)/.exec(rest)?.[1] ?? null) : null;
    return { kind: 'element', type, id, view };
  }

  return null;
}
