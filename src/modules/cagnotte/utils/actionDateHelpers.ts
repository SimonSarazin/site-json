/**
 * Helpers de conversion de dates entre les 3 représentations utilisées par les
 * formulaires d'actions :
 *  - **français** `DD/MM/YYYY` : saisie utilisateur dans `DatePickerInput` et stockage du form RHF
 *  - **picker** `YYYY-MM-DD` : valeur native attendue par `<input type="date">` et par `DatePickerInput`
 *  - **ISO** `YYYY-MM-DDTHH:mm:ss.sssZ` : format de stockage backend (envoyé via `setType: "isoDate"`)
 *
 * Toutes les fonctions sont **strictes** : un format invalide retourne `''` (ou `null`
 * pour `parseFrenchDateToIso`) plutôt qu'une exception, pour faciliter le contrôle de flux.
 */
import { format, isValid, parse } from "date-fns";

/**
 * Convertit une date FR (`DD/MM/YYYY`) en ISO 8601, ou `null` si le format n'est pas valide.
 * Sert principalement à préparer la valeur envoyée au backend après validation côté UI.
 */
export function parseFrenchDateToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parse(trimmed, "dd/MM/yyyy", new Date());
  if (!isValid(parsed)) return null;
  // Re-format pour vérifier que la valeur correspond exactement (évite "32/13/2026" qui serait
  // accepté par `parse` en mode laxiste).
  if (format(parsed, "dd/MM/yyyy") !== trimmed) return null;
  return parsed.toISOString();
}

/**
 * Convertit une date FR (`DD/MM/YYYY`) vers le format attendu par `<input type="date">` /
 * `DatePickerInput` (`YYYY-MM-DD`). Retourne `''` si le format n'est pas valide.
 */
export function frenchDateToPickerValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = parse(trimmed, "dd/MM/yyyy", new Date());
  if (!isValid(parsed)) return "";
  return format(parsed, "yyyy-MM-dd");
}

/**
 * Convertit la valeur d'un input date (`YYYY-MM-DD`) vers le format FR (`DD/MM/YYYY`).
 * Utilisé dans les `onChange` du picker pour stocker la valeur dans le form RHF en format FR.
 */
export function pickerValueToFrenchDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = parse(trimmed, "yyyy-MM-dd", new Date());
  if (!isValid(parsed)) return "";
  return format(parsed, "dd/MM/yyyy");
}

/**
 * Formate un timestamp (ms) en date FR (`DD/MM/YYYY`) pour pré-remplir un form d'édition.
 * Retourne `''` si le timestamp est invalide ou absent.
 */
export function timestampToFrenchDate(timestamp?: number | null): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy");
}
