/**
 * Module du costum « parent62 » (Réseau Parentalité 62) : clés de code
 * référencées par le costumForm `parent62-parole` (config
 * `config.prod.parent62.json`).
 *
 * La taxonomie transverse (`territoires` / `publics` / `themes`) vit dans des
 * CHAMPS NATIFS du POI — mêmes noms sur tous les dynForms du costum, valeurs
 * issues de `costum.lists` (cf. doc/33-projet-parent62.md). Elle ne demande donc
 * AUCUN transform : le pipeline générique lit et écrit ces champs tels quels.
 * (C'est la différence avec l'ancien module `parents62`, qui encodait la même
 * information dans des tags namespacés `territoire62:`/`public:`/`age:`.)
 *
 * Reste ici la seule logique non générique de la Parole : l'audio, saisi comme
 * une URL dans le formulaire et stocké dans le champ natif `medias`.
 * Le scope réutilise la clé GÉNÉRIQUE `poi:scope` (equipements-sportifs/fns.ts)
 * avec `defaults.poiType:"affiche"` ; pas de `payloadFn` (il remplacerait la
 * recomposition adresse/groupes du pipeline générique).
 */
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import "../sharedFns"; // side-effect : clés communes (image:profilUrl, cleanValues/invalidate génériques)

type Values = Record<string, unknown>;

/** URL du premier média audio (pré-remplissage du champ URL en édition). */
export function extractAudioUrl(medias: unknown): string {
  if (!Array.isArray(medias)) return "";
  const audio = medias.find(
    (m) =>
      m &&
      typeof m === "object" &&
      (m as Values).type === "audio" &&
      typeof (m as Values).url === "string",
  );
  return audio ? String((audio as Values).url) : "";
}

/** `medias` du POI parole : URL saisie → `[{type:"audio",url}]` ; vide → `[]` (clear en édition). */
export function paroleMedias(values: Values): Array<{ type: string; url: string }> {
  const url = typeof values.paroleAudioUrl === "string" ? values.paroleAudioUrl.trim() : "";
  return url ? [{ type: "audio", url }] : [];
}

// ── Enregistrement des transforms référencés par le costumForm (config) ──────
// READ (édition) : `medias` serveur → champ URL de l'UI.
registerTransform("parent62:audioUrlRead", (_v, all) => extractAudioUrl(all.medias));
// WRITE : le champ URL est OMIS du payload (il alimente `medias` ci-dessous).
registerTransform("parent62:omit", () => undefined);
registerTransform("parent62:mediasWrite", (_v, all) => paroleMedias(all));
