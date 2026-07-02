import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useClientModule } from "@/hooks/useClientModule";
import type { MultiEvalStep } from "../types";

interface MultiEvalRadarTabsProps {
  steps: MultiEvalStep[];
  /** Affiche le titre de la step au-dessus du radar — utile en mono-step (pas d'onglet). */
  showStepTitle?: boolean;
  className?: string;
}

/**
 * Affiche les radars multi-eval d'une réponse en ONGLETS (un onglet par step).
 *
 * Remplace l'ancien carousel à flèches : les flèches de navigation (apparition
 * au survol) passaient inaperçues — les utilisateurs ne voyaient qu'une seule
 * step. Les onglets exposent toutes les steps d'emblée, visibles et cliquables,
 * sans dépendre du hover (donc utilisable au tactile aussi).
 *
 * Mono-step : on rend juste le radar (pas d'onglet pour rien).
 *
 * Recharts est lazy-chargé via `useClientModule` (~150kB) — résolu au mount
 * client uniquement, le composant ne pèse pas dans le bundle initial. Radix
 * Tabs ne monte que le contenu de l'onglet actif → un seul radar rendu à la fois.
 */
export function MultiEvalRadarTabs({
  steps,
  showStepTitle = true,
  className,
}: MultiEvalRadarTabsProps) {
  const [mounted, radarMod] = useClientModule(() => import("./MultiEvalRadarChart"));
  const RadarSection = radarMod?.RadarSection;

  if (steps.length === 0) return null;
  if (!mounted || !RadarSection) {
    return (
      <div className={cn("h-[360px] w-full animate-pulse rounded-md bg-muted/40", className)} />
    );
  }

  // Mono-step : pas d'onglet, on rend directement le radar.
  if (steps.length === 1) {
    const step = steps[0];
    return (
      <div className={className}>
        {showStepTitle && (
          <h4 className="text-sm font-semibold mb-1">{step.stepName}</h4>
        )}
        {/* Le conteneur recharts réserve un vide au-dessus du radar (radar +
            légende centrés dans 360px). On remonte le bloc pour coller le radar
            au titre — la marge négative reste inférieure à ce vide, pas de rognage. */}
        <div className="-mt-6">
          <RadarSection step={step} />
        </div>
      </div>
    );
  }

  // Multi-step : onglets sur UNE seule ligne (les labels longs passent en
  // ellipsis), et le nom COMPLET de la step est répété au-dessus du radar — le
  // libellé d'onglet pouvant être tronqué. `title` expose le nom complet au survol.
  return (
    <Tabs defaultValue={steps[0].stepKey} className={cn("w-full", className)}>
      <TabsList className="flex w-full">
        {steps.map((step) => (
          <TabsTrigger
            key={step.stepKey}
            value={step.stepKey}
            title={step.stepName}
            className="min-w-0 flex-1 text-xs"
          >
            <span className="truncate">{step.stepName}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {steps.map((step) => (
        <TabsContent key={step.stepKey} value={step.stepKey} className="mt-2">
          {showStepTitle && (
            <h4 className="text-sm font-semibold mb-1">{step.stepName}</h4>
          )}
          {/* Remonte le radar pour le coller au titre (cf. mono-step). */}
          <div className="-mt-6">
            <RadarSection step={step} />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
