import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { resolveItemClick } from "../lib/itemAction";
import type { FeaturedCarouselSectionProps, SearchListEntity } from "../schema";
import { accentStyle } from "@/lib/accentStyle";

interface FeaturedCarouselCtaProps {
  item: SearchListEntity;
  ctaLabel: FeaturedCarouselSectionProps["ctaLabel"];
  itemAction: NonNullable<FeaturedCarouselSectionProps["itemAction"]>;
  accentColor: FeaturedCarouselSectionProps["accentColor"];
  accentTextColor: FeaturedCarouselSectionProps["accentTextColor"];
  /** `true` en habillage « carte » : bouton compact, posé par la SECTION sur la ligne des points. */
  compact?: boolean;
}

/**
 * Bouton d'une entrée « à la une ». Partagé par la diapositive (habillage historique, bouton pleine
 * largeur sous le texte) et par le pied de carte (habillage `card`, où il se lit à droite des points de
 * position) : une seule définition du lien, de son ouverture en nouvel onglet et de sa couleur.
 *
 * Rend `null` quand l'action au clic n'est pas un lien (`details`) — il n'y a alors rien à pointer.
 */
export default function FeaturedCarouselCta({ item, ctaLabel, itemAction, accentColor, accentTextColor, compact = false }: FeaturedCarouselCtaProps) {
  const t = useT();
  const click = resolveItemClick(item, itemAction);
  if (click.kind === "details") return null;
  const newTab = click.kind === "link" && click.newTab;
  const texte = t(ctaLabel ?? "En savoir plus");

  return (
    <Button
      asChild
      size="lg"
      style={accentStyle(accentColor, accentTextColor)}
      className={`rounded-full px-5 py-2 sm:px-6 font-bold ${compact ? "w-auto text-sm sm:text-base" : "w-full text-base sm:text-lg"}`}
    >
      {newTab ? (
        <a href={click.href} target="_blank" rel="noopener noreferrer">
          {texte}
        </a>
      ) : (
        <Link to={click.href}>{texte}</Link>
      )}
    </Button>
  );
}
