import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ExternalLink, Newspaper } from "lucide-react";
import { lazy } from "vite-preload";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/modules/profil/components/shared/EmptyState";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { buildNewsDetailUrl } from "@/modules/profil/hooks/useNewsDetailUrlGenerator";
import { resolveHostEntity, targetRef } from "@/modules/news/lib/resolveHostEntity";
import { NEWS_QUERY_KEYS } from "@/modules/news/constants/queryKeys";
import type { ListConf } from "../../schema";
import type { News } from "@communecter/cocolight-api-client";

const NewsDetailPage = lazy(() => import("@/modules/news/components/NewsDetailPage"));

interface PreviewNewsProps {
  item: News;
  preview?: ListConf["preview"];
  onClose?: () => void;
}

/**
 * Détail d'une news dans le module search (drawer/dialog), PLEINEMENT FONCTIONNEL.
 *
 * Le corps réutilise le MÊME `NewsItem` que le mur profil (via `NewsDetailPage` en mode
 * `embedded` — sans cadre externe ni bouton retour) : il porte DÉJÀ toute l'identité
 * (auteur / avatar / date / portée / menu) + commentaires / votes / actions selon permissions.
 * La coque n'ajoute donc qu'un BANDEAU MINCE : étiquette « Actualité » + CTA permalien
 * « Voir en page » (la seule chose que `NewsItem` ne fournit pas) — surtout PAS un second
 * en-tête identité, qui ferait doublon avec le `NewsItem`.
 *
 * On résout l'entité PORTEUSE (`target.{type,id}`) via `resolveHostEntity` ; le permalien
 * pointe vers `/profil/:slug/:tab/:newsId` (`buildNewsDetailUrl`), fallback `/profil/:slug`.
 *
 * Aucune dépendance backend : la news enrichie porte déjà `target.{type,id}` (byte-parité
 * intacte) et le fetch détail passe par GET_NEWS_BY_ID (déjà implémenté).
 */
export default function PreviewNews({ item, preview, onClose }: PreviewNewsProps) {
  const t = useT("modules/search");
  // Lien « Voir en page » affiché par défaut ; masquable via config `preview.showDetailLink: false`
  // (les `.default()` Zod ne sont pas appliqués au runtime → on teste `!== false`).
  const showDetailLink = preview?.showDetailLink !== false;
  const { api } = useCocolight();
  const { config } = useSite();
  const userContextId = useHydratedUserContextId();

  const nd = (item.serverData ?? {}) as Record<string, unknown>;
  const newsId = String(item.id ?? nd._id ?? "");
  // `target` est normalisé en INSTANCE d'entité par la lib (News._linkNestedEntity) → type/id
  // vivent sur `.serverData`. `targetRef` gère instance ET objet brut.
  const { type: targetType, id: targetId } = targetRef(nd.target);
  const targetName = String((nd.target as { name?: unknown } | undefined)?.name ?? "");

  const { data: host, isLoading, isError } = useQuery({
    queryKey: NEWS_QUERY_KEYS.NEWS_HOST(targetType ?? null, targetId ?? null, userContextId),
    queryFn: () => resolveHostEntity(api, targetType, targetId),
    enabled: !!api && !!targetType && !!targetId,
    staleTime: 5 * 60 * 1000,
  });

  const permalink = host
    ? (buildNewsDetailUrl(config, host, newsId) ?? (host.slug ? `/profil/${host.slug}` : null))
    : null;

  return (
    <div className="flex max-h-[85vh] flex-col">
      {/* Bandeau mince : étiquette + CTA permalien (l'identité est portée par le NewsItem embarqué).
          `pr-12` réserve le coin haut-droit pour la croix de fermeture du conteneur (DialogContent
          la pose en `absolute top-4 right-4`) → le CTA « Voir en page » ne passe pas dessous. */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border py-3 pl-4 pr-12">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Newspaper className="h-4 w-4" />
          {t("Actualité")}
        </div>
        {showDetailLink && permalink && (
          <Link
            to={permalink}
            onClick={() => onClose?.()}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t("Voir en page")}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Corps scrollable : le détail news fonctionnel (résolu via l'entité porteuse) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {!isLoading && host && newsId && (
          <NewsDetailPage
            embedded
            params={{ newsId }}
            entity={host}
            showBackButton={false}
            sectionProps={{ showAddButton: false, showFilters: false, showComments: true, showReactions: true, maxItems: 1 }}
          />
        )}

        {/* Fallback : entité porteuse non résoluble (ex. object cms, target sans profil news-capable) */}
        {!isLoading && (isError || !host) && (
          <EmptyState
            icon={Newspaper}
            variant="card"
            title={String(nd.name ?? targetName) || t("Actualité")}
            description={t("Aperçu détaillé indisponible pour cette actualité.")}
          />
        )}
      </div>
    </div>
  );
}
