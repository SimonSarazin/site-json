import { z } from "zod";
import { resolveMultiDecide } from "./multiDecide";
import type { CoFormData, CoFormInputField, FormFieldMapping, SubFormFields, MultiCheckboxPlusOptionType, EvaluationConfig, FinderConfig, FinderFilter, SimpleTableConfig, SimpleTableColumn, SimpleTableRow, UploaderConfig, ConditionalDisplay, CommonTableConfig, CommonTableValue, CategorizedCheckboxConfig, CategorizedCheckboxSource, CategorizedCheckboxValue, TimeSlotsConfig, DynamicFieldsConfig } from "../types";
import { isSlotComplete, isSlotOrdered } from "./timeSlots";

// ─── Configuration des préfixes de champs ────────────────────────
// Certains types de champs PHP stockent leurs données avec un préfixe
// Ajouter ici d'autres types si nécessaire à l'avenir

/**
 * Map des types de composants vers leurs préfixes de stockage
 * Le PHP stocke les données de ces champs avec un préfixe devant le fieldKey
 * Ex: un champ finder avec fieldKey "abc123" sera stocké comme "finderabc123"
 */
const FIELD_PREFIX_MAP: Partial<Record<FormFieldMapping["componentType"], string>> = {
  finder: "finder",
  multiCheckboxPlus: "multiCheckboxPlus",
  multiRadio: "multiRadio",
  evaluation: "evaluation",
  // commonTable est stocké côté legacy sous `yesOrNo{key}` (les scores). Le
  // catalogue user vit dans la clé jumelle `criterias{key}` — split géré
  // explicitement par normalize/denormalize.
  commonTable: "yesOrNo",
};

/**
 * Certains types de champs sont stockés à la racine de answers au lieu du sous-formulaire
 * Ex: evaluation est stocké comme answers["evaluationXXX"] au lieu de answers[subFormId]["evaluationXXX"]
 */
const ROOT_LEVEL_FIELDS: FormFieldMapping["componentType"][] = [
  "evaluation",
  "commonTable",
];

/**
 * Vérifie si un type de champ est stocké à la racine de answers
 */
export function isRootLevelField(componentType: FormFieldMapping["componentType"]): boolean {
  return ROOT_LEVEL_FIELDS.includes(componentType);
}

/**
 * Lecture d'un drapeau de configuration d'input, calquée sur le
 * `filter_var($v, FILTER_VALIDATE_BOOLEAN)` du PHP.
 *
 * Le parc mélange booléens et chaînes pour un même drapeau. On ne réplique
 * volontairement PAS le `== true` lâche du legacy, qui fait passer la chaîne
 * `"false"` pour vraie — masquer un champ parce que quelqu'un a écrit
 * `hideInForm: "false"` serait absurde.
 */
export function isTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "on" || v === "yes";
}

/**
 * Génère le nom du champ avec son préfixe si nécessaire
 * @param componentType - Type du composant
 * @param originalKey - Clé originale du champ dans le formulaire
 * @returns Le nom du champ avec préfixe si applicable
 */
export function getFieldNameWithPrefix(
  componentType: FormFieldMapping["componentType"],
  originalKey: string
): string {
  const prefix = FIELD_PREFIX_MAP[componentType];
  return prefix ? `${prefix}${originalKey}` : originalKey;
}

/**
 * Position d'affichage d'un input, dans la priorité du legacy.
 *
 * Un document d'étape peut servir PLUSIEURS formulaires parents : la position
 * est alors stockée par parent dans `positions[<formId>]`, et la clé plate
 * `position` n'est souvent même pas écrite. Sur l'étape 2 d'« Appel à commun
 * des tiers lieux », 15 inputs sur 17 sont dans ce cas — les lire comme des
 * zéros faisait remonter les 6 titres de section en tête, groupés, au lieu de
 * les intercaler au-dessus de leurs questions.
 *
 * Même bascule que le legacy, qui trie sur `positions[$parentForm['_id']]` pour
 * un AAP et sur `position` sinon (`survey/views/tpls/forms/step.php:94-113`).
 * Ici la bascule est portée par la donnée et non par le type de formulaire :
 * mesuré, quand les deux clés coexistent elles ne divergent jamais.
 *
 * @param input - L'input BRUT, tel qu'il est stocké (avant résolution multiDecide)
 * @param formParentId - `_id` du formulaire parent, porté par `CoFormSubFormInputs.formParent`
 */
