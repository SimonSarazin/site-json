import type { ReactNode } from "react";
import { Building2, Briefcase, MapPin, Calendar, User } from "lucide-react";
import type { CollectionKey } from "@communecter/cocolight-api-client";

/**
 * Configuration des icônes par type d'entité
 * Source de vérité unique
 */
// Non exportée à dessein : aucun importateur, et le plugin react-refresh prend une
// const PascalCase suivie de `as const` pour un composant React (5 faux positifs).
const ENTITY_ICON_CONFIG = {
  organizations: {
    icon: Building2,
    iconName: "building-2",
    color: "text-purple-500 dark:text-purple-400",
    colorName: "purple",
  },
  projects: {
    icon: Briefcase,
    iconName: "briefcase",
    color: "text-blue-500 dark:text-blue-400",
    colorName: "blue",
  },
  events: {
    icon: Calendar,
    iconName: "calendar",
    color: "text-orange-500 dark:text-orange-400",
    colorName: "orange",
  },
  poi: {
    icon: MapPin,
    iconName: "map-pin",
    color: "text-green-500 dark:text-green-400",
    colorName: "green",
  },
  citoyens: {
    icon: User,
    iconName: "user",
    color: "text-primary",
    colorName: "teal",
  },
} as const;

export type EntityIconType = keyof typeof ENTITY_ICON_CONFIG;

interface GetEntityIconOptions {
  className?: string;
  withColor?: boolean;
}

/**
 * Retourne l'icône pour un type d'entité
 *
 * @param type - Type d'entité (organizations, projects, events, poi, citoyens)
 * @param optionsOrClassName - Options ou className direct pour compatibilité
 *
 * @example
 * getEntityIcon("organizations") // Icône w-5 h-5 avec couleur
 * getEntityIcon("projects", "w-12 h-12 mx-auto") // Taille custom
 * getEntityIcon("events", { className: "w-4 h-4", withColor: false })
 */
export function getEntityIcon(
  type: EntityIconType | CollectionKey | string,
  optionsOrClassName: GetEntityIconOptions | string = {}
): ReactNode {
  // Support ancien API: getEntityIcon(type, "w-12 h-12")
  const options: GetEntityIconOptions =
    typeof optionsOrClassName === "string"
      ? { className: optionsOrClassName }
      : optionsOrClassName;

  const { className = "w-12 h-12 mx-auto", withColor = false } = options;

  const config = ENTITY_ICON_CONFIG[type as EntityIconType];
  if (!config) {
    return <MapPin className={`${className} ${withColor ? "text-muted-foreground" : ""}`} />;
  }

  const Icon = config.icon;
  return <Icon className={`${className} ${withColor ? config.color : ""}`} />;
}

/**
 * Retourne le composant icône (sans instancier)
 */
export function getEntityIconComponent(type: EntityIconType | string) {
  return ENTITY_ICON_CONFIG[type as EntityIconType]?.icon ?? MapPin;
}

/**
 * Retourne le nom de l'icône en kebab-case (pour lucide-react/dynamic)
 *
 * @example
 * getEntityIconName("organizations") // "building-2"
 * getEntityIconName("poi") // "map-pin"
 */
export function getEntityIconName(type: EntityIconType | string): string {
  return ENTITY_ICON_CONFIG[type as EntityIconType]?.iconName ?? "map-pin";
}

/**
 * Retourne le nom de la couleur (pour avatars, badges, etc.)
 *
 * @example
 * getEntityColorName("organizations") // "purple"
 * getEntityColorName("projects") // "blue"
 */
export function getEntityColorName(type: EntityIconType | string): string {
  return ENTITY_ICON_CONFIG[type as EntityIconType]?.colorName ?? "gray";
}

/**
 * Mapping des noms de couleurs vers classes Tailwind bg + text
 */
const COLOR_CLASSES_MAP: Record<string, string> = {
  purple: "bg-purple-50 text-purple-500 dark:bg-purple-950 dark:text-purple-400",
  blue: "bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-400",
  orange: "bg-orange-50 text-orange-500 dark:bg-orange-950 dark:text-orange-400",
  green: "bg-green-50 text-green-500 dark:bg-green-950 dark:text-green-400",
  teal: "bg-primary/10 text-primary",
  red: "bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400",
  yellow: "bg-yellow-50 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-400",
  gray: "bg-gray-50 text-gray-500 dark:bg-gray-950 dark:text-gray-400",
};

/**
 * Retourne les classes Tailwind bg + text pour une couleur d'entité
 *
 * @example
 * getEntityColorClasses("organizations") // "bg-purple-50 text-purple-500 dark:..."
 * getEntityColorClasses("projects") // "bg-blue-50 text-blue-500 dark:..."
 */
export function getEntityColorClasses(type: EntityIconType | string): string {
  const colorName = ENTITY_ICON_CONFIG[type as EntityIconType]?.colorName ?? "gray";
  return COLOR_CLASSES_MAP[colorName] ?? COLOR_CLASSES_MAP.gray;
}
