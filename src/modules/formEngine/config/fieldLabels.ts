/**
 * Catalogue de LABELS i18n (`LocalizedString` fr/en) pour les champs des configs GÉNÉRÉES — clé = nom
 * de champ (base entité + champs costum tiers-lieux). La source schéma/costum n'a pas de libellé humain
 * fiable ; ce catalogue (côté site = couche UI) les fournit, traduisibles. Fallback = nom humanisé.
 *
 * La config générée reste ÉDITABLE : ces labels sont un point de départ propre, surchargeable à la main.
 */
import type { LocalizedString } from "@/types/locale-schema";

export const FIELD_LABELS: Record<string, LocalizedString> = {
  // ── champs de base d'entité ──
  name: { fr: "Nom", en: "Name" },
  type: { fr: "Type", en: "Type" },
  role: { fr: "Rôle", en: "Role" },
  email: { fr: "Email", en: "Email" },
  url: { fr: "Site web", en: "Website" },
  telephone: { fr: "Téléphone", en: "Phone" },
  shortDescription: { fr: "Description courte", en: "Short description" },
  description: { fr: "Description", en: "Description" },
  tags: { fr: "Tags", en: "Tags" },
  address: { fr: "Adresse", en: "Address" },
  socialNetwork: { fr: "Réseaux sociaux", en: "Social networks" },
  openingHours: { fr: "Horaires d'ouverture", en: "Opening hours" },
  profil_avatar: { fr: "Logo / image", en: "Logo / image" },
  video: { fr: "Vidéos", en: "Videos" },
  // ── champs costum tiers-lieux (navigatorDesTierslieux / reseauTierslieux …) ──
  typePlace: { fr: "Type de tiers-lieu", en: "Type of place" },
  manageModel: { fr: "Mode de gestion", en: "Management model" },
  buildingSurfaceArea: { fr: "Surface bâtie (m²)", en: "Building surface (m²)" },
  siteSurfaceArea: { fr: "Surface du site (m²)", en: "Site surface (m²)" },
  holderOrganization: { fr: "Structure porteuse", en: "Holder organization" },
  openingDate: { fr: "Date d'ouverture", en: "Opening date" },
  formLocality: { fr: "Localité", en: "Locality" },
  photo: { fr: "Photo", en: "Photo" },
  similarLink: { fr: "Lien similaire", en: "Similar link" },
  extraManageModel: { fr: "Mode de gestion (autre)", en: "Management model (other)" },
  extraTypePlace: { fr: "Type de lieu (autre)", en: "Type of place (other)" },
  location: { fr: "Localisation", en: "Location" },
};

/** camelCase / snake_case → libellé humain (fallback hors catalogue). Ex. `buildingSurfaceArea` → `Building surface area`. */
export function humanizeFieldName(name: string): string {
  const s = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Label i18n d'un champ : catalogue → `fallback` fourni → nom humanisé. Toujours un `LocalizedString`
 * (le catalogue, fr+en, l'emporte sur un libellé générique fourni en fallback).
 */
export function fieldLabel(name: string, fallback?: string | LocalizedString): LocalizedString {
  const fromCatalog = FIELD_LABELS[name];
  if (fromCatalog) return fromCatalog;
  if (fallback && typeof fallback === "object") return fallback;
  if (typeof fallback === "string" && fallback.length) return { fr: fallback };
  return { fr: humanizeFieldName(name) };
}
