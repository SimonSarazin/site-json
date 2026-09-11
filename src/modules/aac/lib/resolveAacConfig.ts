/**
 * Résolveur PUR de la configuration d'un AAC.
 *
 * Normalise `form.serverData` (form parent `type:aap, aapType:aac`) + le doc
 * `aapConfig` (`form.config`) en un objet `AacConfig` typé unique. Reproduit les
 * règles legacy critiques (cf. `module-aac-react-plan.md` §10 et la spec métier) :
 *
 *  - **`subForms` a deux formes** : TABLEAU sur le form (ordre des étapes) vs
 *    OBJET sur l'aapConfig. Le form fait foi ; il peut être un SOUS-ENSEMBLE.
 *  - **dispatch par nombre d'étapes (4 vs 5)** : 5 steps ⇒ éval/financement/suivi
 *    = index 2/3/4 ; 4 steps ⇒ 1/2/3. Raffiné par SCAN des clés/types d'input
 *    (jamais de clé littérale hardcodée `aapStepN`).
 *  - **`depenseStepKey` variable** : l'étape portant `depense[]` (input `depense`),
 *    pas forcément `aapStep1`.
 *  - **priorité des critères** : `formParent.evaluationCriteria` (si
 *    `activateLocalCriteria`) > `aapConfig…params.config.criterions`.
 *  - **coercions** : `coeff` string → number, rôles CSV → array, flags "true".
 *
 * Les gates sont les clés RACINE du form que le legacy lit réellement (relevé
 * sur `Coform::getFormAccessInfo`, `Form.php`, `detailProposal.php`,
 * `IndexAction.php`) — aucune clé « best-effort » : une clé que le backend
 * n'écrit jamais ne peut ouvrir aucune porte. Seule la référence de campagne
 * exacte reste à confirmer sur données réelles (`GATE`).
 *
 * Fonction pure (aucun accès réseau) → testable avec des fixtures synthétiques.
 */
import type {
  AacCriteriaSource,
  AacCriterion,
  AacGates,
  AacResolvedConfig,
  AacStep,
  AacStepRoles,
  Campagne,
} from "../types";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const toStr = (v: unknown): string => (typeof v === "string" ? v : "");
const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const asBool = (v: unknown): boolean =>
  v === true || v === "true" || v === 1 || v === "1";