export function resolveInputOrder(
  input: Pick<CoFormInputField, "position" | "positions">,
  formParentId: string | undefined
): number {
  const scoped = formParentId ? input.positions?.[formParentId] : undefined;
  const raw = scoped ?? input.position;
  const parsed = parseInt(raw ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Extrait la clé originale d'un champ (sans préfixe)
 * @param field - Le champ avec son nom possiblement préfixé
 * @returns La clé originale utilisée dans formData.inputs
 */
export function getOriginalFieldKey(field: FormFieldMapping): string {
  const prefix = FIELD_PREFIX_MAP[field.componentType];
  if (prefix && field.name.startsWith(prefix)) {
    return field.name.slice(prefix.length);
  }
  return field.name;
}

/**
 * Vérifie si un type de composant utilise un préfixe
 */
export function hasFieldPrefix(componentType: FormFieldMapping["componentType"]): boolean {
  return componentType in FIELD_PREFIX_MAP;
}

/**
 * Slugifie une string pour le suffix legacy d'un multi-eval :
 * `_multiEval.{userId} = { answer: "{idx}_{slug}" }`.
 *
 * Le slug n'est PAS la source de vérité (au read, on lit `value` canonical en
 * priorité, et le fallback legacy s'appuie sur l'index préfixe, pas le slug).
 * Il sert juste à produire un suffix lisible aligné avec le format legacy
 * `radioNew` du PHP.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents combinants
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Convertit les classes Bootstrap en classes Tailwind col-span pour grille CSS.
 * Les classes doivent être écrites en entier (pas de template literals) pour que Tailwind les détecte.
 */
function parseBootstrapWidth(bootstrapWidth?: string): string {
  if (!bootstrapWidth) return "col-span-12";
  
  const lgMatch = bootstrapWidth.match(/col-lg-(\d+)/);
  const mdMatch = bootstrapWidth.match(/col-md-(\d+)/);
  
  const lgCols = lgMatch ? parseInt(lgMatch[1]) : 12;
  const mdCols = mdMatch ? parseInt(mdMatch[1]) : lgCols;

  // Map statique pour que Tailwind puisse détecter les classes au build
  const colSpanMap: Record<number, string> = {
    1: "col-span-1",
    2: "col-span-2",
    3: "col-span-3",
    4: "col-span-4",
    5: "col-span-5",
    6: "col-span-6",
    7: "col-span-7",
    8: "col-span-8",
    9: "col-span-9",
    10: "col-span-10",
    11: "col-span-11",
    12: "col-span-12",
  };

  const mdColSpanMap: Record<number, string> = {
    1: "md:col-span-1",
    2: "md:col-span-2",
    3: "md:col-span-3",
    4: "md:col-span-4",
    5: "md:col-span-5",
    6: "md:col-span-6",
    7: "md:col-span-7",
    8: "md:col-span-8",
    9: "md:col-span-9",
    10: "md:col-span-10",
    11: "md:col-span-11",
    12: "md:col-span-12",
  };

  const classes: string[] = ["col-span-12"];

  if (mdCols !== 12) {
    classes.push(mdColSpanMap[mdCols] || "md:col-span-12");
  }

  if (lgCols !== mdCols && lgCols !== 12) {
    // lg: on réutilise mdColSpanMap en remplaçant "md:" par "lg:"
    const lgClass = colSpanMap[lgCols];
    if (lgClass) {
      classes.push(`lg:${lgClass}`);
    }
  }
  
  return classes.join(" ");
}

/**
 * Mappe le type CoForm vers un type de composant React
 */
export function mapCoFormTypeToComponentType(
  coFormType: string
): FormFieldMapping["componentType"] {
  const typeMapping: Record<string, FormFieldMapping["componentType"]> = {
    text: "text",
    url: "text",
    email: "text",
    tel: "text",
    number: "text",
    textarea: "textarea",
    "tpls.forms.cplx.radioNew": "radio",
    "tpls.forms.cplx.multiRadio": "multiRadio",
    "tpls.forms.cplx.checkboxNew": "checkbox",
    "tpls.forms.cplx.multiCheckboxPlus": "multiCheckboxPlus",
    "tpls.forms.cplx.categorizedCheckbox": "categorizedCheckbox",
    "tpls.forms.cplx.evaluation": "evaluation",
    "tpls.forms.evaluation.evaluation": "evaluation",
    "tpls.forms.evaluation.commonTableV2": "commonTable",
    "tpls.forms.cplx.finder": "finder",
    "tpls.forms.finder.finder": "finder",
    // Template legacy `emailUser` : input HTML `type="email"`. La logique
    // d'auto-fill avec l'email du user connecté côté legacy n'est pas
    // portée pour l'instant — on garde juste la sémantique d'input email
    // (validation native + clavier mobile adapté).
    "tpls.forms.emailUser": "text",
    "tpls.forms.cplx.simpleTable": "simpleTable",
    "tpls.forms.uploader": "uploader",
    // Liste de paliers/dépenses AAC (`answers.aapStep1.depense[]`) — géré
    // en synchronisation serveur immédiate, pas de
    // schéma Zod structurant (le composant ne dépend pas de la valeur RHF).
    "tpls.forms.ocecoform.newDepenseList": "milestoneList",
    // Cible de l'indirection `multiDecide` — cf. `utils/multiDecide.ts`.
    "tpls.forms.aap.selection": "selection",
    "tpls.forms.ocecoform.pourContre": "pourContre",
    "tpls.forms.aap.evaluation": "aapEvaluation",
    "tpls.forms.aap.chooseProposal": "chooseProposal",
    "tpls.forms.cplx.timeSlots": "timeSlots",
    "tpls.forms.cplx.dynamicFields": "dynamicFields",
    // Types HTML natifs date/heure (formulaires SSBE) : même pipeline que
    // text/email/… — l'<input> natif porte le picker et la valeur ISO
    // ("1998-09-18"), format vérifié sur les answers réelles.
    date: "text",
    time: "text",
    "datetime-local": "text",
    sectionTitle: "sectionTitle",
    "tpls.forms.sectionTitle": "sectionTitle",
    "tpls.forms.sectionDescription": "sectionDescription",
    // `titleSeparator` avait jusqu'ici un alias vers `sectionTitle`, faute de
    // rendu propre. Il a désormais le sien, fidèle au template legacy (bandeau
    // pleine largeur, bordures pointillées, chevron) — cf. `TitleSeparatorField`.
    // Les deux écritures du type coexistent en base, comme pour `sectionTitle`.
    titleSeparator: "titleSeparator",
    "tpls.forms.titleSeparator": "titleSeparator",
    "tpls.forms.tags": "tags",
    select: "select",
    // Liste déroulante : les forms stockent le type tantôt en raccourci
    // `select` (builder dynamicFields), tantôt en chemin de template complet
    // `tpls.forms.select` (legacy `select.php`). Les deux → composant select.
    "tpls.forms.select": "select",
    // Adresse géolocalisée (parité dynForm `formLocality`) → widget composite `location`
    // qui capture address + geo + geoPosition + niveaux administratifs. Sans ce mapping,
    // le champ retombait en `text` → saisie libre et PERTE totale de la donnée géo.
    formLocality: "location",
    location: "location",
    address: "location",
    "tpls.forms.cplx.addressInDynform": "location",
    "tpls.forms.cplx.address": "location",
  };

  const direct = typeMapping[coFormType];
  if (direct) return direct;

  // Fallback adresse : templates costum d'adresse (`tpls.forms.costum.<slug>.address`,
  // `...formLocality`, etc.) → tout segment final adresse/localité → composant location.
  if (/(?:^|\.)(addressindynform|formlocality|address|location)$/i.test(coFormType)) return "location";

  // Fallback finder : en legacy, chaque costum a parfois son propre template
  // (`tpls.forms.costum.<slug>.finder`, `tpls.forms.adhesion.adherentFinder`,
  // etc.) qui ajoute des comportements custom à la création d'élément. On
  // n'a pas encore l'extension par costum côté jdev, donc tout segment final
  // se terminant par "finder" (case-insensitive) est aplati sur le composant
  // <FinderField> générique — on perd le côté création custom, on garde au
  // moins la sélection. À reraffiner si on rajoute un registry par costum.
  if (/(?:^|\.)\w*finder$/i.test(coFormType)) return "finder";

  return "unknown";
}

/**
 * Convertit les inputs CoForm en structure mappée pour react-hook-form
 */
export interface ParseCoFormFieldsOptions {
  /**
   * Conserver les étapes marquées `hideStep`. Réservé aux lectures
   * STRUCTURELLES, qui cherchent où se trouve un champ et non ce qu'il faut
   * afficher — `getSharedFinderInfo` en est le cas type : le finder partagé
   * détermine le lieu de la réponse, et cette information ne doit pas dépendre
   * du fait qu'un admin ait coché « cacher l'étape ».
   */
  includeHiddenSteps?: boolean;
}

/**
 * Retire des étapes du formulaire, sur décision de L'APPELANT.
 *
 * Complète `hideStep`, qui est une propriété du FORMULAIRE : ici la règle vient
 * du contexte d'appel — « l'étape d'évaluation d'un appel à communs n'est pas
 * proposée à qui n'administre pas cet appel ». Le formulaire ne peut pas la
 * porter : elle dépend de l'utilisateur ET de l'écran.
 *
 * ⚠️ Filtre la DONNÉE, et non le parse. Une option passée à `parseCoFormFields`
 * se perdrait à la frontière du composant : `CoFormProvider`, `DynamicCoForm` et
 * `CoFormReadOnly` reparsent le `formData` qu'ils reçoivent, sans options — une
 * étape « masquée » resterait donc rendue, avec ses champs requis. `hideStep` ne
 * souffre pas de ça parce qu'il VIT dans la donnée ; on fait pareil.
 *
 * Filtrer la donnée fait sortir l'étape du parcours, du sommaire, du schéma Zod
 * et des valeurs par défaut d'un seul geste — sans quoi un champ requis d'une
 * étape invisible rendrait le formulaire insoumettable, sur un champ que
 * personne ne voit.
 *
 * Rend l'objet d'origine quand il n'y a rien à retirer : l'identité est
 * préservée, donc les mémoïsations en aval ne sont pas invalidées pour rien.
 */
export function omitHiddenSteps(
  formData: CoFormData,
  hiddenStepKeys: readonly string[] | undefined
): CoFormData {
  if (!hiddenStepKeys?.length || !formData.inputs) return formData;
  const restantes = Object.fromEntries(
    Object.entries(formData.inputs).filter(([stepKey]) => !hiddenStepKeys.includes(stepKey))
  );
  if (Object.keys(restantes).length === Object.keys(formData.inputs).length) return formData;
  return { ...formData, inputs: restantes };
}

export function parseCoFormFields(
  formData: CoFormData,
  options: ParseCoFormFieldsOptions = {}
): SubFormFields[] {
  if (!formData.inputs) return [];

  const subFormsFields: SubFormFields[] = [];

  // Champs que l'utilisateur courant n'a pas le droit de voir. Calculés
  // serveur-side (`Coform::getFormAccessInfo`) : union des listes place-level
  // et des inputs `isAdminOnly`. On les écarte ICI et pas seulement au rendu,
  // pour qu'ils sortent aussi du schéma Zod et des valeurs par défaut — sinon
  // un champ restreint ET requis rendrait le formulaire insoumettable, sans
  // que l'utilisateur voie jamais le champ fautif.
  const restricted = new Set(formData.access?.restrictedFields ?? []);

  Object.entries(formData.inputs).forEach(([subFormId, subFormData]) => {
    // Étape masquée (« Cacher etape » du wizard de config AAP) : on la retire
    // ici, donc du sommaire du wizard comme du contenu — les deux dérivent de
    // ce même parse. Cf. `CoFormSubFormInputs.hideStep` pour les deux écarts
    // assumés avec le legacy (pas d'exemption admin, s'applique aussi à la
    // création).
    if (!options.includeHiddenSteps && isTruthyFlag(subFormData.hideStep)) return;

    const fields: FormFieldMapping[] = [];
    // Ordre d'affichage, capturé AU MOMENT DU PUSH depuis l'input brut.
    //
    // Le relire après coup par la clé du champ ne marche pas : un `multiDecide`
    // est réindexé sous le nom du type qu'il désigne (`decide` → `selection`),
    // et `getOriginalFieldKey` ne défait pas cette réindexation — le lookup
    // échouait donc en silence et retombait sur 0.
    const displayOrder = new Map<FormFieldMapping, number>();

    Object.entries(subFormData.inputs).forEach(([rawFieldKey, rawFieldData]) => {
      // Ignorer les anciens inputs de validation d'étape (validateStep*)
      if (/validatestep/i.test(rawFieldData.type)) return;

      // `hideInForm` : l'input est sorti du formulaire (legacy `step_v2.php:455`).
      // Statique — aucune notion d'utilisateur — donc tranché ici et pas côté
      // serveur : la donnée arrive déjà dans le payload, et d'autres vues la
      // consomment avec leurs propres règles (l'export PDF de `costum` réaffiche
      // justement `depense` et `budget` malgré le flag).
      if (isTruthyFlag(rawFieldData.hideInForm)) return;

      // Restriction serveur (`isAdminOnly`, listes place-level). Testée sur la
      // clé BRUTE, avant la résolution `multiDecide` qui réindexe : c'est cette
      // clé-là que le backend énumère. Même ordre que le legacy, qui coupe sur
      // `isAdminOnly` (l.358) avant de substituer le multiDecide (l.387).
      if (restricted.has(rawFieldKey)) return;

      // `multiDecide` est un placeholder : il désigne un autre type via
      // `inputConfig.multiDecide`, et l'input est RÉINDEXÉ sous la clé de ce
      // type. Sans config, il ne se rend pas du tout. Cf. `resolveMultiDecide`.
      const resolved = resolveMultiDecide(rawFieldKey, rawFieldData, formData.inputConfig);
      if (!resolved) return;
      const fieldKey = resolved.key;
      const fieldData = resolved.field;

      const componentType = mapCoFormTypeToComponentType(fieldData.type);
      
      // Récupérer les options depuis params si c'est un radio/checkbox
      let options: string[] | undefined;
      let optionLabels: Record<string, string> | undefined;
      let searchable: boolean | undefined;
      let positionType: "column" | "row" | undefined;
      let rowMode: "fixed" | "auto" | undefined;
      let nbPerRow: string | undefined;
      let multiCheckboxPlusConfig: FormFieldMapping["multiCheckboxPlusConfig"] | undefined;
      let evaluationConfig: EvaluationConfig | undefined;
      let commonTableConfig: CommonTableConfig | undefined;
      let uploaderConfig: UploaderConfig | undefined;
      
      if ((componentType === "radio" || componentType === "checkbox") && formData.params) {
        // Les clés dans params peuvent avoir des préfixes comme "radioNew" ou "checkboxNew"
        const possibleKeys = [
          fieldKey,
          `radioNew${fieldKey}`,
          `checkboxNew${fieldKey}`,
          `${componentType}New${fieldKey}`,
        ];
        
        for (const key of possibleKeys) {
          const paramData = formData.params[key];
          if (paramData?.list) {
            options = paramData.list;
            positionType = paramData.positionType;
            rowMode = paramData.rowMode;
            nbPerRow = paramData.nbPerRow;
            break;
          }
        }
      }

      // Options du `select` (legacy `select.php`) : lues dans
      // `params[fieldKey].options` SANS préfixe (contrairement à
      // radioNew/checkboxNew). Deux formes legacy possibles :
      //  - liste plate `["A", "B"]` (produite par l'UI admin du template) →
      //    value === label, pas d'`optionLabels`.
      //  - objet associatif `{cle: "Label"}` (format documenté côté
      //    dynamicFields) → la valeur stockée est la CLÉ, le label affiché
      //    est la valeur ; on garde donc les clés dans `options` et la
      //    correspondance dans `optionLabels` pour un round-trip fidèle.
      if (componentType === "select" && formData.params) {
        const selectParams = formData.params[fieldKey];
        const rawOptions = selectParams?.options;
        if (Array.isArray(rawOptions)) {
          options = rawOptions.map((o) => String(o));
        } else if (rawOptions && typeof rawOptions === "object") {
          const entries = Object.entries(rawOptions as Record<string, unknown>);
          options = entries.map(([k]) => k);
          optionLabels = Object.fromEntries(
            entries.map(([k, v]) => [k, String(v)])
          );
        }
        // Flag legacy `enableSelect2` → liste déroulante recherchable. Côté PHP
        // il est lu via `filter_var(..., FILTER_VALIDATE_BOOLEAN)`, ce que
        // `isTruthyFlag` réplique. `undefined` plutôt que `false` quand c'est
        // faux : la prop reste absente au lieu d'être explicitement désactivée.
        searchable = isTruthyFlag(selectParams?.enableSelect2) ? true : undefined;
      }

      // Config spécifique pour multiRadio
      let multiRadioConfig: FormFieldMapping["multiRadioConfig"] | undefined;

      if (componentType === "multiRadio" && formData.params) {
        const paramKey = `multiRadio${fieldKey}`;
        const paramData = formData.params[paramKey];

        if (paramData) {
          // Options depuis global.list
          options = paramData.global?.list || paramData.list || [];

          // Construire tofill: type par option (simple par défaut)
          const tofill: Record<string, "simple" | "cplx"> = {};
          for (const opt of options) {
            tofill[opt] = (paramData.tofill?.[opt] as "simple" | "cplx") || "simple";
          }

          multiRadioConfig = {
            tofill,
            placeholdersradio: paramData.placeholdersradio || {},
          };
        }
      }

      // Config spécifique pour multiCheckboxPlus
      if (componentType === "multiCheckboxPlus" && formData.params) {
        const paramKey = `multiCheckboxPlus${fieldKey}`;
        const paramData = formData.params[paramKey];
        
        if (paramData) {
          // Options depuis global.list ou list
          options = paramData.global?.list || paramData.list || [];
          positionType = paramData.positionType;
          
          // Construire tofill: type par option (simple par défaut)
          const tofill: Record<string, MultiCheckboxPlusOptionType> = {};
          for (const opt of options) {
            tofill[opt] = (paramData.tofill?.[opt] as MultiCheckboxPlusOptionType) || "simple";
          }
          
          // Helper pour convertir "true"/"false" string en boolean
          const toBool = (val: unknown): boolean => val === true || val === "true";
          
          // Parser optimage: extraire les docPath de chaque option
          const optimage: Record<string, string[]> = {};
          if (paramData.optimage) {
            for (const [optKey, images] of Object.entries(paramData.optimage)) {
              if (Array.isArray(images)) {
                optimage[optKey] = images
                  .map((img: { docPath?: string }) => img.docPath)
                  .filter((path): path is string => !!path);
              }
            }
          }
          
          multiCheckboxPlusConfig = {
            tofill,
            optinfo: paramData.optinfo || {},
            optimage,
            placeholdersckb: paramData.placeholdersckb || {},
            nbAnswersMax: paramData.global?.nbAnswersMax || 20,
            rank: toBool(paramData.global?.rank),
            mandatoryCplx: paramData.mandatoryCplx !== false,
            validateCplxRequired: paramData.validateCplxRequired !== false && paramData.mandatoryCplx !== false,
            addValue: toBool(paramData.global?.addValue),
            newValuePlaceholder: paramData.global?.newValuePlaceholder || "Nouvelle valeur",
          };
        }
      }

      // Config spécifique pour commonTable (calculateur de bonheur — commonTableV2)
      if (componentType === "commonTable" && formData.params) {
        const params = formData.params as unknown as Record<string, unknown>;
        const rawConfig = params[`config${fieldKey}`] as Record<string, unknown> | undefined;
        const rawLabels = params[`columnLabel${fieldKey}`] as Record<string, unknown> | undefined;
        const rawCriterias = params[`criterias${fieldKey}`] as Record<string, { label?: string; group?: string }> | undefined;

        // Conversion d'un flag PHP (string "true"/"false" ou boolean) — défaut true.
        const flag = (v: unknown): boolean =>
          v === undefined || v === null ? true : v === true || v === "true";

        // Variante stricte (défaut false) : la colonne n'apparaît que si la
        // config admin l'active explicitement. Utilisé pour `yesNo` qui est
        // caché par défaut côté legacy (cf. typo `yesNoColumnnnnn` ligne 599
        // de `commonTableV2.php` qui rend la condition d'affichage toujours
        // fausse — alignement sur l'intention legacy).
        const strictFlag = (v: unknown): boolean => v === true || v === "true";

        // Le PHP nomme les colonnes de manières variées selon les versions ; on accepte
        // les alias les plus courants pour rester tolérant.
        const showColumns = {
          criteria: flag(rawConfig?.criteriaColumn ?? rawConfig?.criteria),
          happiness: flag(rawConfig?.humourColumn ?? rawConfig?.happinessColumn ?? rawConfig?.happiness),
          note: flag(rawConfig?.starColumn ?? rawConfig?.noteColumn ?? rawConfig?.note),
          yesNo: strictFlag(rawConfig?.yesNoColumn ?? rawConfig?.yesNo),
          comment: flag(rawConfig?.commentColumn ?? rawConfig?.comment),
        };

        const labels = {
          usage: (rawLabels?.usageColumn as string | undefined) ?? (rawLabels?.usage as string | undefined),
          criteria: (rawLabels?.criteriaColumn as string | undefined) ?? (rawLabels?.criteria as string | undefined),
          happiness: (rawLabels?.humourColumn as string | undefined) ?? (rawLabels?.happinessColumn as string | undefined),
          note: (rawLabels?.starColumn as string | undefined) ?? (rawLabels?.noteColumn as string | undefined),
          yesNo: (rawLabels?.yesNoColumn as string | undefined),
          comment: (rawLabels?.commentColumn as string | undefined),
        };

        // criterias est typiquement un Record<usageKey, { label, group? }>
        const usages: CommonTableConfig["usages"] = [];
        if (rawCriterias && typeof rawCriterias === "object") {
          for (const [usageKey, raw] of Object.entries(rawCriterias)) {
            const label = typeof raw === "string" ? raw : raw?.label || usageKey;
            const group = typeof raw === "object" ? raw?.group : undefined;
            usages.push({ usageKey, label, group });
          }
        }

        commonTableConfig = { showColumns, labels, usages };
      }

      // Config spécifique pour categorizedCheckbox (cases à cocher à deux niveaux).
      // Bloc unique `params.categorizedCheckbox{fieldKey}` (patron multiCheckboxPlus).
      let categorizedCheckboxConfig: CategorizedCheckboxConfig | undefined;
      if (componentType === "categorizedCheckbox") {
        const paramData = (formData.params?.[`categorizedCheckbox${fieldKey}`] ?? {}) as Record<string, unknown>;

        // `formParamsSource` est la sortie d'un finder legacy : une MAP id → {name, type…}.
        // Seules les clés (les ids de formulaire) nous servent.
        const sourceRaw = paramData.formParamsSource;
        const formParamsSource =
          sourceRaw && typeof sourceRaw === "object" && !Array.isArray(sourceRaw)
            ? Object.keys(sourceRaw as Record<string, unknown>)
            : [];

        // Défaut "both" quand la clé est absente — cf. `categorizedCheckbox.php:17`.
        const rawMode = paramData.dataSourceToUse;
        const dataSourceToUse: CategorizedCheckboxSource =
          rawMode === "manual" || rawMode === "distanceOnly" || rawMode === "both" ? rawMode : "both";

        const rawSublist = paramData.sublist;
        const sublist: Record<string, string[]> = {};
        if (rawSublist && typeof rawSublist === "object") {
          for (const [k, v] of Object.entries(rawSublist as Record<string, unknown>)) {
            if (Array.isArray(v)) sublist[k] = v.map(String);
          }
        }

        categorizedCheckboxConfig = {
          dataSourceToUse,
          list: Array.isArray(paramData.list) ? (paramData.list as unknown[]).map(String) : [],
          sublist,
          formParamsSource,
          questionsParamsSource: Array.isArray(paramData.questionsParamsSource)
            ? (paramData.questionsParamsSource as unknown[]).map(String)
            : [],
        };
      }

      // Config spécifique pour evaluation
      if (componentType === "evaluation" && formData.params) {
        // Pattern racine : params["categoriesXXX"], params["criteriasXXX"], etc.
        // L'index signature `[k: string]: unknown` de CoFormFieldConfig retourne
        // `unknown` pour ces clés non-typées → narrow via cast au call-site.
        const params = formData.params;
        const categories = params[`categories${fieldKey}`];
        const criterias = params[`criterias${fieldKey}`];
        const criteriaLabel = params[`criteriaLabel${fieldKey}`];
        const categoryNumber = params[`categoryNumber${fieldKey}`];
        const categoryTitle = params[`categoryTitle${fieldKey}`];
        const multiVotePerLine = params[`multiVotePerLine${fieldKey}`];
        const voteType = params[`voteType${fieldKey}`];
        
        // Casts `as unknown as TargetType` : idiom TS standard pour accès via
        // une clé non explicite de l'index signature. Le narrow runtime est
        // assuré par les fallbacks `|| defaultValue`.
        evaluationConfig = {
          categories: (categories as unknown as EvaluationConfig["categories"]) || {},
          criterias: (criterias as unknown as Record<string, { name: string; coeff: number }>) || {},
          criteriaLabel: (criteriaLabel as unknown as string) || "Critères",
          categoryNumber: (categoryNumber as unknown as number) || 1,
          categoryTitle: (categoryTitle as unknown as string) || "Catégories",
          multiVotePerLine: (multiVotePerLine as unknown as boolean) || false,
          voteType: ((voteType as unknown as string) || "colour") as EvaluationConfig["voteType"],
          colours: { OK: "#9fbd38", NotOK: "#D7193B" },
        };
      }

      // Variable pour stocker la config finder
      let finderConfig: FinderConfig | undefined;

      // Config spécifique pour finder
      if (componentType === "finder" && formData.params) {
        // Les données sont dans params.finder{fieldKey}
        const paramKey = `finder${fieldKey}`;
        const paramData = formData.params[paramKey];

        if (paramData) {
          // Parser les filtres — `filter` est typé `Record<string, {attributeName?, valueName?}>`
          // dans CoFormFieldConfig, plus de cast nécessaire.
          const filters: FinderFilter[] = [];
          if (paramData.filter && typeof paramData.filter === "object") {
            Object.values(paramData.filter).forEach((f) => {
              if (f.attributeName && f.valueName) {
                filters.push({ attributeName: f.attributeName, valueName: f.valueName });
              }
            });
          }

          // Filtres d'exclusion (`$nin`) — symétrique à `filter`. Appliqués par
          // le builder partagé `buildFinderMongoFilters` sur les deux chemins de
          // recherche du finder.
          const excludeFilters: FinderFilter[] = [];
          if (paramData.filterExclude && typeof paramData.filterExclude === "object") {
            Object.values(paramData.filterExclude).forEach((f) => {
              if (f.attributeName && f.valueName) {
                excludeFilters.push({ attributeName: f.attributeName, valueName: f.valueName });
              }
            });
          }

          // Helper pour convertir "true"/"false" string en boolean
          const toBool = (val: unknown): boolean => val === true || val === "true";

          finderConfig = {
            type: (paramData.type as FinderConfig["type"]) || "organizations",
            filters,
            excludeFilters,
            notSourceKey: toBool(paramData.notSourceKey ?? true),
            myContacts: toBool(paramData.myContacts),
            initCurrentUser: toBool(paramData.initCurrentUser),
            elementLabel: (paramData.elementLabel as string) || "Élément",
            buttonLabel: (paramData.buttonLabel as string) || "Rechercher et ajouter",
            placeholderSearchField: (paramData.placeholderSearchField as string) || "Entrez le nom de l'élément recherché",
            field: (paramData.field as string) || "element",
            multiple: toBool(paramData.multiple ?? true),
            addNew: toBool(paramData.addNew),
            invite: toBool(paramData.invite),
            linkToAnswer: toBool(paramData.linkToAnswer),
            singleAnswerPerElement: toBool(paramData.singleAnswerPerElement),
            msgSingleAnswerPerElement: (paramData.msgSingleAnswerPerElement as string) || "",
            redirectSingleAnswerPerElement: (paramData.redirectSingleAnswerPerElement as FinderConfig["redirectSingleAnswerPerElement"]) || "Accueil",
            editElement: toBool(paramData.editElement),
            addToLinks: {
              value: toBool((paramData.addToLinks as { value?: unknown })?.value),
              links: ((paramData.addToLinks as { links?: string })?.links as string) || "",
            },
          };
        }
      }

      // Config spécifique pour simpleTable
      let simpleTableConfig: SimpleTableConfig | undefined;

      if (componentType === "simpleTable" && formData.params) {
        const paramKey = `simpleTable${fieldKey}`;
        const paramData = formData.params[paramKey] || formData.params[fieldKey];

        if (paramData) {
          const toBool = (val: unknown): boolean => val === true || val === "true";

          const columns: SimpleTableColumn[] = [];
          if (Array.isArray(paramData.columns)) {
            for (const col of paramData.columns) {
              columns.push({
                label: col.label || "",
                type: (col.type as SimpleTableColumn["type"]) || "Text",
              });
            }
          } else if (paramData.columns && typeof paramData.columns === "object") {
            for (const col of Object.values(paramData.columns)) {
              columns.push({
                label: col.label || "",
                type: (col.type as SimpleTableColumn["type"]) || "Text",
              });
            }
          }

          const rows: SimpleTableRow[] = [];
          if (Array.isArray(paramData.rows)) {
            for (const row of paramData.rows) {
              rows.push({ label: row.label || "" });
            }
          } else if (paramData.rows && typeof paramData.rows === "object") {
            for (const row of Object.values(paramData.rows)) {
              rows.push({ label: row.label || "" });
            }
          }

          simpleTableConfig = {
            tableName: (paramData.tableName as string) || "Titre",
            columns,
            rows,
            activeNewLine: toBool(paramData.activeNewLine),
            singleAnswerByLine: toBool(paramData.singleAnswerByLine),
            editInModal: toBool(paramData.editInModal),
          };
        }
      }

      // Config spécifique pour sectionTitle
      let sectionTitleConfig: FormFieldMapping["sectionTitleConfig"] | undefined;

      if (componentType === "sectionTitle") {
        const p = formData.params?.[fieldKey] || {};
        sectionTitleConfig = {
          showBar: p.showBar !== false && p.showBar !== "false",
          barPosition: (["above", "between", "below"].includes(p.barPosition as string) ? p.barPosition : "between") as "above" | "between" | "below",
          align: (["left", "center", "right"].includes(p.align as string) ? p.align : "center") as "left" | "center" | "right",
          textDecoration: (["uppercase", "lowercase", "capitalize", "none"].includes(p.textDecoration as string) ? p.textDecoration : "uppercase") as "uppercase" | "lowercase" | "capitalize" | "none",
        };
      }

      // Config spécifique pour tags — vocabulaire partagé du formulaire.
      // Le legacy accumule les tags saisis dans `form.params.<key>.list`
      // (`PushTagsAction`) et suggère depuis cette liste (`SearchTagsAction`).
      // `params` étant déjà chargé avec le form, la liste est disponible sans
      // aucune requête. Liste absente/vide → le champ retombe sur l'index
      // global (`api.searchTags`), qui est la branche non-aap du legacy.
      let tagsConfig: FormFieldMapping["tagsConfig"] | undefined;

      if (componentType === "tags") {
        const rawList = (formData.params?.[fieldKey] as { list?: unknown } | undefined)?.list;
        const list = Array.isArray(rawList)
          ? rawList.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
          : [];
        tagsConfig = { list };
      }

      // Config spécifique pour uploader
      if (componentType === "uploader") {
        const paramsData = formData.params?.[fieldKey] || {};
        const uploaderData = (fieldData as unknown as { uploader?: Record<string, unknown> }).uploader || {};

        const itemLimitRaw = paramsData?.itemLimit ?? uploaderData?.itemLimit;
        const sizeLimitRaw = paramsData?.sizeLimit ?? uploaderData?.sizeLimit;
        const formatsRaw = paramsData?.fileType ?? uploaderData?.formats;
        const docTypeRaw = (uploaderData?.docType as string | undefined) || "image";
        const displayModeRaw = (paramsData?.displayMode as string | undefined) ?? (uploaderData?.displayMode as string | undefined);

        const itemLimit = Number.isFinite(Number(itemLimitRaw)) ? Math.max(1, Number(itemLimitRaw)) : 5;
        const sizeLimit = Number.isFinite(Number(sizeLimitRaw)) ? Number(sizeLimitRaw) : 5000000;
        const formats: string[] | undefined = Array.isArray(formatsRaw)
          ? formatsRaw.map(String).filter(Boolean)
          : typeof formatsRaw === "string" && formatsRaw.trim()
            ? formatsRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
            : undefined;

        uploaderConfig = {
          docType: docTypeRaw === "file" ? "file" : "image",
          itemLimit,
          sizeLimit,
          formats,
          displayMode: displayModeRaw === "advanced" ? "advanced" : "simple",
        };
      }

      // Config spécifique pour timeSlots — params legacy `timeSlots{fieldKey}`
      // (valeurs numériques stockées en string par le PHP → coercion ici).
      let timeSlotsConfig: TimeSlotsConfig | undefined;

      if (componentType === "timeSlots") {
        const paramData = (formData.params as Record<string, unknown> | undefined)?.[`timeSlots${fieldKey}`] as Record<string, unknown> | undefined ?? {};
        const step = Number(paramData.minuteStep);
        timeSlotsConfig = {
          enableMultipleSlots: paramData.enableMultipleSlots !== false && paramData.enableMultipleSlots !== "false",
          timeFormat: paramData.timeFormat === "12h" ? "12h" : "24h",
          minuteStep: Number.isFinite(step) && step > 0 ? step : 15,
          defaultStartTime: typeof paramData.defaultStartTime === "string" ? paramData.defaultStartTime : undefined,
          defaultEndTime: typeof paramData.defaultEndTime === "string" ? paramData.defaultEndTime : undefined,
        };
      }

      // Config spécifique pour dynamicFields — params legacy `dynamicFields{fieldKey}`.
      let dynamicFieldsConfig: DynamicFieldsConfig | undefined;

      if (componentType === "dynamicFields") {
        const paramData = (formData.params as Record<string, unknown> | undefined)?.[`dynamicFields${fieldKey}`] as Record<string, unknown> | undefined;
        const rawFields = paramData?.fieldsConfig;
        if (paramData && Array.isArray(rawFields) && rawFields.length > 0) {
          const toInt = (v: unknown, fallback: number): number => {
            const n = Number(v);
            return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
          };
          const layout = paramData.layout as Record<string, unknown> | undefined;
          const ui = paramData.ui as Record<string, unknown> | undefined;
          dynamicFieldsConfig = {
            enableMultipleRows: paramData.enableMultipleRows === true || paramData.enableMultipleRows === "true",
            minRows: toInt(paramData.minRows, 1),
            maxRows: Math.max(1, toInt(paramData.maxRows, 10)),
            fieldsConfig: rawFields.map((f: Record<string, unknown>) => ({
              key: String(f.key ?? ""),
              label: String(f.label ?? ""),
              placeholder: typeof f.placeholder === "string" ? f.placeholder : undefined,
              type: String(f.type ?? "text"),
              required: f.required === true || f.required === "true",
              validation: f.validation && typeof f.validation === "object"
                ? {
                    minLength: toInt((f.validation as Record<string, unknown>).minLength, 0) || undefined,
                    maxLength: toInt((f.validation as Record<string, unknown>).maxLength, 0) || undefined,
                  }
                : undefined,
              options: f.options && typeof f.options === "object" && !Array.isArray(f.options)
                ? Object.fromEntries(Object.entries(f.options as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
                : undefined,
            })).filter((f) => f.key),
            layout: {
              fieldsPerRow: Math.min(6, Math.max(1, toInt(layout?.fieldsPerRow, 3))),
              showLabels: layout?.showLabels !== false && layout?.showLabels !== "false",
              showPlaceholders: layout?.showPlaceholders !== false && layout?.showPlaceholders !== "false",
            },
            ui: {
              addButtonText: typeof ui?.addButtonText === "string" ? ui.addButtonText : undefined,
              removeButtonText: typeof ui?.removeButtonText === "string" ? ui.removeButtonText : undefined,
            },
          };
        }
      }

      // Déterminer le type HTML pour les inputs texte. On accepte les
      // types courts (`email`, `url`, `tel`, `number`) ET les templates
      // legacy à input typé (`tpls.forms.emailUser` → `email`).
      const inputType: string | undefined = (() => {
        if (componentType !== "text") return undefined;
        if (fieldData.type === "tpls.forms.emailUser") return "email";
        if (["url", "email", "tel", "number", "date", "time", "datetime-local"].includes(fieldData.type)) return fieldData.type;
        return undefined;
      })();

      // Parser conditionalDisplay si présent
      const conditionalDisplay = fieldData.conditionalDisplay as ConditionalDisplay | undefined;

      // Flags multi-eval (uniquement pour les inputs `radioNew`).
      // Lus directement sur l'input (pas via params, contrairement aux options).
      // Sans ce parse, les flags du type restent toujours `undefined` →
      // `subFormHasMultieval()` renvoie false et le storage user-spécifique
      // (`_multiEval.{userId}`) n'est jamais déclenché.
      const fieldDataWithMultiEval = fieldData as unknown as {
        activeMultieval?: boolean | string;
        evaluationKey?: string;
      };
      const activeMultieval =
        componentType === "radio"
          ? fieldDataWithMultiEval.activeMultieval === true ||
            fieldDataWithMultiEval.activeMultieval === "true"
          : false;
      const evaluationKey =
        componentType === "radio" ? fieldDataWithMultiEval.evaluationKey : undefined;

      const mapping: FormFieldMapping = {
        // Appliquer le préfixe selon le type (finder, multiCheckboxPlus, evaluation)
        name: getFieldNameWithPrefix(componentType, fieldKey),
        label: fieldData.label || "",
        type: fieldData.type,
        componentType,
        inputType,
        placeholder: fieldData.placeholder,
        info: fieldData.info,
        isRequired: fieldData.isRequired || false,
        width: parseBootstrapWidth(fieldData.width),
        // Éditeur markdown ACTIF PAR DÉFAUT sur les textarea : seule une
        // désactivation explicite le retire.
        //
        // Relevé sur le parc : 754 textarea, dont **aucun** ne porte
        // `enableMarkdown: true` et **un seul** le porte à `false`. L'option
        // n'avait donc jamais servi, et inverser le défaut fait basculer 753
        // champs — c'est voulu, pas un effet de bord.
        //
        // La chaîne `"false"` est traitée comme `false` : le parc stocke
        // volontiers ses booléens en chaînes (cf. `activateLocalCriteria`), et
        // une valeur écrite ainsi demain doit désactiver, pas activer.
        markdown: fieldData.enableMarkdown !== false && fieldData.enableMarkdown !== "false",
        options,
        optionLabels,
        searchable,
        positionType: positionType || formData.params?.[fieldKey]?.positionType,
        rowMode: rowMode || formData.params?.[fieldKey]?.rowMode,
        nbPerRow: nbPerRow || formData.params?.[fieldKey]?.nbPerRow,
        multiCheckboxPlusConfig,
        multiRadioConfig,
        evaluationConfig,
        commonTableConfig,
        categorizedCheckboxConfig,
        finderConfig,
        simpleTableConfig,
        uploaderConfig,
        timeSlotsConfig,
        dynamicFieldsConfig,
        sectionTitleConfig,
        tagsConfig,
        conditionalDisplay,
        activeMultieval,
        evaluationKey,
      };
      fields.push(mapping);
      displayOrder.set(mapping, resolveInputOrder(rawFieldData, subFormData.formParent));
    });

    // Tri STABLE (garanti depuis ES2019) : à position égale, l'ordre de
    // déclaration est conservé — c'est ce qui tient les deux inputs à
    // `positions = "1"` de l'étape 2 des tiers-lieux dans leur ordre d'origine.
    fields.sort((a, b) => (displayOrder.get(a) ?? 0) - (displayOrder.get(b) ?? 0));

    subFormsFields.push({
      subFormId,
      subFormName: subFormData.name,
      fields,
    });
  });

  return subFormsFields;
}

/**
 * Génère un schéma Zod dynamique basé sur les champs CoForm
 */
/**
 * URL tolérante : schéma http(s) optionnel, host.tld[:port] requis, chemin/query/
 * fragment optionnels. Accepte les URL sans schéma (ex. "exemple.dokos.fr").
 * Volontairement permissive — on débloque la saisie, pas un parseur RFC strict.
 */
const LENIENT_URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(:\d+)?([/?#]\S*)?$/i;

/**
 * Traducteur injecté dans `generateZodSchema` pour l'i18n des messages de
 * validation. Signature compatible avec `useT` : (clé, fallback?, params?). Le
 * défaut renvoie le fallback français → schéma utilisable hors React (tests).
 */
type ZodMessageT = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

export function generateZodSchema(
  subFormsFields: SubFormFields[],
  t: ZodMessageT = (_key, fallback) => fallback ?? "",
) {
  const schemaShape: Record<string, z.ZodTypeAny> = {};

  subFormsFields.forEach(({ fields }) => {
    fields.forEach((field) => {
      switch (field.componentType) {
        case "text":
        case "textarea": {
          // Validation de format URL (tolérante) uniquement pour inputType "url".
          // Ne s'applique JAMAIS à une valeur vide : un champ non requis laissé
          // vide reste valide ; un champ requis vide est déjà rejeté par min(1).
          if (field.componentType === "text" && field.inputType === "url") {
            const isUrlOrEmpty = (v: string) => v === "" || LENIENT_URL_RE.test(v);
            const msg = t("coform.validation.urlInvalid", `${field.label} doit être une URL valide`, { label: field.label });
            schemaShape[field.name] = field.isRequired
              ? z.string().min(1, t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label })).refine(isUrlOrEmpty, msg)
              : z.string().refine(isUrlOrEmpty, msg).optional();
          } else {
            schemaShape[field.name] = field.isRequired
              ? z.string().min(1, t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }))
              : z.string().optional();
          }
          break;
        }

        case "radio":
          if (field.options && field.options.length > 0) {
            // `error` (Zod v4) traduit l'échec de l'enum. Via l'UI radio le seul
            // échec possible d'un champ requis est « rien sélectionné » (valeur
            // "" hors options) → message "requis". Le cas non requis ("" accepté
            // par la branche literal de l'union) ne déclenche jamais ce message.
            const enumSchema = z.enum(field.options as [string, ...string[]], {
              error: t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }),
            });
            schemaShape[field.name] = field.isRequired
              ? enumSchema
              : z.union([enumSchema, z.literal("")]).optional();
          } else {
            schemaShape[field.name] = field.isRequired
              ? z.string().min(1, t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }))
              : z.string().optional();
          }
          break;

        case "checkbox":
          schemaShape[field.name] = field.isRequired
            ? z.array(z.string()).min(1, t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }))
            : z.array(z.string()).optional();
          break;

        case "location": {
          // Adresse géolocalisée : objet composite { formLocality: FormLocalityEntry[], address, geo, geoPosition }.
          // « Requis » = au moins une adresse avec un `localityId` réel (gate backend `addressValid`).
          const hasLocality = (v: unknown) =>
            !!v &&
            typeof v === "object" &&
            Array.isArray((v as { formLocality?: unknown[] }).formLocality) &&
            (v as { formLocality: Array<{ address?: { localityId?: string } }> }).formLocality.some(
              (e) => e?.address?.localityId
            );
          schemaShape[field.name] = field.isRequired
            ? z.any().refine(hasLocality, {
                message: t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }),
              })
            : z.any().optional();
          break;
        }

        case "multiRadio": {
          // Structure: { value: string, type?: "simple"|"cplx", textsup?: string }
          const multiRadioSchema = z.object({
            value: z.string(),
            type: z.enum(["simple", "cplx"]).optional(),
            textsup: z.string().optional(),
          });
          schemaShape[field.name] = field.isRequired
            ? multiRadioSchema.refine(
                (v) => v.value.trim() !== "",
                { message: t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }) }
              )
            : multiRadioSchema.optional();
          break;
        }

        case "multiCheckboxPlus": {
          // Structure: [{ "Option": { value, type, rank?, textsup? } }]
          // Note: PHP peut stocker rank comme string ou number, on accepte les deux
          const baseSchema = z.array(z.record(z.string(), z.object({
            value: z.string(),
            type: z.enum(["simple", "cplx"]),
            rank: z.union([z.number(), z.string()]).optional().transform(v => 
              v !== undefined ? (typeof v === "string" ? parseInt(v, 10) || undefined : v) : undefined
            ),
            textsup: z.string().optional(),
          })));
          
          // Ajouter validation cplx required si activée
          const validateCplx = field.multiCheckboxPlusConfig?.validateCplxRequired;
          const tofill = field.multiCheckboxPlusConfig?.tofill || {};
          
          if (validateCplx) {
            const refinedSchema = baseSchema.refine((arr) => {
              return arr.every(item => {
                const key = Object.keys(item)[0];
                const data = item[key];
                // Vérifier si cette option est de type cplx
                if (data.type === "cplx" || tofill[key] === "cplx") {
                  return data.textsup && data.textsup.trim() !== "";
                }
                return true;
              });
            }, { message: t("coform.validation.multiCheckboxPlusCplxRequired", "Tous les champs complémentaires doivent être remplis") });
            
            schemaShape[field.name] = field.isRequired
              ? refinedSchema.min(1, t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }))
              : refinedSchema.optional();
          } else {
            schemaShape[field.name] = field.isRequired
              ? baseSchema.min(1, t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }))
              : baseSchema.optional();
          }
          break;
        }

        case "select":
          schemaShape[field.name] = field.isRequired
            ? z.string().min(1, t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }))
            : z.string().optional();
          break;

        case "evaluation": {
          // Structure: { [categoryPath]: { [criteriaId]: vote } }
          // vote peut être "OK", "", number, string (emoji)
          const evaluationSchema = z.record(
            z.string(), // categoryPath
            z.record(
              z.string(), // criteriaId
              z.union([z.string(), z.number(), z.literal("")]) // voteValue
            )
          );
          
          if (field.isRequired) {
            // Vérifier qu'au moins un vote a été fait
            schemaShape[field.name] = evaluationSchema.refine(
              (obj) => {
                // Au moins une entrée avec un vote non vide
                return Object.values(obj).some(criteria => 
                  Object.values(criteria).some(vote => vote !== "" && vote !== 0)
                );
              },
              { message: t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }) }
            );
          } else {
            schemaShape[field.name] = evaluationSchema.optional();
          }
          break;
        }

        case "commonTable": {
          // Valeur composite : { scores: Record<criteriaId, ...>, myCatalog: Record<criteriaId, ...> }
          const happinessEnum = z.enum(["", "love", "happySmile", "neutral", "sad", "cry"]);
          // Même message pour les deux bornes (une seule clé `noteRange`) : on
          // l'évalue une fois pour ne pas répéter l'appel `t`.
          const noteRangeMsg = t("coform.validation.noteRange", "La note doit être comprise entre 0 et 5");
          const solutionSchema = z.object({
            criteriaId: z.string(),
            criteria: z.string(),
            usage: z.string(),
            usageKey: z.string(),
            note: z.number().min(0, noteRangeMsg).max(5, noteRangeMsg),
            happiness: happinessEnum,
            yesOrNo: z.boolean(),
            comment: z.string(),
          });
          const myCatalogEntrySchema = z.object({
            label: z.string().optional(),
            usage: z.string(),
            usageKey: z.string(),
            coeff: z.number().optional(),
            // Métadonnées préservées depuis la BDD — posées par le backend au
            // save (cf. SaveAnswerAction::enrichCommonTableCriteriaEntries).
            me: z.boolean().optional(),
            userId: z.string().optional(),
            fromAnswerId: z.string().optional(),
          });
          const commonTableSchema = z.object({
            scores: z.record(z.string(), solutionSchema),
            myCatalog: z.record(z.string(), myCatalogEntrySchema),
          });

          if (field.isRequired) {
            schemaShape[field.name] = commonTableSchema.refine(
              (v) =>
                Object.values(v.scores).some(
                  (sol) =>
                    sol.happiness !== "" ||
                    sol.note > 0 ||
                    sol.yesOrNo ||
                    sol.comment.trim() !== ""
                ),
              { message: t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }) }
            );
          } else {
            schemaShape[field.name] = commonTableSchema.optional();
          }
          break;
        }

        case "categorizedCheckbox": {
          // Valeur composite `{ list, sublist }` — les DEUX clés doivent figurer ici : `z.object`
          // strip tout ce qui n'est pas déclaré, et le formulaire mono-étape soumet la sortie
          // zod-parsée. Une `sublist` non déclarée serait effacée à la soumission, en silence.
          const categorizedSchema = z.object({
            list: z.array(z.string()),
            sublist: z.record(z.string(), z.array(z.string())),
          });

          if (field.isRequired) {
            schemaShape[field.name] = categorizedSchema.refine(
              (v) => v.list.length > 0,
              { message: t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }) }
            );
          } else {
            schemaShape[field.name] = categorizedSchema.optional();
          }
          break;
        }

        case "finder": {
          // Structure: { [elementId]: { id, name, type, img?, email?, address? } }
          const finderElementSchema = z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            img: z.string().optional(),
            email: z.string().optional(),
            address: z.object({
              streetAddress: z.string().optional(),
              postalCode: z.string().optional(),
              addressLocality: z.string().optional(),
            }).optional(),
          });
          
          const finderSchema = z.record(z.string(), finderElementSchema).nullable();
          
          if (field.isRequired) {
            // Vérifier qu'au moins un élément est sélectionné
            schemaShape[field.name] = finderSchema.refine(
              (obj) => obj !== null && Object.keys(obj).length > 0,
              { message: t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }) }
            );
          } else {
            schemaShape[field.name] = finderSchema.optional();
          }
          break;
        }

        case "simpleTable": {
          // Structure: tableau 2D — row 0 = headers, row 1+ = données
          const simpleTableSchema = z.array(z.array(z.any()));

          if (field.isRequired) {
            schemaShape[field.name] = simpleTableSchema.refine(
              (arr) => arr.length >= 2,
              { message: t("coform.validation.simpleTableRequired", `${field.label} est requis (au moins une ligne de données)`, { label: field.label }) }
            );
          } else {
            schemaShape[field.name] = simpleTableSchema.optional();
          }
          break;
        }

        case "milestoneList":
          // Piloté par react-hook-form et persisté À LA SOUMISSION, comme les
          // autres champs (ce n'était pas le cas : le composant écrivait
          // directement au serveur et ne réécrivait jamais la valeur RHF, si
          // bien qu'une soumission postérieure écrasait les ajouts).
          //
          // ⚠️ `z.any()` par ligne est DÉLIBÉRÉ : une dépense réelle porte des
          // clés hors contrat (`financer[]`, `historique[]`, `milestone`…) que
          // le champ n'édite pas. Un `z.object` nu les stripperait, et comme le
          // backend remplace la clé en bloc, soumettre sans toucher aux dépenses
          // détruirait la donnée en base — le piège déjà rencontré sur
          // `timeSlots`. Cf. `utils/depense.ts`.
          schemaShape[field.name] = z.array(z.any()).optional();
          break;

        case "uploader": {
          const uploaderSchema = z.union([
            z.array(z.any()),
            z.object({
              updateDate: z.array(z.string()),
              files: z.union([z.array(z.any()), z.record(z.string(), z.string())]).optional(),
              // Trace TRANSITOIRE des fichiers retirés (suppression différée). DOIT
              // figurer dans le schéma : sinon z.object la strip à la validation du
              // submit (path single-step DynamicCoForm) → la réconciliation ne peut
              // plus supprimer un legacy non-en-map. Strippée au save par la mutation.
              deletedDocIds: z.array(z.string()).optional(),
            }),
          ]);
          schemaShape[field.name] = field.isRequired
            ? uploaderSchema.refine(
                (v) => (Array.isArray(v) ? v.length > 0 : true),
                t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label })
              )
            : uploaderSchema.optional();
          break;
        }

        case "tags": {
          // Tableau de libellés libres. Le legacy stocke
          // `$("#key").val().split(",")` → toujours un array de strings.
          const tagsSchema = z.array(z.string());
          schemaShape[field.name] = field.isRequired
            ? tagsSchema.min(1, t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }))
            : tagsSchema.optional();
          break;
        }

        // Séparateur décoratif : AUCUNE entrée dans le schéma.
        //
        // ⚠️ `isRequired: true` est posé sur 57 des 78 `titleSeparator` du parc
        // alors que l'input ne produit aucune valeur (le template legacy ne rend
        // qu'un titre). Le traiter comme un champ requis rendrait ces
        // formulaires **impossibles à soumettre**. L'absence de clé est donc
        // délibérée — et pas un oubli : `z.object` strippe la clé au parse,
        // exactement ce qu'on veut ici.
        case "titleSeparator":
          break;
        // ⚠️ ABSENCE DÉLIBÉRÉE, et c'est une protection de données.
        //
        // `answers.<étape>.selection` est un objet indexé par ÉVALUATEUR, et
        // `SaveAnswerAction` ne deep-merge que les clés suffixées `_multiEval`
        // (`:214`) : toute autre clé est REMPLACÉE en bloc. Déclarer `selection`
        // ici la ferait soumettre avec le formulaire, et chaque enregistrement
        // effacerait les notes de tous les autres évaluateurs — 654 réponses
        // concernées en base.
        //
        // Le champ écrit lui-même, par chemin ciblé, comme le legacy.
        // Voir `actions/mutations/selection.ts`.
        // Idem pour `pourContre` : valeur scopée par évaluateur, écrite par
        // chemin ciblé, donc jamais soumise.
        case "selection":
        case "pourContre":
        case "aapEvaluation":
        case "chooseProposal":
          break;
        case "timeSlots": {
          // Structure: [{ day, startHour, startMinute, endHour, endMinute }]
          // (clés AmPm tolérées en lecture de données legacy 12h).
          // ⚠ `looseObject` OBLIGATOIRE : les slots réels portent des clés de PAYLOAD hors form —
          // `duree` sur 123/124 slots equipementsSportifs974, `prix` — écrites par l'import legacy
          // (Costumize.php:1061-1066) et que le legacy PRÉSERVE (« identité d'un créneau = jour +
          // horaires, duree/prix exclus »). Un `z.object` nu les strippait, et le form soumettant
          // la sortie zod-parsée, SOUMETTRE SANS TOUCHER aux créneaux détruisait la donnée en base
          // (le backend remplace le tableau en bloc) — même mécanisme que `sublist` (cf.
          // categorizedCheckbox plus bas).
          const slotSchema = z.looseObject({
            day: z.string(),
            startHour: z.string(),
            startMinute: z.string(),
            endHour: z.string(),
            endMinute: z.string(),
            startAmPm: z.string().optional(),
            endAmPm: z.string().optional(),
          });
          const slotsSchema = z
            .array(slotSchema)
            .refine((slots) => slots.every(isSlotComplete), {
              message: t("coform.validation.timeSlotIncomplete", "Chaque créneau doit avoir un jour, une heure de début et une heure de fin"),
            })
            .refine((slots) => slots.every(isSlotOrdered), {
              message: t("coform.validation.timeSlotOrder", "L'heure de fin doit être après l'heure de début"),
            });
          schemaShape[field.name] = field.isRequired
            ? slotsSchema.refine((slots) => slots.length > 0, {
                message: t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }),
              })
            : slotsSchema.optional();
          break;
        }

        case "dynamicFields": {
          // Structure: [{ cléSousChamp: valeur }] — les règles par sous-champ
          // (required/minLength/maxLength) viennent de la config admin.
          // ⚠ Une ligne ENTIÈREMENT vide est EXEMPTÉE des règles (et strippée à la soumission,
          // via .transform) : le composant sème `minRows` lignes vides NON supprimables — sans
          // l'exemption, un dynamicFields NON requis à sous-champs required rendait le form
          // INSOUMISSIBLE (cas réel : les 2 blocs du « Formulaire de créneau » SSBE, dont 40 %
          // des answers existantes n'ont pas le bloc partenaires). Le legacy saute les lignes
          // vides de la même façon.
          const subFields = field.dynamicFieldsConfig?.fieldsConfig ?? [];
          const isEmptyRow = (row: Record<string, string>) =>
            Object.values(row).every((v) => (v ?? "").trim() === "");
          const rowsSchema = z
            .array(z.record(z.string(), z.string()))
            .refine(
              (rows) =>
                rows.every((row) =>
                  isEmptyRow(row) || subFields.every((sub) => {
                    const value = (row[sub.key] ?? "").trim();
                    if (sub.required && value === "") return false;
                    if (value === "") return true;
                    if (sub.validation?.minLength && value.length < sub.validation.minLength) return false;
                    if (sub.validation?.maxLength && value.length > sub.validation.maxLength) return false;
                    return true;
                  }),
                ),
              { message: t("coform.validation.dynamicFieldsIncomplete", "Chaque ligne doit être complète et valide") },
            )
            .transform((rows) => rows.filter((row) => !isEmptyRow(row)));
          const minRows = field.dynamicFieldsConfig?.minRows ?? 1;
          schemaShape[field.name] = field.isRequired
            ? rowsSchema.refine((rows) => rows.length >= Math.max(1, minRows), {
                message: t("coform.validation.requiredField", `${field.label} est requis`, { label: field.label }),
              })
            : rowsSchema.optional();
          break;
        }

        default:
          schemaShape[field.name] = z.string().optional();
      }
    });
  });

  return z.object(schemaShape);
}

