/**
 * Resolution des images Communecter (`src/lib/media.ts`).
 *
 * Le bug d'origine : `/upload/communecter/...` pose tel quel dans `<img src>`
 * se resout sur l'origine du FRONT, et couvertures comme portraits cassent
 * hors du backend factice. Ces tests fixent la resolution contre l'origine de
 * l'API — et le refus de tout ce qui n'est pas une image sure.
 */
import { describe, expect, test } from 'vitest';
import { resolveMediaUrl } from '@/modules/kanban/lib/media';

const API = 'http://communecter74-dev';

describe('resolveMediaUrl', () => {
  test('resout un chemin relatif contre l origine de l API', () => {
    expect(resolveMediaUrl('/upload/communecter/projects/p1/banner.png', API)).toBe(
      'http://communecter74-dev/upload/communecter/projects/p1/banner.png',
    );
    expect(resolveMediaUrl('upload/x.png', API)).toBe('http://communecter74-dev/upload/x.png');
  });

  test('l origine seule : un chemin de base dans VITE_API_BASE ne prefixe pas /upload', () => {
    expect(resolveMediaUrl('/upload/a.png', 'https://hote.example:8443/ph/')).toBe('https://hote.example:8443/upload/a.png');
  });

  test('conserve la requete (cache-busting `?t=` de Communecter)', () => {
    expect(resolveMediaUrl('/upload/thumb.png?t=1758067200', API)).toBe(
      'http://communecter74-dev/upload/thumb.png?t=1758067200',
    );
  });

  test('laisse passer les adresses completes et les images data:', () => {
    expect(resolveMediaUrl('https://cdn.example/a.png', API)).toBe('https://cdn.example/a.png');
    expect(resolveMediaUrl('//cdn.example/a.png', API)).toBe('//cdn.example/a.png');
    expect(resolveMediaUrl('data:image/svg+xml;charset=utf-8,%3Csvg%3E', API)).toBe(
      'data:image/svg+xml;charset=utf-8,%3Csvg%3E',
    );
    expect(resolveMediaUrl('blob:http://localhost/1234', API)).toBe('blob:http://localhost/1234');
  });

  test('refuse les schemas dangereux et les documents data:', () => {
    expect(resolveMediaUrl('javascript:alert(1)', API)).toBeNull();
    expect(resolveMediaUrl('data:text/html,<script>', API)).toBeNull();
    expect(resolveMediaUrl('vbscript:x', API)).toBeNull();
  });

  test('rien a afficher : null, vide, espaces', () => {
    expect(resolveMediaUrl(null, API)).toBeNull();
    expect(resolveMediaUrl(undefined, API)).toBeNull();
    expect(resolveMediaUrl('   ', API)).toBeNull();
  });

  test('base vide (front et API sur la meme origine) : chemin absolu rendu tel quel', () => {
    expect(resolveMediaUrl('/upload/a.png', '')).toBe('/upload/a.png');
    expect(resolveMediaUrl('upload/a.png', '')).toBe('/upload/a.png');
  });
});
