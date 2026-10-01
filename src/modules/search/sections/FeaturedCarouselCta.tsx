import { ArrowRight } from "lucide-react";
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
  /** `link` : texte + flèche dans `accentColor`, sans fond — pour un CTA posé SOUS le texte de la
   *  diapositive plutôt qu'en bouton. Défaut `button` (comportement historique). */
  style?: "button" | "link";
}

/**
 * Bouton d'une entrée « à la une ». Partagé par la diapositive (habillage historique, bouton pleine
 * largeur sous le texte) et par le pied de carte (habillage `card`, où il se lit à droite des points de
 * position) : une seule définition du lien, de son ouverture en nouvel onglet et de sa couleur.
 *
 * Rend `null` quand l'action au clic n'est pas un lien (`details`) — il n'y a alors rien à pointer.
 */
export default function FeaturedCarouselCta({ item, ctaLabel, itemAction, accentColor, accentTextColor, compact = false, style = "button" }: FeaturedCarouselCtaProps) {
  const t = useT();
  const click = resolveItemClick(item, itemAction);
  if (click.kind === "details") return null;
  const newTab = click.kind === "link" && click.newTab;
  const texte = t(ctaLabel ?? "En savoir plus");

  if (style === "link") {
    const classeLien = "inline-flex items-center gap-1.5 font-bold underline underline-offset-4";
    const styleCouleur = { color: accentColor ?? undefined };
    return newTab ? (
      <a href={click.href} target="_blank" rel="noopener noreferrer" className={classeLien} style={styleCouleur}>
        {texte}<ArrowRight className="size-4 shrink-0" aria-hidden />
      </a>
    ) : (
      <Link to={click.href} className={classeLien} style={styleCouleur}>
        {texte}<ArrowRight className="size-4 shrink-0" aria-hidden />
      </Link>
    );
  }

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