/**
 * Génère les valeurs par défaut pour react-hook-form
 */
export function generateDefaultValues(subFormsFields: SubFormFields[]): Record<string, unknown> {
  const defaultValues: Record<string, unknown> = {};

  subFormsFields.forEach(({ fields }) => {
    fields.forEach((field) => {
      switch (field.componentType) {
        case "text":
        case "textarea":
        case "radio":
        case "select":
          defaultValues[field.name] = field.isRequired ? "" : undefined;
          break;

        case "checkbox":
          defaultValues[field.name] = [];
          break;

        case "multiRadio":
          defaultValues[field.name] = { value: "" };
          break;

        case "multiCheckboxPlus":
          defaultValues[field.name] = [];
          break;

        case "evaluation":
          defaultValues[field.name] = {};
          break;

        case "commonTable":
          defaultValues[field.name] = { scores: {}, myCatalog: {} } satisfies CommonTableValue;
          break;

        case "finder":
          defaultValues[field.name] = null;
          break;

        // Valeur composite `{ list, sublist }`. Sans ce cas, le champ tombait
        // dans le `default` qui pose `""` — et le schéma, lui, attend un objet :
        // « Invalid input: expected object, received string » s'affichait sous le
        // champ dès l'ouverture d'un formulaire vierge. Le `.optional()` du
        // schéma ne rattrape rien, car `""` n'est pas `undefined` ; et pour un
        // champ requis (le cas courant) il n'y a même pas d'`optional`.
        case "categorizedCheckbox":
          defaultValues[field.name] = { list: [], sublist: {} } satisfies CategorizedCheckboxValue;
          break;

        case "simpleTable": {
          // Construire le tableau 2D initial depuis la config
          const config = field.simpleTableConfig;
          if (config) {
            const headers = [config.tableName, ...config.columns.map(c => c.label)];
            const dataRows = config.rows.map(row => {
              const cells: (string | string[])[] = [row.label];
              for (const col of config.columns) {
                cells.push(col.type === "Images" ? [] : "");
              }
              return cells;
            });
            defaultValues[field.name] = [headers, ...dataRows];
          } else {
            defaultValues[field.name] = [];
          }
          break;
        }

        case "uploader":
        case "milestoneList":
        case "timeSlots":
        case "dynamicFields":
          defaultValues[field.name] = [];
          break;

        case "tags":
          defaultValues[field.name] = [];
          break;

        // Aucune valeur ne doit entrer dans l'état du formulaire (le `default`
        // ci-dessous poserait `""`, une clé fantôme que le submit remonterait) :
        //  - `titleSeparator` est purement décoratif ;
        //  - `selection` est un enjeu de DONNÉES — une clé remontée au submit
        //    remplacerait en bloc les notes de tous les évaluateurs. Cf. le
        //    switch du schéma, plus haut.
        case "titleSeparator":
        case "selection":
        case "pourContre":
        case "aapEvaluation":
        case "chooseProposal":
          break;

        default:
          defaultValues[field.name] = "";
      }
    });
  });

  return defaultValues;
}

