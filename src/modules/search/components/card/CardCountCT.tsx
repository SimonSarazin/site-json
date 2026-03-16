import { useMemo } from "react";
import * as LucideIcons from "lucide-react";
import { useT } from "@/hooks/useT";
import type { CardCountCTSectionProps } from "../../schema";
import { SEARCH_TYPE_ICON_NAMES } from "../../schema";

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
const COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  violet: { bg: "bg-[#1e1a2e]", text: "text-violet-400" },
  teal:   { bg: "bg-[#0d1f1f]", text: "text-teal-400" },
  pink:   { bg: "bg-[#261523]", text: "text-pink-400" },
  red:    { bg: "bg-[#231520]", text: "text-red-400" },
  yellow: { bg: "bg-[#1f1a0d]", text: "text-yellow-400" },
  green:  { bg: "bg-[#0d1f12]", text: "text-green-400" },
  indigo: { bg: "bg-[#15172e]", text: "text-indigo-400" },
  orange: { bg: "bg-[#1f1508]", text: "text-orange-400" },
  blue:   { bg: "bg-[#0d1826]", text: "text-blue-400" },
  cyan:   { bg: "bg-[#0a1e22]", text: "text-cyan-400" },
  purple: { bg: "bg-[#1a1228]", text: "text-purple-400" },
  gray:   { bg: "bg-[#1a1e26]", text: "text-gray-400" },
};

/** Résoudre un nom d'icône Lucide en composant */
function resolveLucideIcon(iconName: string): React.ComponentType<{ className?: string }> | null {
  // Convertir kebab-case en PascalCase (ex: "map-pin" → "MapPin")
  const pascalName = iconName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return (LucideIcons as Record<string, any>)[pascalName] ?? null;
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 p-5 rounded-2xl bg-[#1a2233] animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-slate-700 rounded" />
                <div className="w-10 h-7 bg-slate-700 rounded" />
              </div>
              <div className="w-24 h-4 bg-slate-700 rounded" />
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
        <div className="mb-10 text-center">
          {title && (
            <h2 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {t(title)}
            </h2>
          )}
          {subtitle && (
            <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl">
              {t(subtitle)}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {displayCards.map((card) => {
          const colorClasses = COLOR_CLASSES[card.color] || COLOR_CLASSES.indigo;
          const iconName = card.icon || "circle";
          const IconComponent = resolveLucideIcon(iconName);

          const content = (
            <>
              <div className="flex items-center gap-3">
                {IconComponent && (
                  <IconComponent className={`w-6 h-6 ${colorClasses.text} shrink-0`} />
                )}
                <span className="text-3xl font-extrabold text-white leading-none">
                  {card.value}
                </span>
              </div>
              <span className="text-sm text-slate-400 leading-snug">
                {typeof card.label === "string" ? card.label : t(card.label)}
              </span>
            </>
          );

          if (card.href) {
            return (
              <a
                key={card.countKey}
                href={card.href}
                className={`flex flex-col gap-2 p-5 rounded-2xl ${colorClasses.bg} hover:brightness-110 transition-all`}
              >
                {content}
              </a>
            );
          }

          return (
            <div
              key={card.countKey}
              className={`flex flex-col gap-2 p-5 rounded-2xl ${colorClasses.bg}`}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
