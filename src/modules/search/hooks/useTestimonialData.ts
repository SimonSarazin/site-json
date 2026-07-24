import { useMemo } from "react";
import { toValidDate } from "@/helpers/formatDate";
import { resolveServerDataPath, toFacetTokens } from "../lib/dropdownFilters";
import { firstMediaUrl, valueColor } from "../lib/testimonial";
import type { PreviewFacetConfig, SearchListEntity, TestimonialConf } from "../schema";

/** Une ligne de « repère » normalisée (champ + tokens résolus), prête pour un `ClickableFacet`. */
export interface TestimonialFacetData {
  field: string;
  label?: PreviewFacetConfig["label"];
  icon?: string;
  tokens: string[];
}

/** Contrat de données NORMALISÉ d'un témoignage — source unique nourrissant tous les designs. */
export interface TestimonialData {
  quote: string;
  title: string;
  subtitle: string;
  date: Date | null;
  /** Catégorie (pilote la teinte de bulle + la pastille), ou `null` si le champ est absent. */
  badge: { value: string; color: string } | null;
  /** Accent (ex. territoire), ou `null`. */
  accent: { value: string; color: string } | null;
  audio: string | null;
  facets: TestimonialFacetData[];
}

/**
 * Normalise un item de recherche en `TestimonialData` selon le contrat de config `cfg` (noms de champs +
 * maps de couleur). Réutilise `resolveServerDataPath`/`toFacetTokens` (dot-path + multi-valeurs) et le
 * moteur `valueColor`. Ne fait AUCun rendu ni i18n — renvoie les `label` bruts (LocalizedString) ; ce sont
 * les presenters qui appliquent `useT()`. Défauts de champs génériques (description/name/created/medias)
 * appliqués ICI car la config n'est pas parsée par Zod au runtime (les `.default()` du schéma n'agissent pas).
 */
export function useTestimonialData(
  item: SearchListEntity,
  cfg: TestimonialConf | undefined,
): TestimonialData {
  return useMemo(() => {
    const sd = (item?.serverData ?? {}) as Record<string, unknown>;
    const c = cfg ?? {};

    const readString = (path: string, fallback = ""): string => {
      const v = resolveServerDataPath(sd, path);
      if (typeof v === "string") return v;
      if (typeof v === "number") return String(v);
      return fallback;
    };
    const firstToken = (field: string | undefined): string =>
      field ? (toFacetTokens(resolveServerDataPath(sd, field))[0] ?? "") : "";

    const badgeValue = firstToken(c.badge?.field);
    const accentValue = firstToken(c.accent?.field);

    const facets: TestimonialFacetData[] = (c.facets ?? [])
      .map((f) => ({
        field: f.field,
        label: f.label,
        icon: f.icon,
        tokens: toFacetTokens(resolveServerDataPath(sd, f.field)),
      }))
      .filter((r) => r.tokens.length > 0);

    return {
      quote: readString(c.quoteField ?? "description"),
      title: readString(c.titleField ?? "name"),
      subtitle: firstToken(c.subtitleField),
      date: toValidDate(resolveServerDataPath(sd, c.dateField ?? "created")),
      badge: badgeValue
        ? { value: badgeValue, color: valueColor(badgeValue, { map: c.badge?.colors }) }
        : null,
      accent: accentValue
        ? { value: accentValue, color: valueColor(accentValue, { map: c.accent?.colors }) }
        : null,
      audio: firstMediaUrl(resolveServerDataPath(sd, c.audioField ?? "medias")),
      facets,
    };
  }, [item, cfg]);
}
