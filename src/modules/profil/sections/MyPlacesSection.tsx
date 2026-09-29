import "@/modules/profil/i18n";
import "@/modules/news/i18n";
import "@/modules/search/i18n";
import { useMemo, useState } from "react";
import { Heart, Building2, Newspaper, Calendar, Briefcase, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { getEntityIcon } from "@/lib/entityIcons";
import { EntityCard } from "../components/shared/EntityCard";
import { EntityGrid } from "../components/shared/EntityGrid";
import { EntityEmptyState } from "../components/shared/EntityEmptyState";
import { useUserOrganizations } from "../hooks/useMembershipQuery";
import { useLinkedEntitiesQuery, buildLinkedEntitiesFilter } from "../hooks/useLinkedEntitiesQuery";
import { useMemberNewsQuery } from "../hooks/useMemberNewsQuery";
import { resolveLinkedLabels } from "../lib/resolveLinkedLabels";
import { buildNewsDetailUrl } from "../hooks/useNewsDetailUrlGenerator";
import { NewsItem } from "@/modules/news/components/NewsItem";
import { NewsProvider } from "@/modules/news/contexts/NewsProvider";
import SearchListView from "@/modules/search/components/SearchListView";
import type { ListConf } from "@/modules/search/schema";
import type { MyPlacesSectionProps } from "../schema";
import type { EntityTypes, SearchEntity } from "@communecter/cocolight-api-client";

/** Aucune action de gestion depuis ce digest multi-lieux — partager/signaler restent sûrs sans droit
 *  vérifié par organisation ; ajouter/éditer/modérer resteraient à faire DEPUIS la fiche du lieu. */
const PERMISSIONS_LECTURE_SEULE = {
  canAdd: false, canEdit: false, canDelete: false, canModerate: false,
  canComment: false, canReact: false, canShare: true, canReport: true,
};

/** Même carte/aperçu que le composant Agenda du site (`Agenda.tsx` : `card:{type:"event"}`,
 *  `preview:{type:"event"}`) — demandé explicitement : « comme sur le composant agenda ». */
const CARD_EVENT: ListConf["card"] = { type: "event", detailsMode: "drawer" };
const PREVIEW_EVENT: ListConf["preview"] = { type: "event" };
/** Aucune carte/aperçu DÉDIÉE aux projets dans le moteur (vérifié : `SearchCard`/`Preview` n'ont pas
 *  de variant "project") — la carte par défaut est le repli légitime, pas un design inventé. */
const CARD_DEFAULT: ListConf["card"] = { type: "default" };
const PREVIEW_DEFAULT: ListConf["preview"] = { type: "default" };
/** 3 cartes par ligne à partir de `lg` (même valeurs que `CoformResourceDirectorySection.tsx`,
 *  déjà scannées par Tailwind) — par défaut `SearchListView` sans `columns` rend 1 seule colonne
 *  pleine largeur, beaucoup trop large pour une carte agenda/projet dans ce digest. */
const COLUMNS_3: ListConf["columns"] = { sm: 1, md: 2, lg: 3 };

type Onglet = "lieux" | "news" | "agenda" | "projets";

/**
 * « Mes lieux » — portage de `costum.views.custom.franceTierslieux.listOrga` (legacy), 4 onglets
 * actifs sur les 5 du legacy :
 *
 *  1. Mes tiers-lieux (défaut) — organisations dont le compte est MEMBRE, cf. `schema.ts`.
 *  2. News — `org.getNews()` fusionné PAR lieu (cf. `useMemberNewsQuery` — PAS un filtre `source.key`
 *     sur `news`, hypothèse initiale invalidée en lisant le vrai contrôleur legacy). Rendu IDENTIQUE
 *     à l'onglet « Actualités » d'une fiche (`NewsSection.tsx` / `/profil/<slug>/news`) : même
 *     `NewsItem`, un `NewsProvider` PAR item (scopé à SON organisation, portée par `ActuDeLieu` dès
 *     le fetch — pas reconstruite après coup, cf. le commentaire du hook).
 *  3. Agenda / 4. Projets — événements/projets liés aux lieux membres, rendus via `SearchListView`
 *     (même moteur carte+aperçu que le composant Agenda du site : clic → panneau de détail à droite,
 *     pas une navigation ni un simple drawer générique). Chaque carte porte le lieu membre par
 *     lequel l'item est remonté (`links.organizer` pour l'événement, `links.contributors` pour le
 *     projet — cf. `resolveLinkedLabels`) : la liste mélange les items de PLUSIEURS lieux, sans
 *     repère on ne saurait pas lequel a produit quoi. Câblé via `list.linkedLabels` (`ListConfSchema`,
 *     prop générique et rétrocompatible — sans effet sur les autres consommateurs des cartes).
 *
 * ⚠ Onglet 5 (Lieux similaires) RETIRÉ de l'UI le 29/09 (décision produit — pas prêt) mais son code
 * reste EN PLACE, volontairement : `useSimilarPlacesQuery.ts` (+ son test), le mapping
 * `similarPlacesFieldsMap.ts`, et les 2 endpoints SDK (`answerdirectory`/`getaggregatetr`, sur
 * `cocolight-api-client`, mis de côté par `git stash` — cf. `doc-projets/tiers-lieux.md`). Aucun
 * appel dans ce composant tant que l'onglet n'est pas remis ; ne pas supprimer ce code, il repart
 * tel quel le jour où l'onglet revient.
 *
 * Les onglets 2 à 4 ne se chargent qu'une fois VISITÉS (`enabled`), sur la liste d'ids/slugs de
 * l'onglet 1 — pas de rafale de requêtes au premier rendu pour des onglets jamais ouverts.
 */
export function MyPlacesSection({ id, props }: { id?: string; props: MyPlacesSectionProps }) {
  const t = useT("modules/profil");
  const { me } = useCocolight();
  const [onglet, setOnglet] = useState<Onglet>("lieux");

  const { config: siteConfig } = useSite();
  const mesLieux = useUserOrganizations(me, { enabled: !!me, sourceKey: props.sourceKey });
  const orgIds = useMemo(() => mesLieux.organizations.map((o) => o.id).filter((v): v is string => !!v), [mesLieux.organizations]);
  // id de lieu membre -> nom, pour poser « via <lieu> » sur les cartes Agenda/Projets (résolution
  // purement locale : `mesLieux` est déjà en mémoire, aucun appel réseau supplémentaire).
  const orgsById = useMemo(
    () => new Map(mesLieux.organizations.filter((o) => o.id).map((o) => [o.id as string, o.serverData?.name ?? ""])),
    [mesLieux.organizations],
  );

  const news = useMemberNewsQuery(mesLieux.organizations, { enabled: onglet === "news" });
  const agenda = useLinkedEntitiesQuery({
    filters: useMemo(() => buildLinkedEntitiesFilter(orgIds, ["links.attendees", "links.organizer"]), [orgIds]),
    searchType: "events",
    cacheKey: orgIds,
    enabled: onglet === "agenda",
  });
  // Le lieu ORGANISATEUR affiché sur la carte (pas « attendees », qui a servi à FILTRER la liste
  // mais désigne des participants, pas un organisateur) — champ distinct du filtre ci-dessus.
  const agendaLinkedLabels = useMemo(
    () => resolveLinkedLabels(agenda.items as unknown as SearchEntity[], ["organizer"], orgsById),
    [agenda.items, orgsById],
  );
  const projets = useLinkedEntitiesQuery({
    filters: useMemo(() => buildLinkedEntitiesFilter(orgIds, ["links.contributors"]), [orgIds]),
    searchType: "projects",
    cacheKey: orgIds,
    enabled: onglet === "projets",
  });
  const projetsLinkedLabels = useMemo(
    () => resolveLinkedLabels(projets.items as unknown as SearchEntity[], ["contributors"], orgsById),
    [projets.items, orgsById],
  );

  /** Agenda/Projets : liste + panneau de détail au clic (`SearchListView`), même moteur que le site.
   *  ⚠ Pagination NON câblée ici (`SearchListView` est un pur rendu, sans `hasNextPage`/`lastItemRef`
   *  — la pagination reste possible côté hook mais n'est pas exposée par ce composant) : seule la
   *  première page (`indexStep: 20`, cf. `useLinkedEntitiesQuery`) s'affiche. Suffisant pour un digest
   *  personnel ; à revoir si un lieu très actif dépasse ce plafond en pratique. */
  const listeAvecApercu = (
    liste: { items: EntityTypes[]; isLoading: boolean },
    aucunLieu: boolean,
    videTitre: string,
    card: ListConf["card"],
    preview: ListConf["preview"],
    previewParam: string,
    linkedLabels: Record<string, string>,
  ) =>
    aucunLieu ? (
      <EntityEmptyState icon={<Building2 className="w-12 h-12 mx-auto" />} title={t("MyPlacesSection.needPlaceFirst")} />
    ) : liste.isLoading ? (
      <div className="text-center py-12 sm:py-16 animate-pulse text-muted-foreground">{t("common.loading")}</div>
    ) : liste.items.length === 0 ? (
      <EntityEmptyState icon={<Sparkles className="w-12 h-12 mx-auto" />} title={videTitre} />
    ) : (
      <SearchListView
        results={liste.items as unknown as SearchEntity[]}
        columns={COLUMNS_3}
        card={card}
        preview={preview}
        previewParam={previewParam}
        list={{ linkedLabels }}
      />
    );

  if (!me) {
    return (
      <section id={id} className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
            {props.title ? t(props.title) : t("MyPlacesSection.title")}
          </h1>
          <EntityEmptyState icon={getEntityIcon("organizations")} title={t("MyPlacesSection.loginRequired")} />
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
          {props.title ? t(props.title) : t("MyPlacesSection.title")}
        </h1>

        <Tabs value={onglet} onValueChange={(v) => setOnglet(v as Onglet)}>
          <TabsList>
            <TabsTrigger value="lieux"><Building2 className="w-4 h-4 mr-1.5" />{t("MyPlacesSection.tabs.places")}</TabsTrigger>
            <TabsTrigger value="news"><Newspaper className="w-4 h-4 mr-1.5" />{t("MyPlacesSection.tabs.news")}</TabsTrigger>
            <TabsTrigger value="agenda"><Calendar className="w-4 h-4 mr-1.5" />{t("MyPlacesSection.tabs.agenda")}</TabsTrigger>
            <TabsTrigger value="projets"><Briefcase className="w-4 h-4 mr-1.5" />{t("MyPlacesSection.tabs.projects")}</TabsTrigger>
          </TabsList>

          <TabsContent value="lieux" className="mt-6">
            <EntityGrid
              items={mesLieux.organizations}
              isLoading={mesLieux.isLoading}
              isFetchingNext={mesLieux.isFetchingNextPage}
              hasNextPage={!!mesLieux.hasNextPage}
              lastItemRef={mesLieux.lastItemRef}
              renderItem={(item, _index, isLast, ref) => (
                <EntityCard key={item.id || item.slug} entity={item} lastItemRef={isLast && mesLieux.hasNextPage ? ref : undefined} />
              )}
              emptyState={
                <EntityEmptyState
                  icon={<Heart className="w-12 h-12 mx-auto" />}
                  title={props.emptyStateText ? t(props.emptyStateText) : t("MyPlacesSection.empty")}
                  description={t("MyPlacesSection.emptyHint")}
                />
              }
            />
          </TabsContent>

          <TabsContent value="news" className="mt-6 space-y-4 sm:space-y-6">
            {/* Rendu IDENTIQUE à l'onglet « Actualités » d'une fiche (`NewsSection.tsx` /
                `/profil/<slug>/news`) : même `NewsItem`, pas une carte générique. Un `NewsProvider`
                PAR item, scopé à SON organisation (`actu.lieu`, connue dès le fetch) — un seul
                provider global aurait attribué les mauvaises permissions aux actus des autres lieux. */}
            {orgIds.length === 0 ? (
              <EntityEmptyState icon={<Building2 className="w-12 h-12 mx-auto" />} title={t("MyPlacesSection.needPlaceFirst")} />
            ) : news.isLoading ? (
              <div className="text-center py-12 sm:py-16 animate-pulse text-muted-foreground">{t("common.loading")}</div>
            ) : !news.data || news.data.length === 0 ? (
              <EntityEmptyState icon={<Sparkles className="w-12 h-12 mx-auto" />} title={t("MyPlacesSection.emptyNews")} />
            ) : (
              news.data.map(({ news: actu, lieu }) => (
                <NewsProvider
                  key={actu.id}
                  value={{
                    entity: lieu,
                    entityId: lieu.id ?? undefined,
                    entityType: lieu.getEntityType?.() ?? undefined,
                    permissions: PERMISSIONS_LECTURE_SEULE,
                    detailUrlGenerator: (newsId: string) => buildNewsDetailUrl(siteConfig, lieu, newsId),
                  }}
                >
                  <NewsItem item={actu} entity={lieu} />
                </NewsProvider>
              ))
            )}
          </TabsContent>

          <TabsContent value="agenda" className="mt-6">
            {listeAvecApercu(agenda, orgIds.length === 0, t("MyPlacesSection.emptyAgenda"), CARD_EVENT, PREVIEW_EVENT, "mes-lieux-agenda", agendaLinkedLabels)}
          </TabsContent>

          <TabsContent value="projets" className="mt-6">
            {listeAvecApercu(projets, orgIds.length === 0, t("MyPlacesSection.emptyProjects"), CARD_DEFAULT, PREVIEW_DEFAULT, "mes-lieux-projets", projetsLinkedLabels)}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

export default MyPlacesSection;
