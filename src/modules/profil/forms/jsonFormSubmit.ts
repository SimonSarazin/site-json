/**
 * Helpers PIPELINE config-driven : READ/WRITE d'un formulaire à partir d'une `JsonFormConfig` UNIFIÉE
 * (qui porte read/write par champ + serializeGroups, ex. configs dérivées de poiEquipement/tiersLieu).
 * Consommés par EntityFormModal + les configs (configs/poiEquipement.tsx, tiersLieuxMapping). Le READ et le
 * WRITE passent par le descripteur ISSU DE LA CONFIG (configToDescriptor → seedEntity/buildPayload) → tous
 * les champs costum DÉCLARÉS sont préservés. cf. doc/formulaire-config-driven.md.
 */
import type { JsonFormConfig, FormSpec, EntityLike } from "@/modules/formEngine";
import { configToDescriptor, seedEntity, buildPayload, buildEditPayload } from "@/modules/formEngine";

type Values = Record<string, unknown>;

// Labels = clés i18n → tLoc identité (le pipeline ignore les labels ; GenericForm les résout au rendu).
const PIPELINE_TLOC = (l: unknown) => (typeof l === "string" ? l : ((l as { fr?: string })?.fr ?? ""));

/** La config porte-t-elle son pipeline (descripteur unifié) ? → serializeGroups OU un champ read/write. */
export function isPipelineConfig(config: JsonFormConfig): boolean {
  if (config.serializeGroups && Object.keys(config.serializeGroups).length > 0) return true;
  return Object.values(config.fields).some((f) => f.read || f.write);
}

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

interface PipelineOpts {
  /** socle typé hors descripteur (ex. createEmptyDefaults) ; défaut = défauts par champ de la config. */
  baseDefaults?: () => Values;
  tLoc?: (l: unknown) => string;
}

/** READ entity-aware : entité serveur → valeurs de form via le descripteur issu de la config (seedEntity). */
export function buildPipelineDefaults(config: JsonFormConfig, entity: EntityLike, opts: PipelineOpts = {}): Values {
  const descriptor = configToDescriptor(config, { tLoc: opts.tLoc ?? PIPELINE_TLOC });
  const spec: FormSpec = { descriptor, baseDefaults: opts.baseDefaults ?? (() => buildConfigDefaults(config)) };
  return seedEntity(spec, entity) as Values;
}

/** WRITE : valeurs de form → payload via le descripteur issu de la config. `emitEmpty` → ÉDITION (vides typés). */
export function buildPipelinePayload(config: JsonFormConfig, values: Values, opts: { emitEmpty?: boolean; tLoc?: (l: unknown) => string } = {}): Values {
  const descriptor = configToDescriptor(config, { tLoc: opts.tLoc ?? PIPELINE_TLOC });
  const spec: FormSpec = { descriptor };
  return (opts.emitEmpty ? buildEditPayload(spec, values as never) : buildPayload(spec, values as never)) as Values;
}
