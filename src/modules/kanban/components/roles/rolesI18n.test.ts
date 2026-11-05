/**
 * Clés `views.roles.*` MORTES (repris de co-kanban, `rolesViewI18n.test.ts`) : le préflight
 * i18n attrape une clé vide ou absente d'une langue, pas l'inverse — une traduction que plus
 * aucun écran n'affiche. Toute clé du sous-arbre de la vue Rôles doit être lue par le code du
 * module, entre guillemets : en littéral (`t('views.roles.x')`, `key: 'views.roles.x'`) ou par un
 * préfixe construit (`` `views.roles.errors.${…}` ``) ; les pluriels comptent pour leur racine.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import en from '@/modules/kanban/i18n/en.json';
import fr from '@/modules/kanban/i18n/fr.json';
import { translationAt } from '@/modules/kanban/__fixtures__/i18nLookup';

const MODULE_DIR = new URL('../../', import.meta.url).pathname;
const PREFIX = 'views.roles.';
const REFERENCE = /['"`](views\.roles\.[A-Za-z0-9_.]*)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function leavesOf(catalog: unknown): string[] {
  const roles = translationAt(catalog, 'views.roles');
  if (typeof roles !== 'object' || roles === null) throw new Error('sous-arbre views.roles absent');
  return Object.entries(roles).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null ? Object.keys(child).map((leaf) => `${PREFIX}${key}.${leaf}`) : [`${PREFIX}${key}`],
  );
}

function references(): string[] {
  const found = new Set<string>();
  for (const file of sourceFiles(MODULE_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(REFERENCE)) found.add(match[1]);
  }
  return [...found];
}

function isRead(key: string, refs: readonly string[]): boolean {
  const root = key.replace(/_(zero|one|other)$/, '');
  return refs.some((ref) => ref === root || (ref.endsWith('.') && root.startsWith(ref)));
}

describe('vue Rôles : aucune clé i18n morte', () => {
  test.each([
    ['fr', fr],
    ['en', en],
  ])('%s : toute clé views.roles.* est lue par le code', (_lang, catalog) => {
    const refs = references();
    // Filet du filet : si le scan ne ramasse rien, c'est lui qui est cassé.
    expect(refs.length).toBeGreaterThan(30);
    expect(leavesOf(catalog).filter((key) => !isRead(key, refs))).toEqual([]);
  });
});
