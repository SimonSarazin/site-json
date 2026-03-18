import { useMemo, useState } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useSearchQuery } from "./hooks/useSearchQuery";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import CardCountCT from "./components/card/CardCountCT";
import type { CardCountCTSectionProps } from "./schema";
import { Loader2 } from "lucide-react";
import "@/modules/search/i18n";
import { log } from "node:console";

export interface CardCountCTSectionWrapperProps {
  id?: string;
  props: CardCountCTSectionProps;
}

const BG_MAP: Record<string, string> = {
  card: "bg-card",
  muted: "bg-muted",
  primary: "bg-primary/10",
  secondary: "bg-secondary",
  accent: "bg-accent/10",
  transparent: "bg-transparent",
  "gradient-teal": "bg-gradient-to-b from-teal-200 to-white",
  "gradient-blue": "bg-gradient-to-b from-blue-200 to-white",
  "gradient-indigo": "bg-gradient-to-b from-indigo-200 to-white",
  "gradient-cyan": "bg-gradient-to-b from-cyan-100 to-teal-200",
  "bg-cyan-500": "bg-cyan-500",
  "bg-blue-600": "bg-blue-600",
};

/**
 * CardCountCTSection – Section dédiée à l'affichage des compteurs
 * 
 * Utilise le même hook useSearchQuery que SearchProStatic pour appeler
 * l'API globalautocomplete, mais n'affiche que les compteurs (count)
 * retournés dans la réponse, pas la liste des résultats.
 */
export function CardCountCTSection({ id, props }: CardCountCTSectionWrapperProps) {
  const { loaded } = useLoadNamespace("modules/search");
  const { entity } = useCocolight();

  console.log("CardCountCTSection entity : ", entity, " loaded : ", loaded);
  const { title, subtitle, cards, baseParams = {}, bg } = props;

  const sectionBg = bg && bg !== "default" ? (BG_MAP[bg] || "") : "";
  // const localityId = entity?.serverData?.address?.localityId;
  // Paramètres pour la recherche (on n'a besoin que du count, pas de résultats)
  const [searchType] = useState<Record<string, string[]> | null>(
    baseParams?.defaultTypes ? { type: baseParams.defaultTypes } : null
  );
  const localityId = entity?.serverData?.address?.localityId;
  baseParams.defaultFilters = baseParams.defaultFilters || {};
  if(localityId) {
    baseParams.defaultFilters["address.localityId"] = localityId;
  }
  console.log("baseParams : ", baseParams, " searchType : ", searchType);
  
  const mergedBaseParams = useMemo(() => ({
    ...baseParams,
    indexStepList: 10, // On ne veut pas de résultats, juste le count
  }), [baseParams]);

  const {
    data,
    isLoading,
    isPending,
  } = useSearchQuery({
    queryKeyPrefix: "cardCountCT",
    searchText: "",
    searchTags: {},
    searchType,
    mapUsed: false,
    baseParams: mergedBaseParams,
  });

  // Extraire le count de la première page
  const count = useMemo<Record<string, number>>(() => {
    const firstPage = data?.pages?.[0];
    if (!firstPage?.count || typeof firstPage.count !== "object") {
      return {};
    }
    return firstPage.count as Record<string, number>;
  }, [data?.pages]);

  if (!loaded || !entity) {
    return (
      <section id={id} className={`py-16 px-4 ${sectionBg}`}>
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="animate-spin h-6 w-6 mr-2" />
        </div>
      </section>
    );
  }

  return (
    <section id={id} className={`py-16 px-4 ${sectionBg}`}>
      <CardCountCT
        count={count}
        cards={cards}
        title={title}
        subtitle={subtitle}
        isLoading={isPending || isLoading}
        bg={bg}
        isDarkBg={bg === "secondary" }
      />
    </section>
  );
}

export default CardCountCTSection;
