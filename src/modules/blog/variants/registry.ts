import {
  makeVariantRegistry as makeRegistry,
  type LazyVariant,
  type VariantRegistry,
} from "@/lib/variants";

/** Noms du blog pour le registre générique de `@/lib/variants`. */
export type BlogVariant<P> = LazyVariant<P>;
export type { VariantRegistry };

export function makeVariantRegistry<P>(variants: Record<string, BlogVariant<P>>): VariantRegistry<P> {
  return makeRegistry(variants, "blog");
}
