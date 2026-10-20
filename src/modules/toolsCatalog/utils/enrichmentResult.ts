/**
 * Verdict d'un `BaseEntity.saveToolEnrichment()` — reconstitué, parce que la lib
 * ne le rend pas tel quel.
 *
 * ## Le problème
 *
 * `savecriteria` répond `{results, msg, data?, name?}`, `results` À LA RACINE. Mais
 * la méthode de la lib (`1.0.183` → `1.0.189` au moins) applique l'idiome de
 * déballage de ses endpoints voisins :
 *
 * ```ts
 * return (res?.data ?? res) as ToolEnrichmentResult;
 * ```
 *
 * Or ici `data` n'est PAS une enveloppe : c'est une clé MÉTIER — le document
 * `navigatorcriteria` effectivement écrit. La lib rend donc le document et perd
 * `results`, si bien qu'un `if (!res.results) throw` échoue sur un enregistrement
 * PARFAITEMENT réussi (HTTP 200, base à jour).
 *
 * ## Pourquoi on peut trancher sans la lib
 *
 * `data` et `results` ne sont pas indépendants côté serveur (`SaveCriteriaAction`) :
 *
 * | branche serveur                      | `results` | `data` |
 * |--------------------------------------|-----------|--------|
 * | admin refusé (HTTP 401)              | `false`   | absent |
 * | jeton invalide (HTTP 401)            | —         | absent |
 * | `name` vide (HTTP 200)               | `false`   | absent |
 * | insert / update / insert (HTTP 200)  | `true`    | **présent** |
 *
 * `data` n'est renseigné QUE par les trois branches de succès, et il y est toujours
 * non vide (`created`/`updated` au minimum). Les deux 401 ne parviennent jamais
 * jusqu'ici : axios rejette les 4xx et la promesse de la lib est rompue avant.
 *
 * Il ne reste donc que deux formes possibles en retour, et elles se distinguent :
 *  - un `results` booléen PRÉSENT  → c'est l'enveloppe, elle fait foi ;
 *  - un `results` ABSENT           → la lib a déballé un `data`, donc un succès.
 *
 * L'ordre compte : le `results` explicite prime TOUJOURS. Le jour où la lib cesse
 * de déballer, ce module continue de dire vrai sans être touché — et il n'a alors
 * plus qu'à disparaître.
 */
export interface EnrichmentVerdict {
  ok: boolean;
  /** `msg` serveur (FR en dur, hors i18n) — diagnostic uniquement, jamais affiché. */
  msg?: string;
}

export function readEnrichmentVerdict(res: unknown): EnrichmentVerdict {
  if (!res || typeof res !== "object") {
    // Ni enveloppe ni document : on ne peut RIEN affirmer, donc on n'affirme pas
    // le succès. Un `undefined` ici signalerait un contrat cassé, pas un save.
    return { ok: false };
  }

  const record = res as Record<string, unknown>;
  const msg = typeof record.msg === "string" ? record.msg : undefined;

  if (typeof record.results === "boolean") {
    return { ok: record.results, msg };
  }

  return { ok: true, msg };
}