// ============================================================================
// Helpers de coercion serveur (défense contre la pollution `{}` ↔ `[]`)
// ============================================================================

/**
 * Forme attendue par le schéma Zod d'un componentType donné. `"skip"` =
 * pas de coercion (le call-site est responsable, ex: uploader = union,
 * sectionTitle = sans valeur, commonTable = composite traité spécialement).
 */
type FieldShape = "string" | "array" | "record" | "skip";

function getFieldShape(componentType: FormFieldMapping["componentType"]): FieldShape {
  switch (componentType) {
    case "text":
    case "textarea":
    case "radio":
    case "select":
      return "string";
    case "checkbox":
    case "multiCheckboxPlus":
    case "simpleTable":
    case "tags":
    case "timeSlots": // tableaux d'objets (créneaux / lignes) : un `[]` vide
    case "dynamicFields": // encodé `{}` par le PHP doit redevenir array
      return "array";
    case "multiRadio":
    case "finder":
    case "evaluation":
      return "record";
    // Cas non triviaux : le shape attendu varie (uploader = union, sectionTitle
    // n'a pas de valeur, commonTable = composite split en deux clés top-level
    // gérées séparément). On laisse passer.
    default:
      return "skip";
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Retire `img` de chaque élément d'une valeur finder.
 *
 * L'image de profil n'est NI persistée NI lue depuis la réponse : une URL
 * figée au moment de la sélection se périme (l'élément peut changer d'avatar)
 * et désynchronise l'affichage du vrai élément. La source de vérité est
 * l'entité elle-même, résolue live à l'affichage (cf. `useFinderElementImages`,
 * même modèle que la page "lieux" qui lit `serverData.profilThumbImageUrl`).
 *
 * Appliqué des DEUX côtés du round-trip : à l'écriture (`denormalizeAnswerData`)
 * pour ne rien stocker, et à la lecture (`normalizeAnswerData`) pour ignorer
 * une `img` éventuellement présente dans une réponse ancienne. Pur (testable).
 */
function stripFinderElementImages(value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [id, el] of Object.entries(value)) {
    if (isPlainObject(el)) {
      const copy = { ...el };
      delete copy.img;
      out[id] = copy;
    } else {
      out[id] = el;
    }
  }
  return out;
}

/**
 * Enrichit une entry de `scores` legacy (commonTable) avec les champs
 * manquants. Le legacy pré-commonTableV2 stockait souvent uniquement
 * `{note: N}` par criteriaId — Zod attend les 8 champs. On comble avec
 * des défauts neutres. Le `criteriaId` est dérivé de la clé du Record
 * (la clé EST l'id, par convention) si l'entry ne le porte pas.
 *
 * `usagesIndex` (optionnel) : index `usageKey → {label}` issu de
 * `commonTableConfig.usages`. Convention legacy commonTableV2 : la
 * structure `params.criterias{fieldKey}` mappe criteriaId → row, donc
 * `usage.usageKey === criteriaId`. Quand un score legacy a un criteriaId
 * qui matche une row, on ré-ancre `usage`/`usageKey` depuis la config —
 * sinon le score reste bucketé en "sans usage" et invisible dans l'UI.
 */
const VALID_HAPPINESS = new Set(["", "love", "happySmile", "neutral", "sad", "cry"]);

function enrichCommonTableScores(
  raw: unknown,
  usagesIndex?: Map<string, { label: string }>,
): Record<string, unknown> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [criteriaId, entryRaw] of Object.entries(raw)) {
    const entry = isPlainObject(entryRaw) ? entryRaw : {};
    const happinessRaw = entry.happiness;
    const rowHit = usagesIndex?.get(criteriaId);
    const usage = typeof entry.usage === "string" && entry.usage !== ""
      ? entry.usage
      : rowHit?.label ?? "";
    const usageKey = typeof entry.usageKey === "string" && entry.usageKey !== ""
      ? entry.usageKey
      : rowHit
        ? criteriaId
        : "";
    out[criteriaId] = {
      criteriaId: typeof entry.criteriaId === "string" ? entry.criteriaId : criteriaId,
      criteria: typeof entry.criteria === "string" ? entry.criteria : "",
      usage,
      usageKey,
      note: typeof entry.note === "number" ? entry.note : 0,
      happiness: typeof happinessRaw === "string" && VALID_HAPPINESS.has(happinessRaw)
        ? happinessRaw
        : "",
      yesOrNo: typeof entry.yesOrNo === "boolean" ? entry.yesOrNo : false,
      comment: typeof entry.comment === "string" ? entry.comment : "",
    };
  }
  return out;
}

