/**
 * `addToLinks` — une question finder qui alimente un LIEN de la réponse (fonctions PURES).
 *
 * Parité legacy (`survey/views/tpls/forms/cplx/finder.php` : ajout dans `saveElementFinder<kunik>`,
 * retrait dans `finder.removeFromForm<kunik>`) : quand
 * `params.finder<clé>.addToLinks = { value: true, links: "<lien>" }`, chaque
 * élément AJOUTÉ à la question entre dans `links.<lien>.<id> = { name, type }`, chaque élément
 * RETIRÉ en sort. Cas d'usage : la question « Référent du commun » d'un appel à communs alimente
 * `links.canEdit`, la liste des contributeurs à l'édition.
 *
 * C'est un lien SUPPLÉMENTAIRE : le lien par type d'élément (`extractFinderLinks`,
 * `links.<type>.<id>`) n'est pas touché.
 *
 * Le legacy écrit à chaque clic ; React enregistre en une fois. La synchronisation se fait donc
 * par DIFFÉRENCE entre la valeur serveur de la question et la valeur soumise — jamais par
 * remplacement : une personne présente dans le lien sans l'être dans la question (ajoutée depuis
 * la fiche, ou données antérieures divergentes) n'en sort pas en silence.
 */
import { isTruthyFlag } from "./formParser";
import { withRelativeImageUrls } from "./toRelativeImageUrl";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};

/** Un identifiant Mongo — seule forme de clé qu'un lien de réponse accepte. */
const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Nom de lien écrivable dans un chemin `links.<lien>` : ni point ni `$`, qui ouvriraient un
 * autre chemin Mongo. La config vient d'un admin, mais elle part telle quelle dans une écriture.
 */
const LINK_KEY = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Liens qu'aucun finder n'alimente : `answered` est la liste des contributeurs que le backend
 * tient lui-même (`SaveAnswerAction`) — un TABLEAU d'identifiants, qu'une carte
 * `{ <id>: { name, type } }` écraserait.
 */
const RESERVED_LINKS: ReadonlySet<string> = new Set(["answered"]);

/** Une question finder qui alimente un lien de la réponse. */
export interface AddToLinksField {
  /**
   * Clé de stockage de la question : `finder<clé d'input>`. C'est À LA FOIS la clé de sa config
   * dans `form.params` et sa clé dans `answers.<étape>`.
   */
  fieldName: string;
  /** Le lien alimenté : `links.<linkKey>`. */
  linkKey: string;
}

/** Une entrée de lien, telle qu'elle est stockée. Les clés inconnues sont conservées. */
export type LinkEntry = Record<string, unknown>;

/** Les liens à écrire, par nom de lien — chaque carte est COMPLÈTE. */
export type AddToLinksPatch = Record<string, Record<string, LinkEntry>>;

/**
 * Les questions finder qui déclarent `addToLinks` dans `form.params`.
 *
 * `value` suit `isTruthyFlag` (booléen ou chaîne, comme tous les drapeaux du parc) ; un nom de
 * lien vide, non écrivable ou réservé (`answered`) écarte la question.
 */
export function collectAddToLinksFields(params: unknown): AddToLinksField[] {
  const fields: AddToLinksField[] = [];
  for (const [key, raw] of Object.entries(rec(params))) {
    if (!key.startsWith("finder")) continue;
    const addToLinks = rec(rec(raw).addToLinks);
    if (!isTruthyFlag(addToLinks.value)) continue;
    const linkKey = typeof addToLinks.links === "string" ? addToLinks.links.trim() : "";
    if (!LINK_KEY.test(linkKey) || RESERVED_LINKS.has(linkKey)) continue;
    fields.push({ fieldName: key, linkKey });
  }
  return fields;
}

/**
 * La valeur d'une question dans `{ <étape>: { <champ>: valeur } }`, où qu'elle soit rangée.
 * `undefined` si aucune étape ne porte le champ — à distinguer d'une question VIDÉE (`null`).
 */
export function findFieldValue(answers: unknown, fieldName: string): unknown {
  for (const step of Object.values(rec(answers))) {
    const stepData = rec(step);
    if (Object.prototype.hasOwnProperty.call(stepData, fieldName)) return stepData[fieldName];
  }
  return undefined;
}

/**
 * Les éléments d'une valeur de finder `{ <id>: { id, name, type } }`, réduits à `{ name, type }`.
 * Tolère `null`, le tableau vide que PHP rend pour une liste vide, et les entrées dégénérées.
 */
export function finderElementsOf(value: unknown): Map<string, { name: string; type: string }> {
  const elements = new Map<string, { name: string; type: string }>();
  for (const [key, raw] of Object.entries(rec(value))) {
    const el = rec(raw);
    const id = typeof el.id === "string" && el.id ? el.id : key;
    if (!OBJECT_ID.test(id)) continue;
    elements.set(id, {
      name: typeof el.name === "string" ? el.name : "",
      type: typeof el.type === "string" ? el.type : "",
    });
  }
  return elements;
}

/**
 * Les entrées d'un lien, conservées (vignette legacy, drapeaux…) — à ceci près que leurs
 * vignettes, rendues absolues par la lecture SDK, redeviennent relatives comme en base.
 */
function linkEntriesOf(value: unknown): Record<string, LinkEntry> {
  const entries: Record<string, LinkEntry> = {};
  for (const [id, raw] of Object.entries(rec(value))) {
    if (!OBJECT_ID.test(id)) continue;
    entries[id] = withRelativeImageUrls(rec(raw));
  }
  return entries;
}

export interface AddToLinksInput {
  fields: readonly AddToLinksField[];
  /** Réponses SOUMISES, `{ <étape>: { <champ>: valeur } }`. */
  submitted: unknown;
  /** Réponses du serveur AVANT l'enregistrement (vides pour une création). */
  server: unknown;
  /** `links` du serveur avant l'enregistrement. */
  serverLinks: unknown;
}

/**
 * Les liens `addToLinks` à écrire.
 *
 * Chaque carte rendue est COMPLÈTE — le backend (`SaveAnswerAction`) remplace chaque type de lien
 * reçu — et seuls les liens qui CHANGENT sont rendus : une question inchangée, ou absente de la
 * soumission (étape masquée), ne réécrit rien.
 */
export function computeAddToLinksPatch({
  fields,
  submitted,
  server,
  serverLinks,
}: AddToLinksInput): AddToLinksPatch {
  const patch: AddToLinksPatch = {};
  for (const { fieldName, linkKey } of fields) {
    const soumise = findFieldValue(submitted, fieldName);
    if (soumise === undefined) continue;

    const avant = finderElementsOf(findFieldValue(server, fieldName));
    const apres = finderElementsOf(soumise);
    const ajouts = [...apres].filter(([id]) => !avant.has(id));
    const retraits = [...avant.keys()].filter((id) => !apres.has(id));
    if (ajouts.length === 0 && retraits.length === 0) continue;

    // Deux questions peuvent alimenter le même lien : la seconde part de l'état de la première.
    const lien = patch[linkKey] ?? linkEntriesOf(rec(serverLinks)[linkKey]);
    for (const [id, el] of ajouts) {
      if (!lien[id]) lien[id] = { name: el.name, type: el.type };
    }
    for (const id of retraits) delete lien[id];
    patch[linkKey] = lien;
  }
  return patch;
}
