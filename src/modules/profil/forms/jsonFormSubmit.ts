/**
 * Pipeline de soumission générique des formulaires config-driven (P2 de doc/formulaire-config-driven.md).
 * values → payload (payloadFn nommé OU mapping générique) → presets AVANT data → SDK selon entityType
 * (+ scope costum via me.costum(slug)) → save(). Réutilise `transformFormDataWithAddress` (parité address).
 */
import type { JsonFormConfig } from "@/modules/formEngine";
import { transformFormDataWithAddress } from "../hooks/mutationUtils";

type Values = Record<string, unknown>;

/** Une entité créable via le SDK : `target.organization(payload)` → instance avec `.save()`. */
type EntityMaker = (payload: Values) => Promise<{ save: () => Promise<unknown>; slug?: string }>;
export interface SubmitTarget {
  organization: EntityMaker;
  project: EntityMaker;
  event: EntityMaker;
  poi: EntityMaker;
}
export interface MeLike extends SubmitTarget {
  costum: (slug: string) => Promise<SubmitTarget>;
}

/** entityType (config) → méthode SDK de création. */
const ENTITY_METHOD: Record<string, keyof SubmitTarget> = {
  organization: "organization",
  project: "project",
  event: "event",
  poi: "poi",
};

// ── payloadFn nommés (registre) : pour les mappings métier non triviaux (P5 : tiersLieu, poiEquipement…) ──
export type PayloadFn = (values: Values, config: JsonFormConfig) => Values;
const payloadRegistry = new Map<string, PayloadFn>();
export function registerPayloadFn(name: string, fn: PayloadFn): void { payloadRegistry.set(name, fn); }
export function getPayloadFn(name: string): PayloadFn | undefined { return payloadRegistry.get(name); }

/** Valeur par défaut d'un champ selon son type (amorce le form). */
function defaultForType(type: string, declared: unknown): unknown {
  if (declared !== undefined) return declared;
  if (type === "array") return [];
  if (type === "boolean") return false;
  return "";
}

/** defaultValues du form depuis la config (par champ) + amorce des champs adresse si widget location. */
export function buildConfigDefaults(config: JsonFormConfig): Values {
  const out: Values = {};
  let hasLocation = false;
  for (const [name, f] of Object.entries(config.fields)) {
    out[name] = defaultForType(f.type, f.default);
    if (f.widget === "location") hasLocation = true;
  }
  if (hasLocation) {
    for (const k of ["addressCountry", "addressLocality", "localityId", "postalCode", "streetAddress"]) {
      if (!(k in out)) out[k] = "";
    }
  }
  return out;
}

/** Mapping générique values → payload : address reconstruite, tagsFrom agrégés, extraData fusionné. */
export function buildGenericPayload(config: JsonFormConfig, values: Values): Values {
  // Reconstruit l'objet `address` depuis les champs plats (no-op si pas d'adresse).
  const payload: Values = { ...transformFormDataWithAddress(values) };

  const tagsFrom = config.submit?.tagsFrom;
  if (tagsFrom?.length) {
    const collected = tagsFrom.flatMap((k) => {
      const v = values[k];
      return Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
    });
    if (collected.length) {
      const existing = Array.isArray(payload.tags) ? (payload.tags as unknown[]).map(String) : [];
      payload.tags = Array.from(new Set([...existing, ...collected]));
    }
  }

  // extraData : valeurs fixes de la config (hors costum* — le scope costum passe par me.costum(slug)).
  if (config.submit?.extraData) {
    for (const [k, v] of Object.entries(config.submit.extraData)) {
      if (k === "costumSlug" || k === "costumId" || k === "costumType" || k === "costumEditMode") continue;
      payload[k] = v;
    }
  }
  return payload;
}

export interface RunSubmitDeps {
  me: MeLike;
  /** entité parente éventuelle (création depuis une orga/projet…) ; défaut = me. */
  parent?: SubmitTarget | null;
}

/** Exécute la soumission : payload → presets → SDK (scope costum) → save. Retourne l'entité créée. */
export async function runSubmit(config: JsonFormConfig, values: Values, deps: RunSubmitDeps): Promise<{ slug?: string }> {
  const payloadFn = config.submit?.payloadFn ? getPayloadFn(config.submit.payloadFn) : undefined;
  const base = payloadFn ? payloadFn(values, config) : buildGenericPayload(config, values);
  // presets AVANT data (parité dynFormCostum.presetValue + presets lib) — data l'emporte à clé égale.
  const payload: Values = { ...(config.submit?.presets ?? {}), ...base };

  const entityType = config.entityType;
  const method = ENTITY_METHOD[entityType];
  if (!method) throw new Error(`entityType non supporté pour la création : ${entityType}`);

  const target: SubmitTarget = config.costum?.slug
    ? await deps.me.costum(config.costum.slug)
    : (deps.parent ?? deps.me);

  const entity = await target[method](payload);
  await entity.save();
  return entity;
}
