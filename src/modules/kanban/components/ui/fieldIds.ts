/**
 * Identifiants dérivés d'un champ de formulaire (repris de co-kanban, `components/ui/fieldIds.ts`).
 *
 * Logique PURE, donc hors du composant : `<Field>` les pose sur son aide et son erreur, l'appelant
 * les pose sur le contrôle via `aria-describedby`. Les deux côtés doivent tomber sur la même
 * chaîne, d'où cette source unique.
 */

/** Identifiant du texte d'aide d'un champ, dérivé de celui du contrôle. */
export const fieldHintId = (htmlFor: string): string => `${htmlFor}-hint`;

/** Identifiant du message d'erreur d'un champ. */
export const fieldErrorId = (htmlFor: string): string => `${htmlFor}-error`;

/**
 * Valeur d'`aria-describedby` à poser SUR LE CONTRÔLE. `<Field>` ne peut pas la poser lui-même :
 * son enfant est un nœud quelconque (groupe de cases, champ composé), le cloner casserait.
 * L'erreur PRIME sur l'aide : quand les deux existent, seule l'erreur est affichée, donc annoncée.
 */
export function fieldDescribedBy(htmlFor: string, { hint, error }: { hint?: string; error?: string }): string | undefined {
  if (error) return fieldErrorId(htmlFor);
  if (hint) return fieldHintId(htmlFor);
  return undefined;
}
