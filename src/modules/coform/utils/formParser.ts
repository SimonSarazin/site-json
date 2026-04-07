import { z } from "zod";
import type { CoFormData, FormFieldMapping, SubFormFields, MultiCheckboxPlusOptionType, EvaluationConfig, FinderConfig, FinderFilter, SimpleTableConfig, SimpleTableColumn, SimpleTableRow, UploaderConfig, ConditionalDisplay } from "../types";

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
  evaluation: "evaluation",
};

/**
 * Certains types de champs sont stockés à la racine de answers au lieu du sous-formulaire
 * Ex: evaluation est stocké comme answers["evaluationXXX"] au lieu de answers[subFormId]["evaluationXXX"]
 */
const ROOT_LEVEL_FIELDS: FormFieldMapping["componentType"][] = [
  "evaluation",
];

/**
 * Vérifie si un type de champ est stocké à la racine de answers
 */
export function isRootLevelField(componentType: FormFieldMapping["componentType"]): boolean {
  return ROOT_LEVEL_FIELDS.includes(componentType);
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
): "text" | "textarea" | "radio" | "checkbox" | "select" | "multiCheckboxPlus" | "evaluation" | "finder" | "simpleTable" | "uploader" | "unknown" {
  const typeMapping: Record<string, "text" | "textarea" | "radio" | "checkbox" | "select" | "multiCheckboxPlus" | "evaluation" | "finder" | "simpleTable" | "uploader"> = {
    text: "text",
    url: "text",
    email: "text",
    tel: "text",
    number: "text",
    textarea: "textarea",
    "tpls.forms.cplx.radioNew": "radio",
    "tpls.forms.cplx.checkboxNew": "checkbox",
    "tpls.forms.cplx.multiCheckboxPlus": "multiCheckboxPlus",
    "tpls.forms.cplx.evaluation": "evaluation",
    "tpls.forms.evaluation.evaluation": "evaluation",
    "tpls.forms.cplx.finder": "finder",
    "tpls.forms.finder.finder": "finder",
    "tpls.forms.cplx.simpleTable": "simpleTable",
    "tpls.forms.uploader": "uploader",
    select: "select",
  };

  return typeMapping[coFormType] ?? "unknown";
}

/**
 * Convertit les inputs CoForm en structure mappée pour react-hook-form
 */
