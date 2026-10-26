// Bundle i18n du stack carte : `SearchMapWrapper` / `MapSkeleton` / `MapProgress`
// appellent `useT("modules/search")` alors qu'ils sont montés ICI, hors section
// search — sans cet import ils afficheraient leurs clés brutes (même raison que
// l'import en tête de `SearchListView`).
import "@/modules/search/i18n";

import { Suspense } from "react";
import { MapPinOff, TriangleAlert } from "lucide-react";
import { lazy } from "vite-preload";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { MapConf } from "@/modules/search/schema";

import { ClientOnly } from "@/components/layout/ClientOnly";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import MapProgress from "@/modules/search/components/MapProgress";
import MapSkeleton from "@/modules/search/components/MapSkeleton";

// Le chunk carte (MapLibre + MapTiler + supercluster) ne doit pas peser sur le
// bundle ampli : il n'est téléchargé qu'au premier rendu de la vue carte/split.
const SearchMapWrapper = lazy(() => import("@/modules/search/components/SearchMapWrapper"));

/** La carte remplit la boîte dimensionnée par le parent (cf. `SearchMap`). */
const FILL = "absolute inset-0 z-10 overflow-hidden";

interface MeeteemMapProps {
  /** Réponses géolocalisées converties en entités carto (cf. `meeteemGeo`). */
  entities: SearchEntity[];
  /** Progression du chargement par pages — cf. `useAmpliAllAnswers`. */
  loaded: number;
  total: number | null;
  isComplete: boolean;
  capped: boolean;
  /** Chargement interrompu par un échec : ce qui est affiché est PARTIEL. */
  isPartial?: boolean;
  /** Synchro split : id focalisé → flyTo + popup du marqueur. */
  focusedItemId?: string | null;
  /** Synchro split : clic marqueur → remonte l'id (highlight de la liste). */
  onMarkerFocus?: (id: string) => void;
  /** Clic sur « En savoir plus » dans la popup : renvoyer `true` consomme le
   *  clic et remplace le détail générique du module search. */
  onItemAction?: (item: SearchEntity) => boolean | void;
  /** Conf carte relayée telle quelle (marqueur, itemAction…). Sans elle,
   *  `markerConf` vaut `{}` côté `SearchMap` et tous les marqueurs rendent la
   *  goutte par défaut — `useItemImage` n'est alors JAMAIS vrai. Passer un
   *  objet STABLE : une référence neuve re-rend tous les marqueurs. */
  map?: MapConf;
  /** Message d'état vide. Défaut : « aucune réponse localisée » — à surcharger
   *  quand la carte ne porte pas des réponses (ex. contributeurs). */
  emptyMessage?: string;
  /** Message d'état d'erreur (`isPartial`). Même raison que `emptyMessage`. */
  errorMessage?: string;
  /** Hauteur/format de la boîte — le parent décide (vue carte vs colonne split). */
  className?: string;
}

/**
 * Vue carte partagée du module ampli (MeeteemSection ET carte des
 * contributeurs du tab community) — réutilise TELLE QUELLE la carte du module
 * search (clustering, fond de carte par site, thème clair/sombre, popup) : les
 * réponses CoForm sont converties en entités carto par `meeteemGeo`, et le
 * périmètre complet arrive progressivement (`useAmpliAllAnswers`), exactement
 * comme la carte de `SearchProStatic`.
 */
export function MeeteemMap({
  entities,
  loaded,
  total,
  isComplete,
  capped,
  isPartial,
  focusedItemId,
  onMarkerFocus,
  onItemAction,
  map,
  emptyMessage,
  errorMessage,
  className,
}: MeeteemMapProps) {
  const t = useT("modules/ampli");
  const tSearch = useT("modules/search");
  const skeleton = <MapSkeleton label={String(tSearch("Chargement de la carte…"))} containerClass={FILL} />;

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border shadow-md", className)}>
      {/* Progression du chargement par pages + alerte plafond. */}
      <MapProgress loaded={loaded} total={total} isComplete={isComplete} capped={capped} />

      {entities.length > 0 ? (
        // ClientOnly : la carte n'a pas de rendu SSR (MapLibre lit `window`).
        <ClientOnly fallback={skeleton}>
          {() => (
            <Suspense fallback={skeleton}>
              <SearchMapWrapper
                results={entities}
                map={map}
                focusedItemId={focusedItemId}
                onMarkerFocus={onMarkerFocus}
                onItemAction={onItemAction}
                containerClass={FILL}
              />
            </Suspense>
          )}
        </ClientOnly>
      ) : isComplete ? (
        // Le chargement est terminé sans aucun point : soit rien n'est
        // localisé, soit la chaîne de pages a été interrompue par un échec —
        // dans les deux cas on le DIT, on ne laisse pas tourner le squelette.
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/30 p-6 text-center">
          {isPartial ? (
            <TriangleAlert className="h-10 w-10 text-amber-500" />
          ) : (
            <MapPinOff className="h-10 w-10 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {isPartial
              ? errorMessage ?? String(t("MeeteemSection.map.error"))
              : emptyMessage ?? String(t("MeeteemSection.map.empty"))}
          </p>
        </div>
      ) : (
        skeleton
      )}
    </div>
  );
}
