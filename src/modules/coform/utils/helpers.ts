import { BOOTSTRAP_TO_TAILWIND_WIDTH } from "../constants";
import type { SubFormData, AllStepsData, FormFieldMapping } from "../types";

/**
 * Convertit une classe de largeur Bootstrap en classe Tailwind
 */
export function convertBootstrapWidth(bootstrapClass?: string): string {
  if (!bootstrapClass) return "w-full";
  return BOOTSTRAP_TO_TAILWIND_WIDTH[bootstrapClass] ?? "w-full";
}

/**
 * Génère un ID unique pour les champs de formulaire
 */
export function generateFieldId(subFormId: string, fieldKey: string): string {
  return `${subFormId}_${fieldKey}`;
}

/**
 * Extrait l'ID MongoDB depuis un objet _id
 */
export function extractMongoId(id: { $id: string } | string): string {
  if (typeof id === "string") return id;
  return id.$id;
}

/**
 * Formate un timestamp en date lisible
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * Sélectionne l'URL d'image de profil d'un élément depuis son `serverData`.
 * Priorité : medium → pleine → thumb (le thumb est un crop carré souvent peu
 * net, comme la fiche élément qui ne l'utilise qu'en secours).
 *
 * Source UNIQUE de cette règle : consommée par `fetchElementSummary`
 * (résolution finder/lieux) et les lignes de `PlacesListView`.
 */
export function pickProfileImageUrl(
  serverData: Record<string, unknown> | null | undefined,
): string | undefined {
  const sd = serverData ?? {};
  const raw = sd.profilMediumImageUrl ?? sd.profilImageUrl ?? sd.profilThumbImageUrl;
  return typeof raw === "string" && raw.trim() !== "" ? raw : undefined;
}

/**
 * Vérifie si une étape est complète (tous les champs requis remplis)
 */
export function isStepComplete(
  data: SubFormData,
  requiredFields: string[]
): boolean {
  return requiredFields.every((field) => {
    const value = data[field];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== "";
  });
}

/**
 * Fusionne les données de plusieurs étapes
 */
export function mergeStepsData(
  stepsData: AllStepsData
): SubFormData {
  return Object.values(stepsData).reduce<SubFormData>(
    (acc, stepData) => ({ ...acc, ...stepData }),
    {}
  );
}

/**
 * Scrolle et focus vers le premier élément focusable du champ ciblé par data-field-name.
 * Ajoute temporairement la classe `coform-attention` pour déclencher un halo visuel
 * (animation CSS de 1.8s déclarée dans index.css) — repère l'œil vers le champ cible.
 * Impératif (hors cycle de render) — aucun ref ni subscription nécessaire.
 *
 * Stratégie de résolution :
 *  1. `[data-field-name="<name>"]` — préféré (wrapper explicite posé par
 *     DynamicCoForm / MultiStepCoForm / CommonTableField).
 *  2. Si le wrapper trouvé est en `display:contents`, on remplace par son
 *     premier enfant rendable — sinon `scrollIntoView` + animation `box-shadow`
 *     n'ont rien à cibler (pas de bounding box).
 *  3. Fallback : on cherche l'input par `[name=]` puis on remonte au plus
 *     proche ancêtre de field via `col-span-*` (pattern grid Tailwind utilisé
 *     par tous les composants de field).
 */
