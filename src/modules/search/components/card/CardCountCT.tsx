import { ComponentType, useMemo } from "react";
import {
  HandHeart, Store, Users, LandPlot, Handshake, Building2,
  LayoutDashboard, CalendarDays, User, MapPin, FileText, Newspaper, Lightbulb,
} from "lucide-react";
import { useT } from "@/hooks/useT";
import type { CardCountCTSectionProps } from "../../schema";
import { SEARCH_TYPE_ICON_NAMES } from "../../schema";

/**
 * Mapping kebab-case → composant lucide importé en nommé.
 * Couvre les valeurs de `SEARCH_TYPE_ICON_NAMES` (13 icônes). Imports
 * statiques → tree-shaking actif (`import *` désactivait le tree-shaking
 * et forçait le bundling complet de lucide-react).
 */
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  "hand-heart": HandHeart,
  "store": Store,
  "users": Users,
  "land-plot": LandPlot,
  "handshake": Handshake,
  "building-2": Building2,
  "layout-dashboard": LayoutDashboard,
  "calendar-days": CalendarDays,
  "user": User,
  "map-pin": MapPin,
  "file-text": FileText,
  "newspaper": Newspaper,
  "lightbulb": Lightbulb,
};

/** Couleurs par défaut par type (border + icon) */
const DEFAULT_COLORS: Record<string, string> = {
  NGO: "violet",
  LocalBusiness: "teal",
  Group: "pink",
  GovernmentOrganization: "red",
  Cooperative: "yellow",
  organizations: "violet",
  projects: "indigo",
  events: "cyan",
  citoyens: "blue",
  poi: "green",
};

/** Labels par défaut par type */
const DEFAULT_LABELS: Record<string, { fr: string; en: string }> = {
  NGO: { fr: "Association", en: "Association" },
  LocalBusiness: { fr: "Entreprise", en: "Business" },
  Group: { fr: "Groupe", en: "Group" },
  GovernmentOrganization: { fr: "Service Public", en: "Public Service" },
  Cooperative: { fr: "Coopérative", en: "Cooperative" },
  organizations: { fr: "Organisations", en: "Organizations" },
  projects: { fr: "Projets", en: "Projects" },
  events: { fr: "Événements", en: "Events" },
  citoyens: { fr: "Citoyens", en: "Citizens" },
  poi: { fr: "Point d'intérêt", en: "Point of interest" },
};

/**
 * Mapping Tailwind color → classes CSS
 * On utilise des classes complètes pour que Tailwind les détecte (pas de concaténation dynamique)
 */

/** Résoudre un nom d'icône Lucide en composant */
function resolveLucideIcon(iconName: string): ComponentType<{ className?: string }> | null {
  return ICON_MAP[iconName] ?? null;
}

export interface CardCountCTProps {
  /** Objet count retourné par l'API globalautocomplete */
  count: Record<string, number>;
  /** Configuration des cards (optionnel, sinon auto-détecté) */
  cards?: CardCountCTSectionProps["cards"];
  /** Titre de la section */
  title?: CardCountCTSectionProps["title"];
  /** Sous-titre de la section */
  subtitle?: CardCountCTSectionProps["subtitle"];
  /** Est-ce que le chargement est en cours */
  isLoading?: boolean;
  /** Background de la section */
  bg?: string;
  /** Si le fond est sombre (pour adapter le style des cartes) */
  isDarkBg?: boolean;
}

export default function CardCountCT({ count, cards, title, subtitle, isLoading }: CardCountCTProps) {
  const t = useT("modules/search");

  /** Construire la liste des cartes à afficher */
  const displayCards = useMemo(() => {
    if (cards && cards.length > 0) {
      // Mode configuré : on utilise les cartes définies dans le JSON
      return cards
        .map((card) => ({
          countKey: card.countKey,
          label: card.label,
          icon: card.icon,
          color: card.color || DEFAULT_COLORS[card.countKey] || "indigo",
          href: card.href,
          value: count[card.countKey] ?? 0,
        }))
        .filter((card) => card.value > 0); // On n'affiche pas si count = 0
    }

    // Mode auto-détecté : on affiche toutes les clés du count sauf spam/total
    return Object.entries(count)
      .filter(([key, value]) => key !== "spam" && key !== "total" && value > 0)
      .map(([key, value]) => ({
        countKey: key,
        label: DEFAULT_LABELS[key] || { fr: key, en: key },
        icon: SEARCH_TYPE_ICON_NAMES[key as keyof typeof SEARCH_TYPE_ICON_NAMES],
        color: DEFAULT_COLORS[key] || "indigo",
        href: undefined as string | undefined,
        value,
      }));
  }, [cards, count]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-primary-foreground/30" />
              <div className="w-12 h-6 bg-primary-foreground/30 rounded" />
              <div className="w-16 h-4 bg-primary-foreground/30 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (displayCards.length === 0) {
    return null; // Rien à afficher
  }

  return (
    <div className="container mx-auto max-w-5xl">
      {(title || subtitle) && (
        <div className="mb-12 text-center">
          {title && (
            <h2 className="text-4xl md:text-5xl font-bold mb-10 text-primary-foreground">
              {t(title)}
            </h2>
          )}
          {subtitle && (
            <p className="text-lg mb-6 md:text-xl text-primary-foreground/90">
              {t(subtitle)}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8">
        {displayCards.map((card) => {
          const iconName = card.icon || "circle";
          const IconComponent = resolveLucideIcon(iconName);

          const content = (
            <div className="flex flex-col items-center text-center">
              {IconComponent && (
                <IconComponent className="w-8 h-8 text-primary-foreground mb-3" />
              )}
              <span className="text-4xl font-bold text-primary-foreground mb-2">
                {card.value}
              </span>
              <span className="text-lg text-primary-foreground/80">
                {typeof card.label === "string" ? card.label : t(card.label)}
              </span>
            </div>
          );

          if (card.href) {
            return (
              <a
                key={card.countKey}
                href={card.href}
                className="transition-opacity hover:opacity-80"
              >
                {content}
              </a>
            );
          }

          return (
            <div key={card.countKey}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
