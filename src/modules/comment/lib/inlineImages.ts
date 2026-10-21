/**
 * Les images écrites DANS le texte d'un message (`![description](adresse)`) — d'où elles viennent, et
 * comment le fil les montre.
 *
 * Décision de l'user (14/10/2026) : une image importée sur la plateforme s'affiche directement ; une
 * image à une adresse TIERCE attend un clic du lecteur. L'afficher d'office ferait contacter ce tiers
 * par le navigateur de chaque lecteur — adresse IP, heure, navigateur : un « pixel espion » que
 * l'auteur du message choisirait pour eux. Au clic, c'est le lecteur qui choisit.
 *
 * Pur : ni DOM, ni React — le fil (`CommentMarkdown`) et l'éditeur (`EditorSurface`) s'en servent.
 */

/** Où mène l'adresse d'une image. */
export type ImageSource =
  /** Servie par la plateforme — le serveur, où vivent les fichiers téléversés : affichée d'office. */
  | { readonly kind: "platform"; readonly url: string }
  /** Ailleurs, en `http(s)` : affichée au clic du lecteur. `host` le nomme dans le bouton. */
  | { readonly kind: "remote"; readonly url: string; readonly host: string }
  /** Ni l'un ni l'autre (`data:`, `javascript:`, adresse vide ou illisible) : jamais affichée. */
  | { readonly kind: "refused" };

/**
 * D'où vient l'image à cette adresse ?
 *
 * La plateforme, c'est le serveur (`backendBase`, soit `VITE_BASE_URL_BACKEND`) : les fichiers
 * téléversés y sont servis sous `/upload/…`, et le SDK rend leur chemin RELATIF (`docPath`). Un
 * chemin relatif se lit donc contre le serveur — comme dans le legacy, servi depuis lui : un
 * `![…](/upload/…)` écrit là-bas s'affiche aussi ici. Seule l'ORIGINE compte : un autre chemin du
 * même serveur ne fait connaître le lecteur à personne de plus.
 */
