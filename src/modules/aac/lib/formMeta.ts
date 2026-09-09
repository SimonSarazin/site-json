/**
 * Métadonnées de QUESTIONS d'un formulaire AAC — fonction PURE.
 *
 * `resolveAacConfig` normalise les *règles* (étapes, rôles, critères, gates,
 * campagnes) ; il lit `form.inputs` mais n'en conserve ni les libellés ni les
 * listes d'options. Or l'annuaire en a besoin : les filtres « thème » et
 * « maturité » tirent leurs options de `form.params`, et leur intitulé du
 * libellé de la question.
 *
 * Ce module comble exactement ce manque, sans élargir `AacResolvedConfig`.
 *
 * ⚠️ Les options ne vivent PAS sur l'input : le legacy les range dans
 * `form.params[<clé préfixée>]` — `tags.list`, `radioNew{key}.list`,
 * `checkboxNew{key}.list`… D'où `readOptionList`, qui balaie les clés
 * candidates plutôt que de supposer le préfixe.
 *
 * ⚠️ On ne réutilise de coform que `mapCoFormTypeToComponentType` (la table des
 * types, source unique) — pas `parseCoFormFields`, qui embarque zod et tout le
 * pipeline react-hook-form pour un besoin de lecture seule.
 */
import { mapCoFormTypeToComponentType } from "@/modules/coform/utils/formParser";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const toStr = (v: unknown): string => (typeof v === "string" ? v : "");

/** Une option de liste (valeur stockée + libellé affiché). */
export interface AacOption {
  value: string;
  label: string;
}

/** Ce qu'on retient d'une question, pour le listing et ses filtres. */
export interface AacQuestionMeta {
  /** Étape porteuse — DÉRIVÉE de `form.inputs`, jamais écrite en dur. */
  stepKey: string;
  /** Clé de stockage dans `answers.<stepKey>.<id>`. */
  id: string;
  label: string;
  /** Type CoForm brut (`tpls.forms.cplx.radioNew`, `tags`…). */
  rawType: string;
  /** Type normalisé par la table de coform (`"unknown"` si non mappé). */
  componentType: string;
  options: AacOption[];
  position: number;
}

export interface AacFormMeta {
  formId: string;
  byId: Record<string, AacQuestionMeta>;
  /** stepKey → ids, dans l'ordre `position`. */
  byStep: Record<string, string[]>;
  /** Tous les ids, dans l'ordre des étapes puis des positions. */
  order: string[];
  /**
   * `form.mapping` brut — associe des rôles à des chemins d'answer.
   * ⚠️ Constaté PÉRIMÉ en base sur certains AAC : à traiter comme un indice,
   * jamais comme une source de vérité (cf. `resolveAacCardFields`).
   */
  mapping: Record<string, unknown>;
}

/**
 * Normalise une liste d'options legacy. Deux formes coexistent en base :
 *  - tableau plat `["A", "B"]` ⇒ la valeur EST le libellé ;
 *  - objet associatif `{ a: "Label A" }` ⇒ value = clé, label = valeur.
 */
function normalizeOptions(raw: unknown): AacOption[] {
  if (Array.isArray(raw)) {
    return raw
      .map((v) => toStr(v).trim())
      .filter(Boolean)
      .map((v) => ({ value: v, label: v }));
  }
  const obj = rec(raw);
  return Object.entries(obj)
    .map(([k, v]) => ({ value: k, label: toStr(v).trim() || k }))
    .filter((o) => o.value);
}

/**
 * Cherche la liste d'options d'une question dans `form.params`.
 *
 * Balaie les clés candidates (la clé nue, puis les variantes préfixées du
 * legacy) et, pour chacune, les emplacements observés : `.list`, `.options`,
 * `.global.list`.
 */
export function readOptionList(params: unknown, fieldKey: string): AacOption[] {
  const p = rec(params);
  const candidates = [
    fieldKey,
    `radioNew${fieldKey}`,
    `checkboxNew${fieldKey}`,
    `multiRadio${fieldKey}`,
    `multiCheckboxPlus${fieldKey}`,
  ];
  for (const key of candidates) {
    const entry = rec(p[key]);
    for (const holder of [entry.list, entry.options, rec(entry.global).list]) {
      const opts = normalizeOptions(holder);
      if (opts.length > 0) return opts;
    }
  }
  return [];
}

/**
 * Construit les métadonnées de questions depuis `form.serverData`.
 *
 * L'ordre des étapes suit `form.subForms` quand il est présent (c'est lui qui
 * fait foi, cf. `resolveAacConfig`), sinon l'ordre de `form.inputs`.
 */
export function buildAacFormMeta(formId: string, formData: unknown): AacFormMeta {
  const form = rec(formData);
  const params = rec(form.params);
  const formInputs = rec(form.inputs);

  const declared = Array.isArray(form.subForms)
    ? form.subForms.map(toStr).filter(Boolean)
    : [];
  const stepKeys = [
    ...declared.filter((k) => k in formInputs),
    ...Object.keys(formInputs).filter((k) => !declared.includes(k)),
  ];

  const byId: Record<string, AacQuestionMeta> = {};
  const byStep: Record<string, string[]> = {};
  const order: string[] = [];

  for (const stepKey of stepKeys) {
    const inputs = rec(rec(formInputs[stepKey]).inputs);
    const metas = Object.entries(inputs).map(([id, def], index) => {
      const d = rec(def);
      const rawType = toStr(d.type);
      const positionRaw = Number(d.position);
      return {
        stepKey,
        id,
        label: toStr(d.label) || id,
        rawType,
        componentType: mapCoFormTypeToComponentType(rawType),
        options: readOptionList(params, id),
        position: Number.isFinite(positionRaw) ? positionRaw : index,
      } satisfies AacQuestionMeta;
    });

    metas.sort((a, b) => a.position - b.position);
    byStep[stepKey] = metas.map((m) => m.id);
    for (const m of metas) {
      byId[m.id] = m;
      order.push(m.id);
    }
  }

  return { formId, byId, byStep, order, mapping: rec(form.mapping) };
}
