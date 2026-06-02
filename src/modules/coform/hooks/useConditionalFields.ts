import { useMemo } from "react";
import { useWatch, type Control, type FieldValues } from "react-hook-form";
import type { FormFieldMapping, ConditionalRule } from "../types";
import { getOriginalFieldKey } from "../utils/formParser";

/**
 * Évalue une règle conditionnelle contre la valeur actuelle du champ source.
 * Exporté pour tests unitaires.
 */
export function evaluateRule(rule: ConditionalRule, sourceValue: unknown): boolean {
  const strValue = sourceValue == null ? "" : String(sourceValue);

  switch (rule.operator) {
  case "equals":
    return strValue === rule.value;
  case "notEquals":
    return strValue !== rule.value;
  case "contains":
    return strValue.includes(rule.value);
  case "matches":
    try {
      return new RegExp(rule.value).test(strValue);
    } catch {
      return false;
    }
  case "isEmpty":
    return strValue === "" || (Array.isArray(sourceValue) && sourceValue.length === 0);
  case "isNotEmpty":
    return strValue !== "" && !(Array.isArray(sourceValue) && sourceValue.length === 0);
  default:
    return false;
  }
}

interface RuleGroup {
  action: "show" | "hide";
  logic: "and" | "or";
  rules: ConditionalRule[];
  /** Nom react-hook-form du champ source (préfixé) */
  sourceFieldName: string;
}

function buildRuleGroups(
  allFields: FormFieldMapping[],
  targetRawKey: string,
): RuleGroup[] {
  const groups: RuleGroup[] = [];

  for (const field of allFields) {
    const cd = field.conditionalDisplay;
    if (!cd?.enabled || !cd.rules.length) continue;

    // Filtrer les règles qui ciblent le champ par clé brute
    const relevantRules = cd.rules.filter((r) => r.targetInput === targetRawKey);
    if (!relevantRules.length) continue;

    // Grouper par action
    const byAction: Record<string, ConditionalRule[]> = {};
    for (const rule of relevantRules) {
      const key = rule.action;
      if (!byAction[key]) byAction[key] = [];
      byAction[key].push(rule);
    }

    for (const [action, rules] of Object.entries(byAction)) {
      groups.push({
        action: action as "show" | "hide",
        logic: cd.logic,
        rules,
        sourceFieldName: field.name,
      });
    }
  }

  return groups;
}

/**
 * Hook React pour évaluer la visibilité conditionnelle des champs.
 *
 * @param allFields - Tous les champs de l'étape/formulaire actuel(le)
 * @param control - L'objet control de react-hook-form
 * @returns Un objet avec `isFieldVisible(fieldName)` — fieldName = nom react-hook-form (préfixé)
 */
export function useConditionalFields(
  allFields: FormFieldMapping[],
  control: Control<FieldValues>,
) {
  // Map rawKey → fieldName (préfixé)
  const rawToName = useMemo(() => {
    const rawToName: Record<string, string> = {};
    for (const field of allFields) {
      const rawKey = getOriginalFieldKey(field);
      rawToName[rawKey] = field.name;
    }
    return rawToName;
  }, [allFields]);

  // Collecter les noms react-hook-form de tous les sourceInput référencés
  const sourceNames = useMemo(() => {
    const names = new Set<string>();
    for (const field of allFields) {
      const cd = field.conditionalDisplay;
      if (!cd?.enabled) continue;
      for (const rule of cd.rules) {
        // sourceInput est la clé brute — on la résout en nom préfixé
        const resolved = rawToName[rule.sourceInput] ?? rule.sourceInput;
        names.add(resolved);
      }
    }
    return Array.from(names);
  }, [allFields, rawToName]);

  // Observer uniquement les champs source pertinents
  const watchedValues = useWatch({
    control,
    name: sourceNames.length > 0 ? sourceNames : ["__noop__"],
    disabled: sourceNames.length === 0,
  });

  // Map nom préfixé → valeur observée
  const valuesMap = useMemo(() => {
    const map: Record<string, unknown> = {};
    sourceNames.forEach((name, i) => {
      map[name] = Array.isArray(watchedValues) ? watchedValues[i] : undefined;
    });
    return map;
  }, [sourceNames, watchedValues]);

  // Pré-calculer les groupes de règles par champ cible (clé brute)
  const ruleGroupsByRawKey = useMemo(() => {
    const map: Record<string, RuleGroup[]> = {};
    for (const field of allFields) {
      const rawKey = getOriginalFieldKey(field);
      const groups = buildRuleGroups(allFields, rawKey);
      if (groups.length > 0) {
        map[field.name] = groups;
      }
    }
    return map;
  }, [allFields]);

  /**
   * Détermine si un champ est visible.
   * @param fieldName - Nom react-hook-form du champ (préfixé)
   */
  function isFieldVisible(fieldName: string): boolean {
    const groups = ruleGroupsByRawKey[fieldName];
    if (!groups || groups.length === 0) return true;

    let hasShow = false;
    let showSatisfied = false;
    let hideSatisfied = false;

    for (const group of groups) {
      const results = group.rules.map((rule) => {
        const resolvedSource = rawToName[rule.sourceInput] ?? rule.sourceInput;
        return evaluateRule(rule, valuesMap[resolvedSource]);
      });
      const groupResult = group.logic === "and"
        ? results.every(Boolean)
        : results.some(Boolean);

      if (group.action === "show") {
        hasShow = true;
        if (groupResult) showSatisfied = true;
      } else {
        if (groupResult) hideSatisfied = true;
      }
    }

    // hide prioritaire
    if (hideSatisfied) return false;
    // Si des règles show existent, le champ n'est visible que si au moins un groupe show est satisfait
    if (hasShow) return showSatisfied;
    return true;
  }

  return { isFieldVisible };
}
