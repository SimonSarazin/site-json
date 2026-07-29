/**
 * Conf de liste EFFECTIVE d'un item — cœur du rendu par item des listes HÉTÉROGÈNES.
 *
 * Principe : on ne rajoute pas de prop au pipeline, on fait VARIER LA VALEUR de `list`. Tout l'aval
 * (`SearchCard`, `Preview`, `SwitchDetailsMode`, `Card/PreviewTestimonial`, `Card/PreviewResource`)
 * continue de lire `list.card` / `list.preview` / `list.testimonial` / `list.resource` sans savoir
 * qu'une règle est passée par là. Carte et détail reçoivent donc forcément la MÊME tranche —
 * l'incohérence est impossible par construction.
 *
 * Sans `itemRules`, la fonction renvoie `list` LUI-MÊME (identité référentielle) : non-régression
 * prouvable (`expect(...).toBe(list)`) et mémoïsation aval préservée.
 *
 * Fonction PURE (ni `window`, ni `Date`, ni `Math.random`) → même résultat au SSR et à l'hydratation.
 */
import { entityMatchData, firstMatching } from "@/lib/entityMatch";
import type { ListConf, ListItemRule, SearchListEntity } from "../schema";

/** Clés d'une règle qui produisent réellement une surcharge. */
function hasOverride(rule: ListItemRule): boolean {
  return Boolean(rule.card || rule.preview || rule.testimonial || rule.resource || rule.itemAction);
}

/**
 * `card`/`preview` sont FUSIONNÉS (shallow) sur la base : `tagColors`, `detailsMode`, `width`… posés
 * une fois au niveau page n'ont pas à être répétés dans chaque règle.
 * `testimonial`/`resource`/`itemAction` REMPLACENT : fusionner deux contrats de mapping produirait
 * silencieusement un contrat Frankenstein (`quoteField` de l'un + `badge` de l'autre), indébuggable.
 */
function applyRule(list: ListConf, rule: ListItemRule): ListConf {
  if (!hasOverride(rule)) return list;
  const next: ListConf = { ...list };
  if (rule.card) next.card = { ...list.card, ...rule.card };
  if (rule.preview) next.preview = { ...list.preview, ...rule.preview };
  if (rule.testimonial) next.testimonial = rule.testimonial;
  if (rule.resource) next.resource = rule.resource;
  if (rule.itemAction) next.itemAction = rule.itemAction;
  return next;
}

/** Champs racine référencés par un prédicat (pour le diagnostic DEV). */
function collectFields(pred: unknown, out: Set<string> = new Set()): Set<string> {
  if (!pred || typeof pred !== "object") return out;
  const p = pred as Record<string, unknown>;
  if (typeof p.field === "string") out.add(p.field.split(".")[0]);
  for (const branch of [p.and, p.or]) {
    if (Array.isArray(branch)) branch.forEach((b) => collectFields(b, out));
  }
  if (p.not) collectFields(p.not, out);
  return out;
}

/**
 * Diagnostic DEV, une seule fois par jeu de règles : aucune règle n'a matché alors que `itemRules`
 * est déclaré. Cause n°1 : un champ testé n'est pas PROJETÉ (`baseParams.defaultFields`) — la config
 * n'étant jamais parsée par Zod au runtime, rien ne le signale autrement.
 */
const warned = new WeakSet<object>();
function warnNoMatch(rules: ListItemRule[], item: unknown): void {
  if (!import.meta.env.DEV || warned.has(rules)) return;
  warned.add(rules);
  const serverData = ((item as { serverData?: Record<string, unknown> } | undefined)?.serverData ??
    {}) as Record<string, unknown>;
  const referenced = new Set<string>();
  rules.forEach((r) => collectFields(r.when, referenced));
  const missing = [...referenced].filter(
    (f) => !["collection", "sourceKey", "sourceKeys"].includes(f) && !(f in serverData),
  );
  console.warn(
    "[search] itemRules : aucune règle ne matche." +
      (missing.length
        ? ` Champs testés absents de serverData (à ajouter à baseParams.defaultFields) : ${missing.join(", ")}.`
        : " Vérifiez les valeurs attendues par les prédicats."),
  );
}

/** Conf de liste effective d'UN item. Cf. en-tête du fichier pour les invariants. */
export function resolveListItemConf(
  item: SearchListEntity | undefined,
  list: ListConf | undefined,
): ListConf | undefined {
  const rules = list?.itemRules;
  if (!list || !rules?.length || !item) return list;
  const rule = firstMatching(rules, entityMatchData(item), (err, r) =>
    console.warn(`[search] itemRule invalide, ignorée (${r.id ?? "sans id"}) :`, err),
  );
  if (!rule) {
    warnNoMatch(rules, item);
    return list;
  }
  return applyRule(list, rule);
}

/** Variante batch (une résolution par item). Sans `itemRules` : `list` répété, coût nul. */
export function resolveListItemConfs(
  results: readonly SearchListEntity[],
  list: ListConf | undefined,
): (ListConf | undefined)[] {
  if (!list?.itemRules?.length) return results.map(() => list);
  return results.map((item) => resolveListItemConf(item, list));
}