/**
 * Coerce un `coeff` legacy vers un `number` (ou `undefined` si non
 * interprétable). Le legacy `commonTableV2` stocke souvent le coefficient
 * via un input texte → la valeur arrive en string (`"1"`) et casse
 * `z.number().optional()` au submit. On convertit les strings numériques ;
 * tout le reste (string vide, NaN, objet…) retombe sur `undefined`
 * (champ optionnel → la valeur par défaut `1` est appliquée par l'UI).
 */
function coerceCoeff(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Enrichit `myCatalog` legacy avec les champs requis par Zod (`usage`,
 * `usageKey`) et coerce `coeff` (souvent stocké en string par le legacy)
 * vers un `number`. Les autres champs optionnels sont laissés tels quels.
 */
function enrichCommonTableMyCatalog(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [criteriaId, entryRaw] of Object.entries(raw)) {
    const entry = isPlainObject(entryRaw) ? entryRaw : {};
    out[criteriaId] = {
      ...entry,
      usage: typeof entry.usage === "string" ? entry.usage : "",
      usageKey: typeof entry.usageKey === "string" ? entry.usageKey : "",
      // `coeff` legacy parfois en string ("1") → number pour matcher Zod.
      coeff: coerceCoeff(entry.coeff),
    };
  }
  return out;
}

