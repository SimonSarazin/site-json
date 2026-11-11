/**
 * Etiquettes libres d'une action Communecter (`src/lib/tags.ts`, §11.4).
 *
 * Deux contrats : la SAISIE (on ne laisse pas un pseudo-tag de statut se
 * deguiser en etiquette) et la DERIVATION des etiquettes, identique au module
 * PHP — les couleurs attendues ont ete calculees par `crc32()` PHP 7.4
 * (`php -r`, 22/10/2026) : un ecart d'une seule teinte entre le serveur et
 * l'ajout optimiste ferait changer la couleur d'un tag a la reponse.
 */
import { describe, expect, test } from 'vitest';
import {
  addTag,
  CARD_TAGS_MAX,
  compareTagNames,
  crc32,
  isStatusTag,
  normalizeTag,
  removeTag,
  tagError,
  tagLabel,
  tagLabelColor,
  tagLabelId,
  tagLabelsOf,
  tagOfLabelId,
  tagSuggestions,
  TAG_MAX_LENGTH,
  validateTags,
  withMissingTagLabels,
} from '@/modules/kanban/lib/tags';

describe('saisie', () => {
  test('normalise : espaces de bord et # de tete retires, casse conservee', () => {
    expect(normalizeTag('  #Web  ')).toBe('Web');
    expect(normalizeTag('##mobile')).toBe('mobile');
    expect(normalizeTag('Pièces jointes')).toBe('Pièces jointes');
  });

  test('les pseudo-tags de statut sont reserves, sans egard a la casse (comme le PHP)', () => {
    expect(isStatusTag('next')).toBe(true);
    expect(isStatusTag('ToTest')).toBe(true);
    expect(isStatusTag('discuter')).toBe(true);
    expect(isStatusTag('nextcloud')).toBe(false);
  });

  test('addTag refuse vide, trop long, reserve, doublon et depassement', () => {
    expect(addTag(['web'], '   ').error).toBe('empty');
    expect(addTag([], 'x'.repeat(TAG_MAX_LENGTH + 1)).error).toBe('tooLong');
    expect(addTag([], '#next').error).toBe('reserved');
    expect(addTag(['web'], 'web').error).toBe('duplicate');
    const full = Array.from({ length: CARD_TAGS_MAX }, (_, index) => `t${index}`);
    expect(addTag(full, 'encore').error).toBe('tooMany');
  });

  test('addTag ajoute la forme normalisee et ne mute pas la liste d origine', () => {
    const tags = ['web'];
    const result = addTag(tags, ' #mobile ');
    expect(result).toEqual({ tags: ['web', 'mobile'], tag: 'mobile', error: null });
    expect(tags).toEqual(['web']);
  });

  test('une lettre accentuee composee compte pour un caractere', () => {
    expect(tagError([], 'é'.repeat(TAG_MAX_LENGTH))).toBeNull();
  });

  test('removeTag et validateTags', () => {
    expect(removeTag(['web', 'mobile'], 'web')).toEqual(['mobile']);
    expect(validateTags(['web', 'mobile'])).toBeNull();
    expect(validateTags(['web', 'web'])).toBe('duplicate');
    expect(validateTags(['totest'])).toBe('reserved');
    expect(validateTags([' '])).toBe('empty');
  });
});

describe('etiquettes derivees — parite avec le module PHP', () => {
  test('crc32 est celui de PHP (vecteur IEEE de reference)', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  test('couleurs identiques a ActionCards::labelColor', () => {
    expect(tagLabelColor('web')).toBe('#0d9488');
    expect(tagLabelColor('Backend')).toBe('#65a30d');
    expect(tagLabelColor('mobile')).toBe('#d97706');
    expect(tagLabelColor('Message')).toBe('#65a30d');
    expect(tagLabelColor('Agenda')).toBe('#dc2626');
    expect(tagLabelColor('Écran')).toBe('#059669');
    expect(tagLabelColor('Communauté')).toBe('#0891b2');
  });

  test('« Web » et « web » partagent leur couleur (hachage en minuscules)', () => {
    expect(tagLabelColor('Web')).toBe(tagLabelColor('web'));
  });

  test('sigma final grec : la couleur est celle de PHP 7.4 (mb_strtolower sans sigma final)', () => {
    // Valeurs relevees avec `php -r` sous PHP 7.4.33 : `toLowerCase()` donnait
    // l'indice 0 au lieu de 8 pour « ΚΟΣΜΟΣ », 3 au lieu de 5 pour « ΛΟΓΟΣ ».
    expect(tagLabelColor('ΚΟΣΜΟΣ')).toBe('#4f46e5');
    expect(tagLabelColor('ΛΟΓΟΣ')).toBe('#dc2626');
    // Un sigma final deja en minuscule reste tel quel, cote PHP comme ici.
    expect(tagLabelColor('κοσμος')).toBe('#2563eb');
  });

  test('labelId et retour', () => {
    expect(tagLabelId('web')).toBe('tag:web');
    expect(tagOfLabelId('tag:web')).toBe('web');
    expect(tagOfLabelId('lbl_budget')).toBeNull();
    expect(tagLabel('web')).toEqual({ id: 'tag:web', name: 'web', color: '#0d9488' });
  });

  test('tri strcasecmp puis strcmp, comme ActionCards::labelsFor', () => {
    const labels = tagLabelsOf([{ tags: ['mobile', 'Message', 'web'] }, { tags: ['Backend', 'web'] }, {}]);
    expect(labels.map((label) => label.name)).toEqual(['Backend', 'Message', 'mobile', 'web']);
    expect(compareTagNames('Web', 'web')).toBeLessThan(0);
  });
});

describe('withMissingTagLabels', () => {
  const known = [tagLabel('web')];

  test('ajoute seulement les etiquettes qui manquent, en fin de liste', () => {
    const labels = withMissingTagLabels(known, [{ tags: ['web', 'UX'] }]);
    expect(labels.map((label) => label.id)).toEqual(['tag:web', 'tag:UX']);
  });

  test('rend la MEME reference quand rien ne manque', () => {
    expect(withMissingTagLabels(known, [{ tags: ['web'] }, {}])).toBe(known);
  });

  test('ne retire jamais une etiquette servie par le serveur', () => {
    expect(withMissingTagLabels(known, [])).toBe(known);
  });
});

test('tagSuggestions ne propose que les tags, tries', () => {
  expect(
    tagSuggestions([tagLabel('web'), { id: 'lbl_budget', name: 'Budget', color: '#000000' }, tagLabel('Agenda')]),
  ).toEqual(['Agenda', 'web']);
});
