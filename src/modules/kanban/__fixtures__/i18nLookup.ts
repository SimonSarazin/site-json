/**
 * Lecture d'une cle POINTEE dans un catalogue i18n (`errors.reasons.notSourceBoard`).
 *
 * Partagee par les tests qui verifient qu'une cle CONSTRUITE a l'execution
 * (raison d'un refus, libelle d'activite) existe dans les deux langues : le
 * garde-fou de `tests/unit/i18n.test.ts` ne ramasse que les cles litterales.
 */
import { isRecord } from '@/modules/kanban/types';

/** Valeur a ce chemin, ou `undefined`. */
export function translationAt(catalog: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (isRecord(node) ? node[part] : undefined), catalog);
}

/** La cle existe-t-elle, avec un texte non vide ? */
export function hasTranslation(catalog: unknown, key: string): boolean {
  const value = translationAt(catalog, key);
  return typeof value === 'string' && value.length > 0;
}
