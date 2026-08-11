/**
 * MOTEUR des `mutation.stamps` — valeurs calculées déclaratives des forms costum (cf. `SpecStamp`,
 * entityModalSpec.ts). Module PUR (aucun React, aucun réseau) : la résolution `$scope` est faite
 * EAGER par `resolveModalSpec.buildSpec` (le scope y est vivant), le reste ($now/$from/littéral)
 * à la SOUMISSION par `runEntityMutation` — sur le payload (canal `payload`) ou après le save
 * (canal `pathValue`, via `entity.updateField`).
 *
 * Le cas fondateur : `dateSign` institutBleu — site-json tourne contre le backend LEGACY où ni le
 * JS afterSave legacy ni le hook Node ne tournent → le stamp client comble le trou, byte-fidèle
 * au format legacy (`j/m/aaaa` SANS zéro de tête, mesuré 73/73 en base).
 */
import type { SpecStamp } from "./entityModalSpec";

/**
 * Formate `date` selon un gabarit à JETONS français : `j` (jour sans zéro), `jj` (jour sur 2),
 * `M` (mois sans zéro), `MM` (mois sur 2), `aaaa` (année). Tout autre caractère est litéral.
 * `j/M/aaaa` reproduit EXACTEMENT le stamp legacy `${getDate()}/${getMonth()+1}/${getFullYear()}`
 * (institutBleu_index.js:621-624) : le 6 août 2026 → "6/8/2026", jamais "06/08/2026".
 */
export function formatNow(format: string, date: Date): string {
  const jour = date.getDate();
  const mois = date.getMonth() + 1;
  const annee = date.getFullYear();
  // Jetons longs d'abord (jj avant j, MM avant M) — un simple replace ordonné suffit à cette grammaire.
  return format
    .replace(/jj/g, String(jour).padStart(2, "0"))
    .replace(/j/g, String(jour))
    .replace(/MM/g, String(mois).padStart(2, "0"))
    .replace(/M/g, String(mois))
    .replace(/aaaa/g, String(annee));
}

/** La valeur est-elle « vide » au sens de `fillIfEmpty` ? (undefined/null/""/[] — pas 0 ni false.) */
export function estVide(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

function isSourceObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Résout les sources EAGER d'une liste de stamps — dans `buildSpec` (jumeau de
 * `resolveExtraFields`), car ni le scope ni le bloc costum n'existent plus au moment de la
 * mutation : `$scope` (scope résolu par la scopeFn) et `$costum` (bloc `config.costum` du site —
 * mainTag/compagnon, valeurs PAR DÉPLOIEMENT). Une clé absente donne `undefined` → le stamp sera
 * IGNORÉ à l'application (jamais d'écriture d'undefined). Les autres valeurs passent inchangées.
 */
export function resolveEagerStamps(
  stamps: SpecStamp[] | undefined,
  sources: { scope?: unknown; costum?: unknown },
): SpecStamp[] | undefined {
  if (!stamps?.length) return stamps;
  const sc = (sources.scope ?? {}) as Record<string, unknown>;
  const co = (sources.costum ?? {}) as Record<string, unknown>;
  return stamps.map((s) => {
    if (isSourceObj(s.value) && "$scope" in s.value) return { ...s, value: sc[(s.value as { $scope: string }).$scope] };
    if (isSourceObj(s.value) && "$costum" in s.value) return { ...s, value: co[(s.value as { $costum: string }).$costum] };
    return s;
  });
}

/** Les stamps ACTIFS pour ce mode (défaut `on: "add"`). */
export function stampsPourMode(stamps: SpecStamp[] | undefined, mode: "add" | "edit"): SpecStamp[] {
  return (stamps ?? []).filter((s) => (s.on ?? "add") === "both" || (s.on ?? "add") === mode);
}

/** Découpe une valeur de champ en tokens (tableau tel quel, ou chaîne découpée par `sep`). */
function tokens(v: unknown, sep?: string): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return (sep ? v.split(sep) : [v]).map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Évalue la VALEUR d'un stamp à la soumission ($now/$from/$mapLabels/$bucket/littéral — $scope déjà résolu). */
function evaluer(value: unknown, payload: Record<string, unknown>, maintenant: Date): unknown {
  if (isSourceObj(value)) {
    if ("$now" in value) return formatNow(String((value as { $now: unknown }).$now), maintenant);
    if ("$from" in value) return payload[String((value as { $from: unknown }).$from)];
    // $mapLabels : slugs du champ `from` → libellés via `map` (les slugs absents du map sont ignorés).
    if ("$mapLabels" in value) {
      const cfg = (value as { $mapLabels: { from: string; map: Record<string, string>; sep?: string } }).$mapLabels;
      const labels = tokens(payload[cfg.from], cfg.sep)
        .map((s) => cfg.map[s])
        .filter((l): l is string => typeof l === "string" && l !== "");
      return labels.length ? labels : undefined; // rien à ajouter → stamp inerte (jamais d'écriture d'undefined)
    }
    // $bucket : nombre du champ `from` → libellé du 1er bucket dont `lt` n'est pas dépassé (bucket sans `lt` = défaut).
    if ("$bucket" in value) {
      const cfg = (value as { $bucket: { from: string; buckets: { lt?: number; label: string }[] } }).$bucket;
      const raw = payload[cfg.from];
      const n = typeof raw === "number" ? raw : (typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN);
      if (!Number.isFinite(n)) return undefined; // pas de surface renseignée → pas de tag
      return cfg.buckets.find((x) => x.lt === undefined || n < x.lt)?.label;
    }
  }
  return value;
}

