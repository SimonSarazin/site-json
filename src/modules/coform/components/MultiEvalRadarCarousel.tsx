import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { RadarSection } from "./MultiEvalChartDialog";
import type { MultiEvalStep } from "../types";

interface MultiEvalRadarCarouselProps {
  steps: MultiEvalStep[];
  /** Affiche le titre de la step au-dessus du radar (utile en multi-step). */
  showStepTitle?: boolean;
  className?: string;
}

/**
 * Affiche les radars multi-eval d'une réponse en carousel horizontal avec
 * indicateurs (dots) en bas. Plus compact qu'une liste verticale quand il y a
 * plusieurs steps — particulièrement utile en sidebar étroite.
 *
 * Si une seule step, on rend juste le radar (pas de carousel pour rien).
 */
export function MultiEvalRadarCarousel({
  steps,
  showStepTitle = true,
  className,
}: MultiEvalRadarCarouselProps) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Sync l'index courant avec l'API embla : sur chaque "select", on lit
  // `selectedScrollSnap()` et on push dans le state local pour mettre à jour
  // les dots.
  useEffect(() => {
    if (!api) return;
    setSelectedIndex(api.selectedScrollSnap());
    const handler = () => setSelectedIndex(api.selectedScrollSnap());
    api.on("select", handler);
    return () => {
      api.off("select", handler);
    };
  }, [api]);

  if (steps.length === 0) return null;

  // Cas mono-step : pas de carousel, on rend directement le radar.
  if (steps.length === 1) {
    const step = steps[0];
    return (
      <div className={className}>
        {showStepTitle && (
          <h4 className="text-sm font-semibold mb-3">{step.stepName}</h4>
        )}
        <RadarSection step={step} />
      </div>
    );
  }

  // Style "soft" pour les flèches : invisibles par défaut, fade-in lent au
  // hover du container, posées au bord (pas en dehors) du carousel pour ne
  // pas pousser la mise en page. Coin transparent, légèrement floutées,
  // discrètes — pas un appel à l'action, juste un raccourci pour les utilisateurs
  // qui survolent. Cachées sur touch (hover ne déclenche pas).
  const arrowClass = cn(
    "size-6 opacity-0 transition-opacity duration-300 ease-out",
    "group-hover/radar:opacity-60 hover:!opacity-100 focus-visible:!opacity-100",
    "disabled:!opacity-0 disabled:pointer-events-none",
    "bg-background/60 backdrop-blur-sm border-0 shadow-none",
    "text-muted-foreground hover:text-foreground",
    "top-1/2 -translate-y-1/2"
  );

  return (
    <div className={cn("space-y-2", className)}>
      <Carousel setApi={setApi} opts={{ align: "start" }} className="group/radar">
        <CarouselContent>
          {steps.map((step) => (
            <CarouselItem key={step.stepKey}>
              {showStepTitle && (
                <h4 className="text-sm font-semibold mb-3">{step.stepName}</h4>
              )}
              <RadarSection step={step} />
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious className={cn(arrowClass, "left-0")} />
        <CarouselNext className={cn(arrowClass, "right-0")} />
      </Carousel>

      {/* Dots indicateurs : cliquables pour naviguer directement à une step. */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        {steps.map((step, idx) => {
          const isActive = idx === selectedIndex;
          return (
            <button
              key={step.stepKey}
              type="button"
              onClick={() => api?.scrollTo(idx)}
              aria-label={`Aller à ${step.stepName}`}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all",
                isActive
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