/**
 * Coerce une valeur reçue du serveur vers le shape attendu par le schéma
 * Zod. Conserve la valeur d'origine si elle est déjà du bon type ;
 * remplace par une valeur par défaut neutre seulement si la forme est
 * incompatible.
 */
function coerceValueToShape(value: unknown, shape: FieldShape): unknown {
  switch (shape) {
    case "string":
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      // `[]`, `{}`, `null`, `undefined` → ""
      return "";
    case "array":
      if (Array.isArray(value)) return value;
      // `{}` → `[]` ; null/undefined → laisser tel quel (le default form joue)
      if (isPlainObject(value)) return [];
      return value;
    case "record":
      // null préservé (certains schemas l'acceptent explicitement, ex: finder)
      if (value === null) return value;
      if (Array.isArray(value)) return {};
      if (isPlainObject(value)) return value;
      return value;
    default:
      return value;
  }
}

/**
 * Coerce les valeurs reçues du serveur pour qu'elles correspondent aux types
 * attendus par les schémas Zod du formulaire. Point unique de défense
 * contre la pollution de format causée par la sérialisation MongoDB
 * (`{}` ↔ `[]` ambigus selon les inputs PHP en amont).
 *
 * Couvre :
 * - **Champs nested** (radio, checkbox, select, multiRadio, multiCheckboxPlus,
 *   finder, simpleTable, text, textarea) sous `rawAnswers[subFormId][fieldName]`
 * - **Champs root-level** (evaluation, commonTable) sous `rawAnswers[fieldName]`
 *   et leur clé jumelle pour commonTable (`criteriasXXX`)
 *
 * Extensible : ajouter un cas dans `getFieldShape` si un nouveau type est
 * sensible à cette pollution.
 */
