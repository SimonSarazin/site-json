import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useT } from "@/hooks/useT";
import { useResourceData } from "../hooks/useResourceData";
import { resolveItemClick } from "../lib/itemAction";
import type { FeaturedCarouselSectionProps, SearchListEntity } from "../schema";

interface FeaturedCarouselSlideProps {
  item: SearchListEntity;
  ctaLabel: FeaturedCarouselSectionProps["ctaLabel"];
  resource: FeaturedCarouselSectionProps["resource"];
  itemAction: NonNullable<FeaturedCarouselSectionProps["itemAction"]>;
  accentColor: FeaturedCarouselSectionProps["accentColor"];
  priority?: boolean;
}

/**
 * Une diapositive du carrousel « à la une » : titre + description + CTA à gauche, image à droite.
 * Le badge `badgeLabel` n'est PLUS ici — il défilerait avec chaque diapositive ; il est rendu une
 * seule fois, en position absolue, par `FeaturedCarouselSection`. Isolée de `FeaturedCarouselSection`
 * car `useResourceData` est un hook — impossible à appeler dans un `.map()` du parent (règle des
 * hooks), même découpage que `CardResource`/`CardResourceCard`.
 */
export default function FeaturedCarouselSlide({ item, ctaLabel, resource, itemAction, accentColor, priority }: FeaturedCarouselSlideProps) {
  const t = useT();
  const data = useResourceData(item, resource);
  const click = resolveItemClick(item, itemAction);
  const newTab = click.kind === "link" && click.newTab;
  // `accentColor` config-driven (CTA) — cf. `background` sur la section : même couple fond
  // fixe/texte blanc fixe, indépendant du thème.
  const accentStyle = accentColor ? { backgroundColor: accentColor, color: "#fff" } : undefined;
  const ctaText = t(ctaLabel ?? "En savoir plus");

  return (
    <div className="grid items-center gap-8 sm:gap-12 md:gap-20 md:grid-cols-2">
      {/* `pt-16 sm:pt-20 md:pt-0` : réserve la place du badge (rendu à part, en position absolue
          par `FeaturedCarouselSection`) — sans image à côté pour pousser le titre vers le bas
          (colonne unique en dessous de `md:`), il chevaucherait sinon le badge. À partir de `md:`,
          les 2 colonnes + le centrage vertical du grid donnent déjà assez de dégagement. */}
      <div className="flex flex-col items-start gap-3 sm:gap-5 pt-16 sm:pt-20 md:pt-0">
        <h2 className="text-2xl font-bold md:text-4xl ml-4">{data.title}</h2>
        {data.description && <p className="line-clamp-3 text-base opacity-90 md:text-lg ml-4 sm:text-sm">{data.description}</p>}
        {click.kind !== "details" && (
          // Échelle simple lg → 2xl → 3xl. L'ancien `xs:text-xs` ne s'appliquait que sur les
          // sites dont le CSS définit `--breakpoint-xs` (parent62, tiers-lieux…) et seulement
          // dans la fenêtre 475-640px (texte minuscule entre deux tailles larges — incohérent,
          // vérifié au rendu) : retiré, le mobile <475px garde le `text-lg` qu'il avait déjà.
          <Button asChild size="lg" style={accentStyle} className="rounded-full px-6 py-3 sm:px-8 sm:py-4 font-bold w-full text-lg sm:text-2xl md:text-3xl">
            {newTab ? (
              <a href={click.href} target="_blank" rel="noopener noreferrer">
                {ctaText}
              </a>
            ) : (
              <Link to={click.href}>{ctaText}</Link>
            )}
          </Button>
        )}
      </div>
      {data.image && (
        // `w-11/12 mx-auto sm:w-full` : image légèrement réduite en xs uniquement (demande directe).
        // `mb-16 sm:mb-20 md:mb-0` : symétrique du `pt-16 sm:pt-20 md:pt-0` de la colonne texte
        // ci-dessus (réservé pour le badge) — sans lui, l'espace en bas de section (juste `py-16` du
        // wrapper) était deux fois plus petit que l'espace en haut (`py-16` + `pt-16`).
        <OptimizedImage
          src={data.image}
          alt={data.title}
          width={640}
          priority={priority}
          className="aspect-[4/3] w-11/12 mx-auto sm:w-full mb-16 sm:mb-0 md:mb-0 rounded-[0px_100px_0_100px] object-cover"
        />
      )}
    </div>
  );
}
