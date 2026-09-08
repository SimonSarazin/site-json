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
    <div className="grid items-center gap-4 sm:gap-6 md:gap-10 md:grid-cols-2">
      <div className="flex flex-col items-start gap-2 sm:gap-3">
        {/* `line-clamp-3` : un titre long ne doit pas étirer la diapositive (la
            hauteur du carrousel suit la slide la plus haute) ni repousser le CTA —
            le texte complet reste lisible au survol (`title`) et via le CTA. */}
        <h2 className="line-clamp-3 text-xl font-bold md:text-2xl ml-4" title={data.title}>{data.title}</h2>
        {data.description && <p className="line-clamp-2 text-sm opacity-90 md:text-base ml-4">{data.description}</p>}
        {click.kind !== "details" && (
          <Button asChild size="lg" style={accentStyle} className="rounded-full px-5 py-2 sm:px-6 sm:py-2.5 font-bold w-full text-base sm:text-lg md:text-xl">
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
        // `object-contain` (plutôt que `cover`) : l'image entière reste visible, jamais
        // rognée — le fond de la section (déjà derrière) comble l'espace résiduel.
        // `aspect-[16/10]` (plutôt que `4/3`) : boîte moins haute à largeur égale, pour que
        // header + « à la une » tiennent ensemble au premier écran sans scroll.
        <OptimizedImage
          src={data.image}
          alt={data.title}
          width={640}
          priority={priority}
          className="aspect-[16/10] w-4/5 sm:w-5/6 md:w-4/5 mx-auto rounded-[0px_100px_0_100px] object-contain"
        />
      )}
    </div>
  );
}