export function parseCoFormFields(formData: CoFormData): SubFormFields[] {
  if (!formData.inputs) return [];

  const subFormsFields: SubFormFields[] = [];

  Object.entries(formData.inputs).forEach(([subFormId, subFormData]) => {
    const fields: FormFieldMapping[] = [];

    Object.entries(subFormData.inputs).forEach(([fieldKey, fieldData]) => {
      const componentType = mapCoFormTypeToComponentType(fieldData.type);
      
      // Récupérer les options depuis params si c'est un radio/checkbox
      let options: string[] | undefined;
      let positionType: "column" | "row" | undefined;
      let rowMode: "fixed" | "auto" | undefined;
      let nbPerRow: string | undefined;
      let multiCheckboxPlusConfig: FormFieldMapping["multiCheckboxPlusConfig"] | undefined;
      let evaluationConfig: EvaluationConfig | undefined;
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
            optinfo: (paramData.optinfo as Record<string, string>) || {},
            optimage,
            placeholdersckb: (paramData.placeholdersckb as Record<string, string>) || {},
            nbAnswersMax: paramData.global?.nbAnswersMax || 20,
            rank: toBool(paramData.global?.rank),
            mandatoryCplx: paramData.mandatoryCplx !== false,
            validateCplxRequired: paramData.validateCplxRequired !== false && paramData.mandatoryCplx !== false,
            addValue: toBool(paramData.global?.addValue),
            newValuePlaceholder: paramData.global?.newValuePlaceholder || "Nouvelle valeur",
          };
        }
      }

      // Config spécifique pour evaluation
      if (componentType === "evaluation" && formData.params) {
        // Les données sont directement dans params avec le fieldKey comme suffixe
        // Ex: params.categories{fieldKey}, params.criterias{fieldKey}, etc.
        // On utilise Record<string, unknown> pour accéder aux clés dynamiques
        const params = formData.params as unknown as Record<string, unknown>;
        const categories = params[`categories${fieldKey}`];
        const criterias = params[`criterias${fieldKey}`];
        const criteriaLabel = params[`criteriaLabel${fieldKey}`];
        const categoryNumber = params[`categoryNumber${fieldKey}`];
        const categoryTitle = params[`categoryTitle${fieldKey}`];
        const multiVotePerLine = params[`multiVotePerLine${fieldKey}`];
        const voteType = params[`voteType${fieldKey}`];
        
        evaluationConfig = {
          categories: (categories as EvaluationConfig["categories"]) || {},
          criterias: (criterias as Record<string, { name: string; coeff: number }>) || {},
          criteriaLabel: (criteriaLabel as string) || "Critères",
          categoryNumber: (categoryNumber as number) || 1,
          categoryTitle: (categoryTitle as string) || "Catégories",
          multiVotePerLine: (multiVotePerLine as boolean) || false,
          voteType: ((voteType as string) || "colour") as EvaluationConfig["voteType"],
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
          // Parser les filtres
          const filters: FinderFilter[] = [];
          if (paramData.filter && typeof paramData.filter === "object") {
            Object.values(paramData.filter as Record<string, { attributeName?: string; valueName?: string }>).forEach((f) => {
              if (f.attributeName && f.valueName) {
                filters.push({ attributeName: f.attributeName, valueName: f.valueName });
              }
            });
          }

          // Helper pour convertir "true"/"false" string en boolean
          const toBool = (val: unknown): boolean => val === true || val === "true";

          finderConfig = {
            type: (paramData.type as FinderConfig["type"]) || "organizations",
            filters,
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
            for (const col of paramData.columns as Array<{ label?: string; type?: string }>) {
              columns.push({
                label: col.label || "",
                type: (col.type as SimpleTableColumn["type"]) || "Text",
              });
            }
          } else if (paramData.columns && typeof paramData.columns === "object") {
            for (const col of Object.values(paramData.columns as Record<string, { label?: string; type?: string }>)) {
              columns.push({
                label: col.label || "",
                type: (col.type as SimpleTableColumn["type"]) || "Text",
              });
            }
          }

          const rows: SimpleTableRow[] = [];
          if (Array.isArray(paramData.rows)) {
            for (const row of paramData.rows as Array<{ label?: string }>) {
              rows.push({ label: row.label || "" });
            }
          } else if (paramData.rows && typeof paramData.rows === "object") {
            for (const row of Object.values(paramData.rows as Record<string, { label?: string }>)) {
              rows.push({ label: row.label || "" });
            }
          }

          simpleTableConfig = {
            tableName: (paramData.tableName as string) || "Titre",
            columns,
            rows,
            activeNewLine: toBool(paramData.activeNewLine),
            singleAnswerByLine: toBool(paramData.singleAnswerByLine),
          };
        }
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

      // Déterminer le type HTML pour les inputs texte
      const inputType = componentType === "text" && ["url", "email", "tel", "number"].includes(fieldData.type)
        ? fieldData.type
        : undefined;

      // Parser conditionalDisplay si présent
      const conditionalDisplay = fieldData.conditionalDisplay as ConditionalDisplay | undefined;

      fields.push({
        // Appliquer le préfixe selon le type (finder, multiCheckboxPlus, evaluation)
        name: getFieldNameWithPrefix(componentType, fieldKey),
        label: fieldData.label || fieldKey,
        type: fieldData.type,
        componentType,
        inputType,
        placeholder: fieldData.placeholder,
        info: fieldData.info,
        isRequired: fieldData.isRequired || false,
        width: parseBootstrapWidth(fieldData.width),
        markdown: fieldData.enableMarkdown,
        options,
        positionType: positionType || formData.params?.[fieldKey]?.positionType,
        rowMode: rowMode || formData.params?.[fieldKey]?.rowMode,
        nbPerRow: nbPerRow || formData.params?.[fieldKey]?.nbPerRow,
        multiCheckboxPlusConfig,
        evaluationConfig,
        finderConfig,
        simpleTableConfig,
        uploaderConfig,
        conditionalDisplay,
      });
    });

    fields.sort((a, b) => {
      const keyA = getOriginalFieldKey(a);
      const keyB = getOriginalFieldKey(b);
      const posA = parseInt(formData.inputs?.[subFormId].inputs[keyA]?.position || "0");
      const posB = parseInt(formData.inputs?.[subFormId].inputs[keyB]?.position || "0");
      return posA - posB;
    });

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
export function generateZodSchema(subFormsFields: SubFormFields[]) {
  const schemaShape: Record<string, z.ZodTypeAny> = {};

  subFormsFields.forEach(({ fields }) => {
    fields.forEach((field) => {
      switch (field.componentType) {
        case "text":
        case "textarea":
          schemaShape[field.name] = field.isRequired
            ? z.string().min(1, `${field.label} est requis`)
            : z.string().optional();
          break;

        case "radio":
          if (field.options && field.options.length > 0) {
            const enumSchema = z.enum(field.options as [string, ...string[]]);
            schemaShape[field.name] = field.isRequired
              ? enumSchema
              : z.union([enumSchema, z.literal("")]).optional();
          } else {
            schemaShape[field.name] = field.isRequired
              ? z.string().min(1)
              : z.string().optional();
          }
          break;

        case "checkbox":
          schemaShape[field.name] = field.isRequired
            ? z.array(z.string()).min(1, `${field.label} est requis`)
            : z.array(z.string()).optional();
          break;

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
            }, { message: "Tous les champs complémentaires doivent être remplis" });
            
            schemaShape[field.name] = field.isRequired
              ? refinedSchema.min(1, `${field.label} est requis`)
              : refinedSchema.optional();
          } else {
            schemaShape[field.name] = field.isRequired
              ? baseSchema.min(1, `${field.label} est requis`)
              : baseSchema.optional();
          }
          break;
        }

        case "select":
          schemaShape[field.name] = field.isRequired
            ? z.string().min(1, `${field.label} est requis`)
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
              { message: `${field.label} est requis` }
            );
          } else {
            schemaShape[field.name] = evaluationSchema.optional();
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
              { message: `${field.label} est requis` }
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
              { message: `${field.label} est requis (au moins une ligne de données)` }
            );
          } else {
            schemaShape[field.name] = simpleTableSchema.optional();
          }
          break;
        }

        case "uploader": {
          const uploaderSchema = z.union([
            z.array(z.any()),
            z.object({
              updateDate: z.array(z.string()),
              files: z.union([z.array(z.any()), z.record(z.string(), z.string())]).optional(),
            }),
          ]);
          schemaShape[field.name] = field.isRequired
            ? uploaderSchema.refine(
                (v) => (Array.isArray(v) ? v.length > 0 : true),
                `${field.label} est requis`
              )
            : uploaderSchema.optional();
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

        case "multiCheckboxPlus":
          defaultValues[field.name] = [];
          break;

        case "evaluation":
          defaultValues[field.name] = {};
          break;

        case "finder":
          defaultValues[field.name] = null;
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
          defaultValues[field.name] = [];
          break;

        default:
          defaultValues[field.name] = "";
      }
    });
  });

  return defaultValues;
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
 * @param rawAnswers - Données brutes depuis la DB (answers)
 * @param subFormsFields - Structure parsée du formulaire (pour connaître quel champ appartient à quel subform)
 * @returns Données normalisées avec les champs root-level déplacés dans leurs subforms
 */
