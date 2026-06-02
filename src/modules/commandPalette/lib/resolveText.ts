import type { LocalizedText } from "../registry/types";

/**
 * Résout un `LocalizedText` (string fixe OU `LocalizedString`) en chaîne pour
 * la locale donnée. Aucun accès i18next : les sources fournissent leurs labels
 * sous forme de `LocalizedString` inline ou de chaînes déjà résolues.
 */
export function resolveText(value: LocalizedText | undefined, locale: string): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  const rec = value as Record<string, string>;
  return rec[locale] ?? rec.fr ?? rec.en ?? Object.values(rec)[0] ?? "";
}