/** Union dédupliquée en préservant l'ordre d'insertion (sémantique du merge tags tiers-lieux). */
function unionDedup(...listes: unknown[]): unknown[] {
  const out: unknown[] = [];
  const vus = new Set<unknown>();
  for (const l of listes) {
    for (const v of Array.isArray(l) ? l : l === undefined || l === null || l === "" ? [] : [l]) {
      if (!vus.has(v)) { vus.add(v); out.push(v); }
    }
  }
  return out;
}

export interface ApplyStampsCtx {
  mode: "add" | "edit";
  /** serverData de l'entité ÉDITÉE (op `append` en edit fusionne la valeur serveur existante —
   *  sans elle, `tags` écrasé par save() perdrait les tags posés hors form). */
  targetServerData?: Record<string, unknown> | null;
  /** Horloge injectable (tests). Défaut : new Date() à l'application. */
  now?: Date;
}

/**
 * Applique les stamps canal `payload` (défaut) au payload — dans l'ORDRE de la liste (un `$from`
 * voit les stamps précédents). Retourne un NOUVEL objet si au moins un stamp s'applique.
 * Un stamp dont la valeur évaluée est `undefined` est ignoré (jamais d'écriture d'undefined —
 * cohérent avec l'omit-empty du pipeline et le R3 d'updateField).
 */
export function applyPayloadStamps(
  payload: Record<string, unknown>,
  stamps: SpecStamp[] | undefined,
  ctx: ApplyStampsCtx,
): Record<string, unknown> {
  const actifs = stampsPourMode(stamps, ctx.mode).filter((s) => (s.channel ?? "payload") === "payload");
  if (actifs.length === 0) return payload;
  const maintenant = ctx.now ?? new Date();
  const out = { ...payload };
  for (const s of actifs) {
    const valeur = evaluer(s.value, out, maintenant);
    if (valeur === undefined) continue;
    const op = s.op ?? "set";
    if (op === "set") {
      out[s.field] = valeur;
    } else if (op === "fillIfEmpty") {
      if (estVide(out[s.field])) out[s.field] = valeur;
    } else {
      // append : payload existant ∪ (edit) valeur serveur ∪ valeur du stamp — dédup, ordre préservé.
      const existantServeur = ctx.mode === "edit" ? ctx.targetServerData?.[s.field] : undefined;
      out[s.field] = unionDedup(existantServeur, out[s.field], valeur);
    }
  }
  return out;
}

/** Un stamp `pathValue` prêt à écrire : chemin + valeur évaluée + fillIfEmpty restant à trancher
 *  contre l'entité (sa donnée locale n'est connue qu'après le save). */
export interface PathValueWrite {
  field: string;
  value: unknown;
  fillIfEmpty: boolean;
}

/**
 * Prépare les écritures canal `pathValue` pour ce mode : valeurs évaluées CONTRE LE PAYLOAD (un
 * `$from` lit le payload envoyé), `$now` à la soumission. `op: "append"` n'est PAS supporté sur ce
 * canal en v1 (il faudrait relire la valeur serveur — utiliser le canal payload) : ignoré + warn.
 */
export function preparePathValueStamps(
  payload: Record<string, unknown>,
  stamps: SpecStamp[] | undefined,
  ctx: ApplyStampsCtx,
): PathValueWrite[] {
  const actifs = stampsPourMode(stamps, ctx.mode).filter((s) => s.channel === "pathValue");
  if (actifs.length === 0) return [];
  const maintenant = ctx.now ?? new Date();
  const out: PathValueWrite[] = [];
  for (const s of actifs) {
    if (s.op === "append") {
      console.warn(`[stamps] ${s.field} : op "append" non supporté sur le canal pathValue — ignoré`);
      continue;
    }
    const valeur = evaluer(s.value, payload, maintenant);
    if (valeur === undefined) continue;
    out.push({ field: s.field, value: valeur, fillIfEmpty: s.op === "fillIfEmpty" });
  }
  return out;
}
