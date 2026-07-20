/**
 * Module du costum « parents62 » (Réseau Parentalité 62) : clés de code
 * référencées par le costumForm `parents62-parole` (config
 * config.prod.parents62.json). Le scope réutilise la clé GÉNÉRIQUE `poi:scope`
 * (equipements-sportifs/fns.ts) avec `defaults.poiType:"affiche"`, et le
 * payload passe par le PIPELINE générique (pas de payloadFn — il remplacerait
 * la recomposition adresse/groupes) : la logique métier vit dans des
 * TRANSFORMS nommés par champ (read = pré-remplissage édition depuis
 * `tags`/`medias`, write = fusion des sélections dans `tags` et construction
 * de `medias` audio). Dérivation commune → territoire via le référentiel
 * `territoires62` (no-op tant que ses `communes` sont vides — T0.5).
 */
import {
  TERRITOIRE_TAG_PREFIX,
  findTerritoireByCommune,
  territoireTag,
} from "@/data/territoires62";
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import "../sharedFns"; // side-effect : clés communes (image:profilUrl, cleanValues/invalidate génériques)

type Values = Record<string, unknown>;

/** Préfixes de tags GÉRÉS par le formulaire (remplacés par la sélection à l'édition). */
const MANAGED_PREFIXES = [TERRITOIRE_TAG_PREFIX, "public:", "age:"];

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0)
  : typeof v === "string" && v.length > 0 ? [v]
  : [];

/** Tags d'un préfixe donné (pré-remplissage des multiselects public/âges). */
export function extractByPrefix(tags: unknown, prefix: string): string[] {
  return asArray(tags).filter((t) => t.startsWith(prefix));
}

/** Premier tag territoire (le select territoire est mono-valeur). */
export function extractTerritoire(tags: unknown): string {
  return extractByPrefix(tags, TERRITOIRE_TAG_PREFIX)[0] ?? "";
}

/** Tags LIBRES (thèmes) = tout ce qui n'est pas géré par un namespace du form. */
export function extractThemes(tags: unknown): string[] {
  return asArray(tags).filter((t) => !MANAGED_PREFIXES.some((p) => t.startsWith(p)));
}

/** URL du premier média audio (pré-remplissage du champ URL en édition). */
export function extractAudioUrl(medias: unknown): string {
  if (!Array.isArray(medias)) return "";
  const audio = medias.find(
    (m) => m && typeof m === "object" && (m as Values).type === "audio" && typeof (m as Values).url === "string",
  );
  return audio ? String((audio as Values).url) : "";
}

/**
 * Fusion dédupliquée des sélections du form dans `tags` : thèmes libres +
 * territoire (choisi, sinon dérivé de la commune) + public + âges. Les tags
 * gérés existants ont été décomposés au READ dans leurs champs respectifs →
 * la sélection courante fait foi (retirer une coche retire le tag).
 */
export function mergeParoleTags(values: Values): string[] {
  const territoires = asArray(values.paroleTerritoire);
  if (territoires.length === 0) {
    const derived = findTerritoireByCommune({
      postalCode: typeof values.postalCode === "string" ? values.postalCode : null,
      codeInsee: typeof values.codeInsee === "string" ? values.codeInsee : null,
    });
    if (derived) territoires.push(territoireTag(derived.slug));
  }
  return Array.from(
    new Set([
      ...extractThemes(values.paroleThemes ?? []),
      ...territoires,
      ...asArray(values.parolePublic),
      ...asArray(values.paroleAges),
    ]),
  );
}

/** `medias` du POI parole : URL saisie → `[{type:"audio",url}]` ; vide → `[]` (clear en édition). */
export function paroleMedias(values: Values): Array<{ type: string; url: string }> {
  const url = typeof values.paroleAudioUrl === "string" ? values.paroleAudioUrl.trim() : "";
  return url ? [{ type: "audio", url }] : [];
}

// ── Enregistrement des transforms référencés par le costumForm (config) ──────
// READ (édition) : décompose `tags`/`medias` serveur vers les champs UI.
registerTransform("parents62:territoireRead", (_v, all) => extractTerritoire(all.tags));
registerTransform("parents62:publicRead", (_v, all) => extractByPrefix(all.tags, "public:"));
registerTransform("parents62:agesRead", (_v, all) => extractByPrefix(all.tags, "age:"));
registerTransform("parents62:themesRead", (_v, all) => extractThemes(all.tags));
registerTransform("parents62:audioUrlRead", (_v, all) => extractAudioUrl(all.medias));
// WRITE : les champs UI sont OMIS du payload (fusionnés par tags/medias ci-dessous).
registerTransform("parents62:omit", () => undefined);
registerTransform("parents62:tagsWrite", (_v, all) => mergeParoleTags(all));
registerTransform("parents62:mediasWrite", (_v, all) => paroleMedias(all));