export function classifyImageSource(src: string, backendBase: string): ImageSource {
  const adresse = src.trim();
  if (!adresse) return { kind: "refused" };
  let base: URL;
  let url: URL;
  try {
    base = new URL(backendBase);
    url = new URL(adresse, base);
  } catch {
    return { kind: "refused" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "refused" };
  if (url.origin === base.origin) return { kind: "platform", url: url.href };
  return { kind: "remote", url: url.href, host: url.hostname };
}

/**
 * L'adresse à ÉCRIRE dans le texte pour un fichier de la plateforme : son chemin, sans l'origine du
 * serveur. Le SDK rend l'adresse d'un fichier téléversé ABSOLUE (sa normalisation de lecture —
 * mesuré au navigateur le 14/10) ; écrite telle quelle, elle attacherait le message au serveur d'un
 * environnement, quand le legacy, servi par ce serveur, écrit le chemin seul. Une adresse d'ailleurs
 * reste entière.
 */
export function writtenImageAddress(src: string, backendBase: string): string {
  const source = classifyImageSource(src, backendBase);
  if (source.kind !== "platform") return src;
  const url = new URL(source.url);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Une image tierce du message, dans l'ordre du texte. */
export interface RemoteImage {
  readonly url: string;
  readonly host: string;
  readonly alt: string;
  /**
   * Prise dans un lien (`[![…](…)](…)`) : elle n'a pas de bouton — un bouton dans un lien n'est pas
   * du HTML valide, et le clic y suit le lien. Sa description s'affiche à la place, ou le nom du site.
   */
  readonly inLink: boolean;
}

const OUVRE = "\uE000";
const FERME = "\uE001";
const SIGNES = /[\uE000\uE001]/g;

/**
 * Le jeton d'UN rendu : tiré au hasard, il entre dans chaque marque de ce rendu (`remoteImageMark`).
 *
 * Retirer les deux signes du texte (`stripRemoteMarks`) ne suffit pas : `markdown-it` DÉCODE les
 * entités numériques même sans HTML (`&#xE000;` → U+E000), dans le texte comme dans le titre d'un lien
 * ou la description d'une image. Une marque ainsi écrite par l'auteur, au milieu d'un ATTRIBUT,
 * recevrait le balisage de `placeRemoteImages` — posé, lui, après le nettoyage. L'auteur ne connaît
 * pas le jeton du rendu : sa marque ne correspond à rien, et ses signes sont retirés à la fin.
 */
export function newMarkNonce(): string {
  const octets = new Uint8Array(12);
  globalThis.crypto.getRandomValues(octets);
  return Array.from(octets, octet => octet.toString(16).padStart(2, "0")).join("");
}

/**
 * La marque que le rendu laisse à la place de la n-ième image tierce, pour `placeRemoteImages`.
 *
 * Deux caractères d'usage privé autour du jeton du rendu et d'un numéro : le profil de nettoyage
 * (`sanitizeProse`) les garde tels quels, quand il retire tout bouton et tout attribut `data-*` posé
 * avant lui.
 */
export function remoteImageMark(index: number, nonce: string): string {
  return `${OUVRE}${nonce}:${index}${FERME}`;
}

/** Retire les signes des marques : du texte d'un message avant le rendu, et du HTML à la fin. */
export function stripRemoteMarks(text: string): string {
  return text.replace(SIGNES, "");
}

const ENTITES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function echappe(texte: string): string {
  return texte.replace(/[&<>"']/g, signe => ENTITES[signe] ?? signe);
}

/**
 * Remplace, dans le HTML DÉJÀ nettoyé, chaque marque DE CE RENDU (`nonce`) par ce que le lecteur doit
 * voir — puis retire les signes qui restent : ceux d'une marque que l'auteur aurait fabriquée.
 *
 * - **pas encore ouverte** : un bouton « Afficher l'image de exemple.org » (`label`), l'adresse
 *   entière en infobulle — le lecteur sait où mène son clic ;
 * - **ouverte** (`shown`) : l'image, sans `Referer` (le tiers n'apprend pas quelle page la montre) et
 *   focalisable par le code (`tabindex="-1"`) : le focus y passe quand son bouton disparaît ;
 * - **dans un lien** : sa description, ou à défaut le nom du site — « Afficher l'image » y mentirait,
 *   le clic suivant le lien.
 *
 * **Après** le nettoyage, comme `markSelfMentions` : le profil retire boutons et `data-*`. Le balisage
 * posé ici est FIXE ; ce qui vient du texte (adresse, description, nom du site) y entre échappé, et
 * l'adresse a déjà passé `classifyImageSource` — `http(s)` seulement.
 */
export function placeRemoteImages(
  html: string,
  images: readonly RemoteImage[],
  shown: ReadonlySet<number>,
  label: (image: RemoteImage) => string,
  nonce: string,
): string {
  // Le jeton n'est fait que de chiffres hexadécimaux : rien à échapper dans l'expression.
  const marque = new RegExp(`${OUVRE}${nonce}:(\\d+)${FERME}`, "g");
  return stripRemoteMarks(html.replace(marque, (_marque, rang: string) => {
    const index = Number(rang);
    const image = images[index];
    if (!image) return "";
    if (image.inLink) return echappe(image.alt.trim() || image.host);
    if (shown.has(index)) {
      return `<img src="${echappe(image.url)}" alt="${echappe(image.alt)}" loading="lazy" referrerpolicy="no-referrer" tabindex="-1" data-remote-image-shown="${index}">`;
    }
    return `<button type="button" data-remote-image="${index}" title="${echappe(image.url)}">${echappe(label(image))}</button>`;
  }));
}

/** Le jeton d'image est-il dans un lien ? Les jetons en ligne d'un bloc se suivent : on compte les ouvertures restées sans fermeture. */
export function isInsideLink(tokens: readonly { readonly type: string }[], index: number): boolean {
  let profondeur = 0;
  for (let i = 0; i < index; i += 1) {
    const type = tokens[i]?.type;
    if (type === "link_open") profondeur += 1;
    else if (type === "link_close") profondeur -= 1;
  }
  return profondeur > 0;
}
