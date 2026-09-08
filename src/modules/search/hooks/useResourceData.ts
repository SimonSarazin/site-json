import { useMemo } from "react";
import { useT } from "@/hooks/useT";
import type { LocalizedString } from "@/types/locale-schema";
import { toValidDate } from "@/helpers/formatDate";
import { normalizeFilterValue, resolveServerDataPath, toFacetTokens } from "../lib/dropdownFilters";
import { valueColor } from "../lib/testimonial";
import type { PreviewFacetConfig, ResourceConf, SearchListEntity } from "../schema";

/** Une ligne de « repère » normalisée (champ + tokens résolus), prête pour un `ClickableFacet`. */
export interface ResourceFacetData {
  field: string;
  label?: PreviewFacetConfig["label"];
  icon?: string;
  tokens: string[];
}

/** Un document téléchargeable (fichier de `medias`). */
export interface ResourceDocument {
  url: string;
  name: string;
  /** Extension en minuscules (`pdf`, `docx`…), chaîne vide si inconnue. */
  ext: string;
}

/** Contrat de données NORMALISÉ d'une ressource — source unique nourrissant tous les designs/blocs. */
export interface ResourceData {
  title: string;
  description: string;
  date: Date | null;
  /** Vignette « héros » (image du POI, ou 1re image de galerie), ou `null`. */
  image: string | null;
  /** Catégorie : `value` (à AFFICHER — libellé de `badge.labels` si la valeur stockée est une clé,
   *  sinon la valeur stockée), `raw` (valeur STOCKÉE — celle qui sert aux maps et aux filtres),
   *  `color` (pastille/couverture), `icon` (nom lucide du type). */
  badge: { value: string; raw: string; color: string; icon: string } | null;
  /** Ville (adresse), chaîne vide si absente. */
  city: string;
  /** Liens externes (`serverData.urls`). */
  urls: string[];
  /** Galerie : URLs des médias de type `image`. */
  gallery: string[];
  /** Documents : médias de type `file`/`document`/`pdf`. */
  documents: ResourceDocument[];
  /** 1er média audio, ou `null`. */
  audio: string | null;
  /** 1er média vidéo, ou `null`. */
  video: string | null;
  facets: ResourceFacetData[];
}

/** Catégorie de ressource → icône lucide (kebab, via `DynamicIcon`). Repli `file`. */
const RESOURCE_TYPE_ICON: Record<string, string> = {
  "video": "video",
  "photo": "images",
  "compte-rendu": "file-text",
  "jeu": "gamepad-2",
  "document": "file",
  "lien": "link",
};

/** Découpe un tableau `medias` (`[{type,url,name}]`) par type de média. */
function mediasByType(medias: unknown): {
  images: string[];
  documents: ResourceDocument[];
  audio: string | null;
  video: string | null;
} {
  const images: string[] = [];
  const documents: ResourceDocument[] = [];
  let audio: string | null = null;
  let video: string | null = null;
  if (Array.isArray(medias)) {
    for (const m of medias) {
      if (!m || typeof m !== "object") continue;
      const { type, url, name } = m as { type?: string; url?: string; name?: string };
      if (typeof url !== "string" || !url) continue;
      if (type === "image") images.push(url);
      else if (type === "audio") audio ??= url;
      else if (type === "video") video ??= url;
      else if (type === "file" || type === "document" || type === "pdf") {
        const base = (name || url.split("/").pop() || "").split("?")[0];
        const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
        documents.push({ url, name: name || base || url, ext });
      }
    }
  }
  return { images, documents, audio, video };
}

/** Icône de type : map config (`badge.icons`, clés normalisées) puis map par défaut puis `file`. */
function resolveTypeIcon(value: string, iconsMap: Record<string, string> | undefined): string {
  const norm = normalizeFilterValue(value);
  if (iconsMap) {
    for (const [k, v] of Object.entries(iconsMap)) if (normalizeFilterValue(k) === norm) return v;
  }
  return RESOURCE_TYPE_ICON[norm] ?? "file";
}

/**
 * Normalise un item en `ResourceData` selon le contrat `cfg`. Réutilise `resolveServerDataPath`/`toFacetTokens`
 * + `valueColor` (comme `useTestimonialData`) et découpe `medias` par type. Défauts de champs génériques appliqués
 * ICI (la config n'est pas parsée par Zod au runtime). NB : la galerie/les documents proviennent de `medias`
 * INDEXÉ par la recherche ; la galerie complète (`about.images`/`about.files`) nécessitera un chargement d'entité.
 */
/**
 * Libellé AFFICHÉ d'une valeur de badge : entrée de `badge.labels` (comparaison NORMALISÉE, comme
 * `colors`/`icons` — la casse et les accents d'une clé de config ne doivent pas décider du rendu),
 * sinon la valeur stockée telle quelle. Pur : le résolveur de LocalizedString est passé en argument.
 */
export function resolveBadgeLabel(
  value: string,
  labels: Record<string, LocalizedString> | undefined,
  tLoc: (v: LocalizedString) => string,
): string {
  if (!labels) return value;
  const norm = normalizeFilterValue(value);
  for (const [k, v] of Object.entries(labels)) if (normalizeFilterValue(k) === norm) return tLoc(v);
  return value;
}

export function useResourceData(item: SearchListEntity, cfg: ResourceConf | undefined): ResourceData {
  // Résolution du libellé de badge : `t` route sur LocalizedString (cf. useT). Hors du useMemo —
  // un hook ne peut pas être appelé dedans ; il est dans les deps pour suivre le changement de langue.
  const t = useT("modules/search");
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

    const badgeValue = firstToken(c.badge?.field ?? "category");
    const media = mediasByType(resolveServerDataPath(sd, c.mediasField ?? "medias"));
    const facets: ResourceFacetData[] = (c.facets ?? [])
      .map((f) => ({ field: f.field, label: f.label, icon: f.icon, tokens: toFacetTokens(resolveServerDataPath(sd, f.field)) }))
      .filter((r) => r.tokens.length > 0);

    return {
      title: readString(c.titleField ?? "name"),
      description: readString(c.descriptionField ?? "description"),
      date: toValidDate(resolveServerDataPath(sd, c.dateField ?? "created")),
      image: readString(c.imageField ?? "profilMediumImageUrl") || readString("profilImageUrl") || media.images[0] || null,
      badge: badgeValue
        ? {
            // `value` = ce qu'on AFFICHE : le libellé localisé quand la valeur stockée est une clé
            // (`badge.labels`), sinon la valeur elle-même. `raw` reste la valeur STOCKÉE : c'est elle
            // qui indexe `colors`/`icons` et que comparent les filtres — les dissocier évite qu'un
            // renommage de libellé décolore les pastilles ou casse un filtre.
            value: resolveBadgeLabel(badgeValue, c.badge?.labels, t),
            raw: badgeValue,
            color: valueColor(badgeValue, { map: c.badge?.colors }),
            icon: resolveTypeIcon(badgeValue, c.badge?.icons),
          }
        : null,
      city: readString(c.cityField ?? "address.addressLocality"),
      urls: (() => {
        const v = resolveServerDataPath(sd, c.urlsField ?? "urls");
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
      })(),
      gallery: media.images,
      documents: media.documents,
      audio: media.audio,
      video: media.video,
      facets,
    };
  }, [item, cfg, t]);
}