/** Rôles : tolère un tableau (config) ou une CSV string (form). */
function splitRoles(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(toStr).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Clés d'étapes ordonnées : tableau (form) → valeurs ; objet (config) → clés. */
function stepKeysFrom(subForms: unknown): string[] {
  if (Array.isArray(subForms)) return subForms.map(toStr).filter(Boolean);
  return Object.keys(rec(subForms));
}

export function resolveAacConfig(
  formId: string,
  formData: unknown,
  configData?: unknown
): AacResolvedConfig {
  const form = rec(formData);
  const config = rec(configData);

  const configId = toStr(form.config) || null;
  const aapType = toStr(form.aapType) || null;

  const params = rec(form.params);
  const formInputs = rec(form.inputs); // { stepKey: { inputs: {...}, ... } }
  const configSubForms = rec(config.subForms);

  // Ordre des étapes : form.subForms (tableau) fait foi ; fallback config ; fallback inputs.
  let stepKeys = stepKeysFrom(form.subForms);
  if (stepKeys.length === 0) stepKeys = stepKeysFrom(config.subForms);
  if (stepKeys.length === 0) stepKeys = Object.keys(formInputs);

  const steps: AacStep[] = stepKeys.map((key) => {
    const p = rec(params[key]);
    const cfgStep = rec(configSubForms[key]);
    const cfgParams = rec(cfgStep.params);
    return {
      key,
      name: toStr(cfgStep.name) || toStr(p.name) || undefined,
      canEdit: splitRoles(p.canEdit ?? cfgParams.canEdit),
      canRead: splitRoles(p.canRead ?? cfgParams.canRead),
      haveEditingRules:
        asBool(p.haveEditingRules ?? cfgParams.haveEditingRules) || undefined,
      haveReadingRules:
        asBool(p.haveReadingRules ?? cfgParams.haveReadingRules) || undefined,
      masquageStandalone:
        asBool(p.masquageStandalone ?? cfgParams.masquageStandalone) || undefined,
    };
  });

  // Index par étape : clés d'input (lowercased) + types d'input (lowercased).
  const inputKeysOf = (key: string): string[] =>
    Object.keys(rec(rec(formInputs[key]).inputs)).map((k) => k.toLowerCase());
  const inputTypesOf = (key: string): string[] =>
    Object.values(rec(rec(formInputs[key]).inputs)).map((def) =>
      toStr(rec(def).type).toLowerCase()
    );

  const findStep = (
    pred: (keys: string[], types: string[]) => boolean
  ): string | null =>
    stepKeys.find((k) => pred(inputKeysOf(k), inputTypesOf(k))) ?? null;

  // Dispatch par nombre d'étapes (4 vs 5), raffiné par scan.
  const n = stepKeys.length;
  const at = (i: number): string | null => stepKeys[i] ?? null;
  const evalByCount = n >= 5 ? at(2) : at(1);
  const finByCount = n >= 5 ? at(3) : at(2);
  const suiviByCount = n >= 5 ? at(4) : at(3);

  const depenseStepKey =
    findStep((keys) => keys.includes("depense")) ?? stepKeys[0] ?? null;
  const evalStepKey =
    findStep(
      (keys, types) =>
        keys.includes("choose") ||
        keys.includes("decide") ||
        types.some((t) => /selection|chooseproposal|multidecide/.test(t))
    ) ?? evalByCount;
  const financementStepKey =
    findStep(
      (keys, types) =>
        keys.includes("financer") ||
        keys.includes("generateproject") ||
        types.some((t) => /generateprojectbtn/.test(t))
    ) ?? finByCount;
  const suiviStepKey =
    findStep(
      (keys, types) =>
        keys.includes("suivredepense") || types.some((t) => /suivifrombudget/.test(t))
    ) ?? suiviByCount;

  const roles: AacStepRoles = {
    depenseStepKey,
    evalStepKey,
    financementStepKey,
    suiviStepKey,
  };

  // Critères : priorité surcharge locale (form.evaluationCriteria) > config.
  const localEval = rec(form.evaluationCriteria);
  const useLocal =
    asBool(localEval.activateLocalCriteria) &&
    Array.isArray(localEval.criterions) &&
    (localEval.criterions as unknown[]).length > 0;

  let rawCriterions: unknown[] = [];
  let criteriaSource: AacCriteriaSource = "none";
  if (useLocal) {
    rawCriterions = localEval.criterions as unknown[];
    criteriaSource = "formParent";
  } else {
    const cfgEvalStep = rec(
      configSubForms[evalStepKey ?? ""] ?? configSubForms.aapStep2
    );
    const cfgConfig = rec(rec(cfgEvalStep.params).config);
    if (Array.isArray(cfgConfig.criterions) && cfgConfig.criterions.length > 0) {
      rawCriterions = cfgConfig.criterions as unknown[];
      criteriaSource = "config";
    }
  }

  const criteria: AacCriterion[] = rawCriterions.map((c) => {
    const cr = rec(c);
    return {
      label: toStr(cr.label),
      coeff: cr.coeff == null || cr.coeff === "" ? 1 : toNum(cr.coeff),
      note: cr.note == null ? undefined : toNum(cr.note),
      fieldKey: toStr(cr.fieldKey) || undefined,
    };
  });

  // Toutes à la RACINE du form — jamais dans `params`, jamais sur l'aapConfig.
  // Les clés `coRemuneration`, `standalone` et `annuaire` qu'on lisait ici
  // n'existent pas côté legacy (`coRemuneration` : zéro occurrence ;
  // `standalone` : un mode de REQUÊTE, `.standalone.true` /
  // `filters.formStandalone` ; `annuaire` : un nom de vue). Un gate calculé sur
  // une clé fantôme vaut toujours `false` — et éteint ce qu'il garde.
  const gates: AacGates = {
    active: form.active !== false,
    onlyMemberAccess: asBool(form.onlymemberaccess),
    oneAnswerPerPers: asBool(form.oneAnswerPerPers),
    canReadOtherAnswers: asBool(form.canReadOtherAnswers),
    showAnswers: asBool(form.showAnswers),
    // Gate MAÎTRE du financement. Écrit par la préconfiguration « Système de
    // coremuneration » d'`aap.js` (`Form::switchcoremu`), lu par
    // `detailProposal.php:105` via `filter_var(FILTER_VALIDATE_BOOLEAN)` :
    // booléen OU chaîne `"true"` — d'où `asBool`.
    coremu: asBool(form.coremu),
    // « Avoir le lien suffit pour répondre » (`form.js`) : un CONNECTÉ peut lire
    // et modifier une réponse sans lien au contexte (`IndexAction.php:237`, sous
    // `session['userId']`). Ce n'est PAS un dépôt sans connexion — le flag ne
    // remplace donc aucun `standalone`.
    anyOnewithLinkCanAnswer: asBool(form.anyOnewithLinkCanAnswer),
  };

  const typeCoFinancer = resolveTypeCoFinancer(form);

  // Campagnes déclarées sur l'aapConfig (`config.campagne` = { campId: {...} }).
  const campObj = rec(config.campagne);
  const campaigns: Campagne[] = Object.entries(campObj).map(([id, c]) => {
    const cc = rec(c);
    return {
      id: toStr(cc.id) || id,
      name: toStr(cc.name) || undefined,
      type: (toStr(cc.campType) as Campagne["type"]) || undefined,
      dates: {
        debut: toStr(cc.startDate) || undefined,
        fin: toStr(cc.endDate) || undefined,
        debutCofinancement: toStr(cc.cofinancedate) || undefined,
        ouverturePaiement: toStr(cc.panierdate) || undefined,
      },
      montantDisponibleDoublonnage:
        cc.campFinanc == null ? undefined : toNum(cc.campFinanc),
      porteur: toStr(cc.campPorteur) || undefined,
      provider: (toStr(cc.provider) as Campagne["provider"]) || undefined,
      activee: cc.activated == null ? undefined : asBool(cc.activated),
    };
  });

  return {
    formId,
    configId,
    aapType,
    steps,
    roles,
    criteria,
    criteriaSource,
    gates,
    campaigns,
    typeCoFinancer,
  };
}

/**
 * Nature des organisations cofinanceuses : `"tiersLieux"` (FTL, le défaut legacy)
 * ou un TAG d'organisation (`"cae"`…) — `Organization::get_cofinancer_bytags`.
 *
 * Clé RACINE du form parent, comme les gates : `financer.php:835` lit
 * `costum.mainFormData.typeCoFinancer` puis `parentForm.typeCoFinancer`,
 * `AnswerAction.php:268` teste `$params["parentForm"]["typeCoFinancer"]`. Ni
 * `params`, ni l'aapConfig — le legacy n'y regarde jamais.
 *
 * Rend `null` quand le form ne le déclare pas : le repli « tiersLieux »
 * appartient à l'affichage (`CommunFinancingCard`), pas au résolveur.
 */
function resolveTypeCoFinancer(form: Rec): string | null {
  return toStr(form.typeCoFinancer).trim() || null;
}
