import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { isRecord } from '@/modules/kanban/types';
import {
  mergeAssignees,
  mergeChecklist,
  mergeTags,
  tagMergeKey,
  type MergeChecklistItem,
  type MergedChecklistItem,
} from '@/modules/kanban/lib/cardMerge';

/*
 * Rejoue TOUS les vecteurs partages de `tests/fixtures/merge-cases.json` — les
 * memes que le selftest du module PHP. C'est le filet qui garantit que le
 * serveur, le backend factice (qui importe `lib/cardMerge.ts` tel quel) et
 * l'optimiste du front fusionnent de la meme facon : un cas qui passe d'un cote
 * et casse de l'autre se voit ici.
 */

interface SetCase {
  name: string;
  field: 'assignees' | 'tags';
  base: string[];
  next: string[];
  current: string[];
  expected: string[];
}

interface ChecklistCase {
  name: string;
  base: MergeChecklistItem[];
  next: MergeChecklistItem[];
  current: MergedChecklistItem[];
  expected: { id: string; label: string; done: boolean }[];
}

interface MergeCases {
  sets: SetCase[];
  checklists: ChecklistCase[];
}


function isMergeCases(value: unknown): value is MergeCases {
  return isRecord(value) && Array.isArray(value.sets) && Array.isArray(value.checklists);
}

const raw: unknown = JSON.parse(
  readFileSync(new URL('./__fixtures__/merge-cases.json', import.meta.url), 'utf8'),
);
if (!isMergeCases(raw)) throw new Error('merge-cases.json : forme inattendue');
const CASES = raw;

/** Fabrique d'identifiants du test : forge `new-<n>`, toujours absent des pris. */
function testIdFactory() {
  let counter = 0;
  return (_item: MergeChecklistItem, taken: ReadonlySet<string>): string => {
    let id: string;
    do {
      counter += 1;
      id = `new-${counter}`;
    } while (taken.has(id));
    return id;
  };
}

describe('merge-cases.json : ensembles (assignes, tags)', () => {
  test('le fichier porte des cas pour les deux champs', () => {
    expect(CASES.sets.some((entry) => entry.field === 'assignees')).toBe(true);
    expect(CASES.sets.some((entry) => entry.field === 'tags')).toBe(true);
  });

  test.each(CASES.sets.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
    const merge = entry.field === 'tags' ? mergeTags : mergeAssignees;
    expect(merge(entry.base, entry.next, entry.current)).toEqual(entry.expected);
  });
});

describe('merge-cases.json : checklists', () => {
  test.each(CASES.checklists.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
    const merged = mergeChecklist(entry.base, entry.next, entry.current, testIdFactory());
    expect(merged).toHaveLength(entry.expected.length);
    const currentIds = new Set(entry.current.map((item) => item.id));
    entry.expected.forEach((expected, index) => {
      const actual = merged[index];
      expect({ label: actual.label, done: actual.done }).toEqual({ label: expected.label, done: expected.done });
      if (expected.id === '*') {
        // Point NOUVEAU : identifiant non vide, forge, absent de l'actuel.
        expect(actual.id.length).toBeGreaterThan(0);
        expect(currentIds.has(actual.id)).toBe(false);
      } else {
        expect(actual.id).toBe(expected.id);
      }
    });
  });
});

describe('fusion : details hors vecteurs', () => {
  test('les ajouts recoivent des identifiants distincts entre eux', () => {
    const merged = mergeChecklist(
      [],
      [
        { id: null, label: 'A', done: false },
        { id: null, label: 'B', done: false },
      ],
      [],
      testIdFactory(),
    );
    expect(new Set(merged.map((item) => item.id)).size).toBe(2);
  });

  test("un id de la base repete dans la cible n'est pas un ajout deguise", () => {
    const item = { id: 't1', label: 'Maquette', done: false };
    const merged = mergeChecklist([item], [item, { ...item, done: true }], [item], testIdFactory());
    expect(merged).toEqual([item]);
  });

  test('les tags se comparent comme PHP, sigma final compris', () => {
    expect(tagMergeKey('  ΚΟΣΜΟΣ ')).toBe('κοσμοσ');
    // Retirer « ΚΟΣΜΟΣ » retire bien sa graphie minuscule a la PHP.
    expect(mergeTags(['ΚΟΣΜΟΣ'], [], ['κοσμοσ', 'web'])).toEqual(['web']);
  });

  test("« Web » et « web » deja en base restent deux tags tant qu'on n'y touche pas", () => {
    expect(mergeTags(['mobile'], ['mobile', 'Agenda'], ['Web', 'web', 'mobile'])).toEqual([
      'Web',
      'web',
      'mobile',
      'Agenda',
    ]);
  });
});