function coerceServerAnswerShape(
  rawAnswers: Record<string, unknown>,
  subFormsFields: SubFormFields[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawAnswers };

  for (const { subFormId, fields } of subFormsFields) {
    // Le subForm lui-même peut arriver comme `[]` si jamais aucun champ
    // n'a été rempli. On le ramène à `{}` pour pouvoir y accéder.
    let subData: Record<string, unknown>;
    if (isPlainObject(out[subFormId])) {
      subData = { ...(out[subFormId] as Record<string, unknown>) };
    } else if (Array.isArray(out[subFormId])) {
      subData = {};
    } else {
      subData = {};
    }

    for (const field of fields) {
      // commonTable : split en deux clés top-level (`yesOrNoXXX` et
      // `criteriasXXX`), tous deux Records. `field.name` est déjà
      // `yesOrNoXXX` (cf. FIELD_PREFIX_MAP).
      if (field.componentType === "commonTable") {
        const fieldKey = getOriginalFieldKey(field);
        const myCatalogKey = `criterias${fieldKey}`;
        if (Array.isArray(out[field.name])) out[field.name] = {};
        if (Array.isArray(out[myCatalogKey])) out[myCatalogKey] = {};
        continue;
      }

      // evaluation : root-level Record (un seul top-level key = field.name).
      if (field.componentType === "evaluation") {
        if (Array.isArray(out[field.name])) out[field.name] = {};
        continue;
      }

      // Champ nested : applique la coercion selon son shape attendu.
      const shape = getFieldShape(field.componentType);
      if (shape === "skip") continue;
      if (!(field.name in subData)) continue;
      const coerced = coerceValueToShape(subData[field.name], shape);
      if (coerced !== subData[field.name]) subData[field.name] = coerced;
    }

    out[subFormId] = subData;
  }

  return out;
}

/**
 * Indique si un sous-formulaire contient au moins un input multi-eval
 * (`activeMultieval === true`). Utilisé pour afficher le bouton "Voir les
 * évaluations" (radar) dans le header d'une step et conditionner le fetch
 * de `useMultiEvalData`.
 */
export function getStepHasMultiEval(subFormFields: SubFormFields): boolean {
  return subFormFields.fields.some((f) => f.activeMultieval === true);
}

/**
 * Normalise les données de réponse brutes depuis la DB vers le format attendu par le formulaire
 *
 * Le PHP stocke certains champs à la racine de `answers` au lieu de dans leur sous-formulaire :
 * - evaluation: answers["evaluationXXX"] au lieu de answers[subFormId]["evaluationXXX"]
 *
 * Cette fonction déplace ces champs dans leur sous-formulaire approprié en se basant
 * sur la structure du formulaire (subFormsFields).
 *
 * Applique d'abord `coerceServerAnswerShape` pour défendre contre les `{}` ↔ `[]`
 * inconsistants venant de la sérialisation MongoDB.
 *
 * @param rawAnswers - Données brutes depuis la DB (answers)
 * @param subFormsFields - Structure parsée du formulaire (pour connaître quel champ appartient à quel subform)
 * @returns Données normalisées avec les champs root-level déplacés dans leurs subforms
 */
export function normalizeAnswerData(
  rawAnswers: Record<string, unknown> | null | undefined,
  subFormsFields: SubFormFields[],
  currentUserId: string | null = null
): Record<string, unknown> | undefined {
  if (!rawAnswers) return undefined;

  // Copie profonde pour ne pas muter l'original
  const cloned = JSON.parse(JSON.stringify(rawAnswers)) as Record<string, unknown>;
  // Défense contre la pollution de format MongoDB (`{}` ↔ `[]`).
  const normalized = coerceServerAnswerShape(cloned, subFormsFields);

  // Debug: collecter les champs root-level attendus
  const rootLevelFieldNames: string[] = [];

  // Pour chaque subform, vérifier si des champs root-level doivent être déplacés
  for (const { subFormId, fields } of subFormsFields) {
    // Assurer que le subform existe dans normalized
    if (typeof normalized[subFormId] !== "object" || normalized[subFormId] === null) {
      normalized[subFormId] = {};
    }
    
    const subFormData = normalized[subFormId] as Record<string, unknown>;

    // Pour chaque champ root-level de ce subform
    for (const field of fields) {
      if (isRootLevelField(field.componentType)) {
        rootLevelFieldNames.push(field.name);

        // commonTable : valeur composite reconstruite depuis DEUX entrées root-level
        // (yesOrNo{key} pour les scores, criterias{key} pour le catalogue de l'utilisateur).
        // La coercion `[]` → `{}` est déjà faite par `coerceServerAnswerShape`
        // en amont, mais on garde la garde `isPlainObject` par défense en
        // profondeur (cas où la donnée arrive non normalisée pour une autre raison).
        if (field.componentType === "commonTable") {
          const fieldKey = getOriginalFieldKey(field);
          const scoresKey = `yesOrNo${fieldKey}`;
          const myCatalogKey = `criterias${fieldKey}`;
          const scoresRoot = normalized[scoresKey];
          const myCatalogRoot = normalized[myCatalogKey];
          // Index des rows pour ré-ancrer les scores legacy `{note}` sur
          // leur usageKey. Convention legacy : `params.criterias{key}` mappe
          // criteriaId → row, donc `usage.usageKey === criteriaId`. Sans
          // cet index, un score legacy `{criteria1688: {note:2}}` (pas
          // de `usage`/`usageKey` en base) reste bucketé en "sans usage"
          // et invisible dans l'UI.
          const usagesIndex = new Map<string, { label: string }>();
          for (const u of field.commonTableConfig?.usages ?? []) {
            usagesIndex.set(u.usageKey, { label: u.label });
          }
          // Enrichit chaque entry pour matcher le shape Zod strict (8 champs
          // requis). Les réponses legacy (pré-commonTableV2) ne stockaient
          // souvent que `{note: N}` par criteriaId — sans cet enrichment,
          // la validation Zod échoue au submit et empêche l'édition d'une
          // réponse contenant ces données héritées. Le `criteriaId` est
          // dérivé de la clé du Record (idiomatique : la clé EST l'id).
          subFormData[field.name] = {
            scores: enrichCommonTableScores(scoresRoot, usagesIndex),
            myCatalog: enrichCommonTableMyCatalog(myCatalogRoot),
          };
          // Retire les clés root-level pour éviter qu'un merge en aval (ex:
          // `{ ...generatedDefaults, ...normalizedDefaults }` dans
          // DynamicCoForm) écrase le composite par la shape brute serveur
          // (scores OU myCatalog seul) — Zod attend `{scores, myCatalog}`.
          delete normalized[scoresKey];
          delete normalized[myCatalogKey];
          continue;
        }

        // Le champ est stocké à la racine avec son nom (qui inclut déjà le préfixe)
        // Ex: field.name = "evaluationXXX", on cherche rawAnswers["evaluationXXX"]
        if (field.name in normalized && !(field.name in subFormData)) {
          // Déplacer le champ de la racine vers le subform
          subFormData[field.name] = normalized[field.name];
          // Optionnel: supprimer de la racine (on garde pour compatibilité)
          // delete normalized[field.name];
        }
      }

      // ── Multi-eval (radioNew + activeMultieval=true) ─────────────
      // La valeur d'un input multi-eval est PUREMENT user-spécifique : seule
      // l'entrée de l'user courant dans `{name}_multiEval.{userId}` doit
      // pré-remplir le RadioField. Toute valeur "classique" éventuellement
      // présente à `subFormData[field.name]` (héritage legacy ou résidu d'un
      // autre user) est IGNORÉE — sinon on pré-remplit avec une donnée qui
      // n'est pas celle de l'user courant.
      //
      // Conséquence voulue : si l'user n'a pas encore contribué à ce
      // multi-eval, le RadioField reste vide (au lieu de rejouer la valeur
      // d'un autre).
      if (field.componentType === "radio" && field.activeMultieval === true) {
        // 1) Toujours effacer la valeur classique (peu importe `currentUserId`).
        delete subFormData[field.name];

        // 2) Si on a un userId courant, extraire SA contribution.
        if (currentUserId) {
          const multiEvalRecord = subFormData[`${field.name}_multiEval`];
          if (
            multiEvalRecord &&
            typeof multiEvalRecord === "object" &&
            !Array.isArray(multiEvalRecord)
          ) {
            const entry = (multiEvalRecord as Record<string, unknown>)[currentUserId];
            if (entry && typeof entry === "object" && !Array.isArray(entry)) {
              const e = entry as { value?: unknown; answer?: unknown };
              let resolvedValue: string | undefined;
              // Priorité : `value` canonical (entrée nouvelle / migrée).
              if (typeof e.value === "string" && field.options?.includes(e.value)) {
                resolvedValue = e.value;
              }
              // Fallback : parsing legacy `"{idx}_{slug}"` via l'index préfixe.
              if (resolvedValue === undefined && typeof e.answer === "string") {
                const idx = parseInt(e.answer.split("_", 2)[0] ?? "", 10);
                if (
                  Number.isInteger(idx) &&
                  idx >= 0 &&
                  Array.isArray(field.options) &&
                  idx < field.options.length
                ) {
                  resolvedValue = field.options[idx];
                }
              }
              if (resolvedValue !== undefined) {
                subFormData[field.name] = resolvedValue;
              }
            }
          }
        }
      }

      // Finder : l'`img` n'est jamais lue depuis la réponse — elle se périme
      // (l'élément peut changer d'avatar) et est résolue live à l'affichage
      // (cf. useFinderElementImages). On la retire ici pour forcer la
      // résolution live, y compris pour les réponses anciennes qui en
      // stockaient une.
      if (field.componentType === "finder" && field.name in subFormData) {
        subFormData[field.name] = stripFinderElementImages(subFormData[field.name]);
      }
    }
  }

  return normalized;
}

