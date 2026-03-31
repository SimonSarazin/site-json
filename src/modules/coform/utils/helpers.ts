import { BOOTSTRAP_TO_TAILWIND_WIDTH } from "../constants";
import type { SubFormData, AllStepsData } from "../types";

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
