import { useMemo, useState } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useSearchQuery } from "../hooks/useSearchQuery";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import CardCountCT from "../components/card/CardCountCT";
import type { CardCountCTSectionProps } from "../schema";
import { Loader2 } from "lucide-react";
import "@/modules/search/i18n";

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

  const { title, subtitle, cards, baseParams = {}, bg, scope = "auto" } = props;

  const sectionBg = bg && bg !== "default" ? (BG_MAP[bg] || "") : "";

  // Paramètres pour la recherche (on n'a besoin que du count, pas de résultats)
  const [searchType] = useState<Record<string, string[]> | null>(
    baseParams?.defaultTypes ? { type: baseParams.defaultTypes } : null
  );
  const localityId = entity?.serverData?.address?.localityId as string | undefined;
  const slug = entity?.serverData?.slug as string | undefined;

  /**
   * Le `$or` compté est une UNION : chaque clé qu'on y ajoute ÉLARGIT le
   * périmètre. Élargir sans le dire fait mentir le compteur — mesuré, le
   * chiffre d'institut-bleu passait de 49 à 530 organisations (tout ce qui est
   * situé au Port s'y ajoutait), celui de cyber-réunion de 693 à 2588.
   *
   * `scope` rend donc l'élargissement EXPLICITE. Défaut `auto` = comportement
   * historique, pour ne rien changer au seul consommateur du parc
   * (commune-transparente, un site territorial où « chez moi OU de ma source »
   * est bien l'intention voulue).
   */
  const mergedBaseParams = useMemo(() => {
    const params = {
      ...baseParams,
      indexStepList: 10, // On ne veut pas de résultats, juste le count
      defaultFilters: {
        ...(baseParams.defaultFilters || {}),
      } as Record<string, Record<string, string>>,
    };

    // `config` : les baseParams font foi, on n'ajoute rien. Le compteur
    // concorde alors exactement avec la liste que la page affiche à côté.
    if (scope === "config") return params;

    const widenLocality = scope === "auto" || scope === "locality";
    const widenCostum = scope === "auto" || scope === "costum";

    if (!params.defaultFilters["$or"]) {
      params.defaultFilters["$or"] = {};
    }
    const orFilters = params.defaultFilters["$or"] as Record<string, string>;

    if (widenLocality && localityId) {
      orFilters["address.localityId"] = localityId;
    }
    if (widenCostum && slug) {
      orFilters["source.key"] = slug;
      orFilters["source.keys"] = slug;
    }

    return params;
  }, [baseParams, localityId, slug, scope]);

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
