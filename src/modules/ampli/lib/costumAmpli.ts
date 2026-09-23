/**
 * Les amplis d'un site — lecture, normalisation, filtrage. Fonctions PURES.
 *
 * Deux sources, un seul modèle (`AmpliModel`) :
 *  - `ampli: true` → `costum.ampli.<slug>` du porteur du site, la source de
 *    vérité de Co (déjà présente dans `entity.serverData.costum`, au SSR comme
 *    au client : `element/about` la renvoie) ;
 *  - `ampli: [...]` → la forme STATIQUE historique, dépréciée, conservée tant
 *    que la prod n'est pas migrée (cf. `LegacyAmpliConfigSchema`).
 *
 * Rappel (skill config-assistant) : la config n'est JAMAIS parsée par Zod au
 * runtime. Tout ce qui arrive ici est du JSON brut — d'où les `safeParse`, y
 * compris sur la forme tableau.
 */

import { isPlainObj } from "@/lib/costumLists";
import { CostumAmpliEntrySchema, LegacyAmpliConfigSchema } from "../schema";
import type { AmpliModel } from "../types";

export type AmpliSourceMode = "costum" | "legacy" | "off";

/** D'où viennent les amplis, selon la valeur BRUTE de `config.ampli`. */
export function ampliSourceMode(ampli: unknown): AmpliSourceMode {
  if (ampli === true) return "costum";
  if (Array.isArray(ampli)) return "legacy";
  return "off";
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function warnDev(message: string, detail?: unknown): void {
  if (import.meta.env.DEV) console.warn(`[ampli] ${message}`, detail ?? "");
}

/**
 * Premier arrivé, premier servi : c'est ce que faisait `siteConfig.ampli.find`,
 * et deux amplis sous le même slug n'auraient de toute façon qu'une URL.
 */
function keepFirstBySlug(amplis: AmpliModel[], source: string): AmpliModel[] {
  const seen = new Set<string>();
  return amplis.filter((ampli) => {
    if (!seen.has(ampli.slug)) {
      seen.add(ampli.slug);
      return true;
    }
    warnDev(`slug « ${ampli.slug} » en double dans ${source} — seule la première entrée est gardée`);
    return false;
  });
}

/**
 * Les amplis déclarés dans `costum.ampli`, dans l'ordre du document.
 *
 * Slug d'URL = le champ `slug` de l'entrée, sinon sa clé : c'est le champ que Co
 * affiche et édite. Une entrée sans `path` exploitable est ignorée — aucune
 * section ne saurait quoi afficher.
 */
export function listCostumAmplis(costum: unknown): AmpliModel[] {
  if (!isPlainObj(costum) || !isPlainObj(costum.ampli)) return [];

  const amplis: AmpliModel[] = [];
  for (const [key, raw] of Object.entries(costum.ampli)) {
    const parsed = CostumAmpliEntrySchema.safeParse(raw);
    if (!parsed.success) {
      warnDev(`costum.ampli.${key} ignoré : forme invalide`, parsed.error.issues);
      continue;
    }
    const entry = parsed.data;
    amplis.push({
      slug: entry.slug ?? key,
      name: entry.name,
      description: entry.description,
      tags: entry.tags ?? [],
      path: entry.path,
      coform: entry.coform ?? null,
    });
  }
  return keepFirstBySlug(amplis, "costum.ampli");
}

/** @deprecated Forme tableau historique de `config.ampli` — cf. `LegacyAmpliConfigSchema`. */
export function listLegacyAmplis(entries: unknown[]): AmpliModel[] {
  const amplis: AmpliModel[] = [];
  entries.forEach((raw, index) => {
    const parsed = LegacyAmpliConfigSchema.safeParse(raw);
    if (!parsed.success) {
      warnDev(`config.ampli[${index}] ignoré : forme invalide`, parsed.error.issues);
      return;
    }
    const { slug, props } = parsed.data;
    amplis.push({
      slug,
      // Pas de nom en forme historique : hero et SEO gardent leurs libellés
      // génériques, exactement comme avant.
      tags: [],
      path: props.path,
      coform: OBJECT_ID.test(props.coform) ? props.coform : null,
    });
  });
  return keepFirstBySlug(amplis, "config.ampli");
}

/** Les amplis du site, quelle que soit la source. */
export function listAmplis(ampliConfig: unknown, costum: unknown): AmpliModel[] {
  switch (ampliSourceMode(ampliConfig)) {
    case "costum":
      return listCostumAmplis(costum);
    case "legacy":
      return listLegacyAmplis(ampliConfig as unknown[]);
    default:
      return [];
  }
}

export function findAmpli(amplis: AmpliModel[], slug: string): AmpliModel | null {
  return amplis.find((ampli) => ampli.slug === slug) ?? null;
}

/** Titre affiché d'un ampli : son nom, sinon son slug. */
export function ampliTitle(ampli: AmpliModel): string {
  return ampli.name ?? ampli.slug;
}

/** Casse et accents neutralisés : « idee » doit trouver « Idée ». */
function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export interface AmpliListFilters {
  /** Recherche libre sur le titre affiché et la description. */
  query?: string;
  /** Tags cochés — un ampli passe s'il porte AU MOINS UN d'entre eux (OU),
   *  même sémantique que les filtres de `MeeteemFilters`. */
  tags?: string[];
}

export function filterAmplis(amplis: AmpliModel[], { query = "", tags = [] }: AmpliListFilters): AmpliModel[] {
  const needle = normalizeText(query);
  return amplis.filter((ampli) => {
    if (tags.length > 0 && !ampli.tags.some((tag) => tags.includes(tag))) return false;
    if (needle === "") return true;
    return [ampliTitle(ampli), ampli.description]
      .some((text) => text !== undefined && normalizeText(text).includes(needle));
  });
}

/** Union des tags de tous les amplis, dédoublonnée et triée — les puces de filtre. */
export function collectAmpliTags(amplis: AmpliModel[]): string[] {
  const tags = new Set(amplis.flatMap((ampli) => ampli.tags));
  return [...tags].sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * L'ampli désigné par une saisie libre (« Accéder à un ampli ») : slug exact
 * d'abord, puis sans tenir compte de la casse — personne ne retape un slug au
 * caractère près.
 */
export function resolveAmpliInput(amplis: AmpliModel[], input: string): AmpliModel | null {
  const wanted = input.trim();
  if (wanted === "") return null;
  return findAmpli(amplis, wanted)
    ?? amplis.find((ampli) => ampli.slug.toLowerCase() === wanted.toLowerCase())
    ?? null;
}