export function normalizeAnswerData(
  rawAnswers: Record<string, unknown> | null | undefined,
  subFormsFields: SubFormFields[]
): Record<string, unknown> | undefined {
  if (!rawAnswers) return undefined;

  // Copie profonde pour ne pas muter l'original
  const normalized = JSON.parse(JSON.stringify(rawAnswers)) as Record<string, unknown>;

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
        // Le champ est stocké à la racine avec son nom (qui inclut déjà le préfixe)
        // Ex: field.name = "evaluationXXX", on cherche rawAnswers["evaluationXXX"]
        if (field.name in normalized && !(field.name in subFormData)) {
          // Déplacer le champ de la racine vers le subform
          subFormData[field.name] = normalized[field.name];
          // Optionnel: supprimer de la racine (on garde pour compatibilité)
          // delete normalized[field.name];
        }
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
  subFormsFields: SubFormFields[]
): Record<string, unknown> {
  // Copie profonde pour ne pas muter l'original
  const denormalized = JSON.parse(JSON.stringify(formData)) as Record<string, unknown>;

  // Pour chaque subform, déplacer les champs root-level vers la racine
  for (const { subFormId, fields } of subFormsFields) {
    const subFormData = denormalized[subFormId] as Record<string, unknown> | undefined;
    if (!subFormData) continue;

    for (const field of fields) {
      if (isRootLevelField(field.componentType) && field.name in subFormData) {
        // Déplacer le champ du subform vers la racine
        denormalized[field.name] = subFormData[field.name];
        delete subFormData[field.name];
        if (import.meta.env.DEV) {
          console.log(`[denormalizeAnswerData] Moved ${field.name} from subform ${subFormId} to root`);
        }
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