/**
 * Dénormalise les données avant soumission au serveur
 * 
 * Effectue l'opération inverse de normalizeAnswerData :
 * déplace les champs root-level depuis leur sous-formulaire vers la racine
 * pour être compatible avec le format attendu par le PHP.
 * 
 * @param formData - Données du formulaire (depuis react-hook-form)
 * @param subFormsFields - Structure parsée du formulaire
 * @returns Données formatées pour le serveur PHP
 */
export function denormalizeAnswerData(
  formData: Record<string, unknown>,
  subFormsFields: SubFormFields[],
  currentUserId: string | null = null
): Record<string, unknown> {
  // Copie profonde pour ne pas muter l'original
  const denormalized = JSON.parse(JSON.stringify(formData)) as Record<string, unknown>;

  // Pour chaque subform, déplacer les champs root-level vers la racine
  for (const { subFormId, fields } of subFormsFields) {
    const subFormData = denormalized[subFormId] as Record<string, unknown> | undefined;
    if (!subFormData) continue;

    for (const field of fields) {
      // ── Multi-eval (radioNew + activeMultieval=true) ─────────────
      // Pack la valeur de l'user courant dans `{name}_multiEval.{userId}` au
      // format étendu `{ value, date, answer }`. Le backend a un deep-merge
      // pattern-based qui préserve les contributions des autres users — on
      // n'envoie donc QUE `{[currentUserId]: {...}}`, jamais les entrées des
      // autres (sûr face aux race conditions concurrentes).
      //
      // `date: "now"` est un sentinel (cf. legacy `radioNew.php`) : le backend
      // (`Coform::coerceAnswerDates` → `toMongoDate`) le convertit en vraie
      // MongoDate côté serveur. On NE met PAS `new Date().toISOString()` ici : (1) JSON ne
      // transporte pas de type Date → ce serait stocké en String, pas en
      // ISODate ; (2) l'horodatage doit faire autorité serveur (pas l'horloge
      // client) ; (3) garde la fonction déterministe (testable).
      if (
        field.componentType === "radio" &&
        field.activeMultieval === true &&
        currentUserId &&
        field.name in subFormData
      ) {
        const value = subFormData[field.name];
        if (typeof value === "string" && value !== "") {
          const idx = Array.isArray(field.options) ? field.options.indexOf(value) : -1;
          // idx === -1 si l'option a disparu de la liste entre-temps — le
          // radar ignore les valeurs hors range.
          const answer = `${idx}_${slugify(value)}`;
          subFormData[`${field.name}_multiEval`] = {
            [currentUserId]: {
              value,
              date: "now",
              answer,
            },
          };
        }
        // Toujours retirer la valeur "classique" : sinon le backend la
        // stockerait comme un radio normal (doublon + écrasement potentiel).
        delete subFormData[field.name];
        // Pas root-level → on saute le traitement root-level ci-dessous.
        continue;
      }

      // Finder : ne jamais persister `img` (l'image se périme, l'élément peut
      // changer d'avatar) — elle est résolue live à l'affichage. On la retire
      // avant l'envoi serveur. Le champ reste nested (pas root-level).
      if (field.componentType === "finder" && field.name in subFormData) {
        subFormData[field.name] = stripFinderElementImages(subFormData[field.name]);
        continue;
      }

      if (!isRootLevelField(field.componentType)) continue;
      if (!(field.name in subFormData)) continue;

      // commonTable : valeur composite { scores, myCatalog } à splitter en
      // DEUX entrées root-level (yesOrNo{key} et criterias{key}) pour matcher
      // le format PHP.
      if (field.componentType === "commonTable") {
        const composite = subFormData[field.name] as
          | { scores?: Record<string, unknown>; myCatalog?: Record<string, unknown> }
          | undefined;
        const fieldKey = getOriginalFieldKey(field);
        const scoresKey = `yesOrNo${fieldKey}`;
        const myCatalogKey = `criterias${fieldKey}`;
        denormalized[scoresKey] = composite?.scores ?? {};
        denormalized[myCatalogKey] = composite?.myCatalog ?? {};
        delete subFormData[field.name];
        if (import.meta.env.DEV) {
          console.log(
            `[denormalizeAnswerData] commonTable ${field.name} split → ${scoresKey} + ${myCatalogKey}`
          );
        }
        continue;
      }

      // Cas générique root-level (ex: evaluation) : déplacer du subform vers la racine.
      denormalized[field.name] = subFormData[field.name];
      delete subFormData[field.name];
      if (import.meta.env.DEV) {
        console.log(`[denormalizeAnswerData] Moved ${field.name} from subform ${subFormId} to root`);
      }
    }
  }

  return denormalized;
}

/**
 * Type pour les liens extraits des champs Finder
 * Format: { [type]: { [id]: { name, type } } }
 */
export type FinderLinksMap = Record<string, Record<string, { name: string; type: string }>>;

/**
 * Extrait les liens des champs Finder pour les stocker dans answer.links
 * 
 * Le PHP stocke les éléments finder sélectionnés dans answer.links au format:
 * { organizations: { "mongoId": { name: "...", type: "organizations" } } }
 * 
 * @param formData - Données du formulaire
 * @param subFormsFields - Structure parsée du formulaire
 * @returns Map des liens à ajouter dans answer.links
 */
export function extractFinderLinks(
  formData: Record<string, unknown>,
  subFormsFields: SubFormFields[]
): FinderLinksMap {
  const links: FinderLinksMap = {};

  for (const { subFormId, fields } of subFormsFields) {
    const subFormData = formData[subFormId] as Record<string, unknown> | undefined;
    if (!subFormData) continue;

    for (const field of fields) {
      if (field.componentType === "finder") {
        const finderValue = subFormData[field.name] as Record<string, { id: string; name: string; type: string }> | null;
        if (!finderValue) continue;

        // Pour chaque élément sélectionné dans le finder
        for (const [elementId, element] of Object.entries(finderValue)) {
          const elementType = element.type;
          
          // Initialiser le type si nécessaire
          if (!links[elementType]) {
            links[elementType] = {};
          }
          
          // Ajouter l'élément aux links
          links[elementType][elementId] = {
            name: element.name,
            type: element.type,
          };
        }
      }
    }
  }

  return links;
}

/**
 * Information consolidée sur le finder partagé d'un formulaire collaboratif
 * "par lieu". Combine la cible (`sharedQuestionPath` côté serveur) et les
 * filtres de recherche (`FinderConfig.filters` côté input).
 */
export interface SharedFinderInfo {
  /** ID du sous-formulaire qui contient le finder */
  subFormId: string;
  /** Nom complet du champ (avec préfixe `finder`) */
  fieldName: string;
  /** Chemin original ("subFormId.fieldName") */
  fullPath: string;
  /** Filtres tags / sourceKey / etc. (mêmes que FinderSearchModal) */
  filters: FinderFilter[];
  /** Filtres d'exclusion (`$nin`) — mêmes que FinderSearchModal */
  excludeFilters: FinderFilter[];
  /** Exclure les éléments avec sourceKey */
  notSourceKey: boolean;
  /** Type d'élément ciblé (organizations, projects, ...) */
  type: FinderConfig["type"];
}

/**
 * Extrait l'info du finder partagé du formulaire (qui détermine le lieu pour
 * les forms collaboratifs). Retourne `null` si :
 * - `sharedQuestionPath` absent ou vide,
 * - aucun chemin ne pointe vers un input "finder",
 * - le champ pointé n'a pas de FinderConfig (config malformée).
 *
 * Utilisé par `CoFormPlacePage` pour pré-remplir + verrouiller le finder en
 * vue détail, et pour filtrer la liste des lieux par les mêmes critères que
 * la recherche du finder.
 */
export function getSharedFinderInfo(formData: CoFormData): SharedFinderInfo | null {
  const paths = formData.sharedQuestionPath ?? [];
  const finderPath = paths.find((p) => typeof p === "string" && p.includes("finder"));
  if (!finderPath) return null;

  const dotIdx = finderPath.indexOf(".");
  if (dotIdx <= 0) return null;
  const subFormId = finderPath.slice(0, dotIdx);
  const fieldName = finderPath.slice(dotIdx + 1);

  // Récupère le FinderConfig parsé via la pipeline existante.
  //
  // `includeHiddenSteps` : lecture STRUCTURELLE, pas d'affichage. Le finder
  // partagé désigne le lieu auquel la réponse se rattache — il pilote le
  // pré-remplissage, le verrouillage et les filtres du mode collaboratif. Si
  // l'étape qui le porte est marquée `hideStep`, on doit quand même le trouver,
  // sans quoi le mode par lieu se dégraderait en silence.
  const subFormsFields = parseCoFormFields(formData, { includeHiddenSteps: true });
  const subForm = subFormsFields.find((sf) => sf.subFormId === subFormId);
  if (!subForm) return null;
  const field = subForm.fields.find((f) => f.name === fieldName);
  if (!field || !field.finderConfig) return null;

  const cfg = field.finderConfig;
  return {
    subFormId,
    fieldName,
    fullPath: finderPath,
    filters: cfg.filters ?? [],
    excludeFilters: cfg.excludeFilters ?? [],
    notSourceKey: !!cfg.notSourceKey,
    type: cfg.type,
  };
}