export function scrollToFieldByName(name: string): void {
  // Garde SSR unique en tête : tout le corps utilise document ET window
  // (getComputedStyle, matchMedia, setTimeout, Web Animations).
  if (typeof document === "undefined" || typeof window === "undefined") return;
  let el = document.querySelector<HTMLElement>(`[data-field-name="${CSS.escape(name)}"]`);

  if (!el) {
    const input = document.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
    if (input) {
      el = input.closest<HTMLElement>('[class*="col-span-"]') ?? input;
    }
  }
  if (!el) return;

  if (window.getComputedStyle(el).display === "contents") {
    const child = el.firstElementChild as HTMLElement | null;
    if (child) el = child;
  }

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = el.querySelector<HTMLElement>(
    'input,textarea,select,[tabindex]:not([tabindex="-1"])'
  );
  focusable?.focus({ preventScroll: true });

  // Respecte `prefers-reduced-motion`.
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  // Halo d'attention via Web Animations API.
  // box-shadow s'interpole plus proprement que outline-offset (moins de repaint saccadé).
  // Couleur destructive atténuée (~45% d'alpha max) pour un effet "souligné" et pas "sang".
  window.setTimeout(() => {
    const prevRadius = el.style.borderRadius;
    el.style.borderRadius = el.style.borderRadius || "0.5rem";
    const ring = (spread: number, alpha1: number, alpha2: number) =>
      `0 0 0 ${spread}px oklch(0.577 0.245 27.325 / ${alpha1}), ` +
      `0 0 0 ${spread + 8}px oklch(0.577 0.245 27.325 / ${alpha2})`;
    const anim = el.animate(
      [
        { boxShadow: ring(4, 0.45, 0.15), backgroundColor: "oklch(0.577 0.245 27.325 / 0.06)", offset: 0 },
        { boxShadow: ring(6, 0.28, 0.08), backgroundColor: "oklch(0.577 0.245 27.325 / 0.03)", offset: 0.35 },
        { boxShadow: ring(10, 0,    0),    backgroundColor: "oklch(0.577 0.245 27.325 / 0)",    offset: 1 },
      ],
      { duration: 1500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
    anim.onfinish = () => {
      el.style.borderRadius = prevRadius;
    };
  }, 450);
}

/** Schéma Zod minimal requis par {@link debugLogValidationFailure} (structurel). */
interface SafeParsable {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: ReadonlyArray<{ path: PropertyKey[]; code: string; message: string }> };
  };
}

/**
 * Diagnostic **DEV uniquement** (no-op en prod), à brancher **à la demande** :
 * ce helper n'est PAS câblé en permanence. Quand un submit échoue
 * mystérieusement ("format invalide"), importe-le et dépose un appel dans le
 * chemin de validation qui bug (ex. dans `useCoFormStep.submitStep` après un
 * `form.trigger()` à false, ou dans `DynamicCoForm.handleInvalid`) :
 *
 * ```ts
 * if (!isValid) {
 *   debugLogValidationFailure(schema, data, stepFields.fields, `étape ${subFormId}`);
 *   return false;
 * }
 * ```
 *
 * Il log le détail de chaque issue Zod (chemin + valeur réelle + type) et un
 * dump de chaque champ commonTable. Le format composite legacy
 * `{ scores, myCatalog }` est la cause la plus fréquente d'un échec silencieux :
 * une `note` héritée hors de [0,5], un `coeff` stocké en string, etc. déclenche
 * une erreur Zod *imbriquée* dont le message ne remonte pas dans l'ErrorSummary.
 * Retire l'appel une fois le diagnostic posé.
 *
 * @param schema  Le schéma Zod de l'étape (ou du formulaire complet).
 * @param values  Les valeurs RHF plates (clé = `field.name`).
 * @param fields  Les champs concernés (pour repérer/dumper les commonTable).
 * @param context Libellé d'étape/formulaire pour préfixer le groupe console.
 */
export function debugLogValidationFailure(
  schema: SafeParsable,
  values: Record<string, unknown>,
  fields: FormFieldMapping[],
  context: string
): void {
  if (!import.meta.env.DEV) return;
  const result = schema.safeParse(values);
  if (result.success || !result.error) return;

  const getAtPath = (obj: unknown, path: PropertyKey[]): unknown =>
    path.reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") {
        return (acc as Record<PropertyKey, unknown>)[key];
      }
      return undefined;
    }, obj);

  const issues = result.error.issues;
  console.groupCollapsed(
    `[CoForm] Validation échouée — ${context} (${issues.length} issue·s)`
  );
  for (const issue of issues) {
    const offending = getAtPath(values, issue.path);
    console.warn(
      `· ${issue.path.map(String).join(".") || "(racine)"} — [${issue.code}] ${issue.message}`,
      "\n    valeur:",
      offending,
      "\n    type:",
      Array.isArray(offending) ? "array" : offending === null ? "null" : typeof offending
    );
  }
  // Dump complet des commonTable (souvent la source : data legacy enrichie).
  for (const f of fields) {
    if (f.componentType === "commonTable") {
      console.info(`· valeur complète commonTable "${f.name}":`, values[f.name]);
    }
  }
  console.groupEnd();
}
