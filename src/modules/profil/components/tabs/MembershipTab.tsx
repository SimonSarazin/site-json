import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Search, Building2, Briefcase, MapPin, Calendar, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useUserOrganizations, useUserProjects, useUserPois, useUserEvents } from "../../hooks/useMembershipQuery";
import { useCocolight } from "@/hooks/useCocolight";
import type { CollectionKey, EntityTypes } from "@communecter/cocolight-api-client";
import { EntityCard } from "../shared/EntityCard";
import { getEntityIcon } from "@/lib/entityIcons";
import { EntityGrid } from "../shared/EntityGrid";
import { EntityEmptyState } from "../shared/EntityEmptyState";
import { cn } from "@/lib/utils";

/** Les quatre listes d'adhésion, dans l'ordre d'affichage. */
const LISTES = ["organizations", "projects", "pois", "events"] as const;

/** Classes littérales : Tailwind ne génère jamais une classe concaténée au runtime. */
const COLONNES: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };
export type ListeAdhesion = (typeof LISTES)[number];

export interface MembershipTabProps {
  /** Listes affichées, dans cet ordre. Défaut : les quatre (comportement historique). */
  types?: ListeAdhesion[];
  /**
   * `costum` borne les listes au périmètre du site porteur (côté SERVEUR : `source.keys` OU
   * `reference.costum`) ; `network` — le défaut — laisse le réseau entier, comme avant.
   *
   * Un site costum n'a aucune raison de montrer, dans « ses » onglets, des entités qui lui sont
   * étrangères : sur institutBleu, l'onglet listait les organisations de tout Communecter.
   */
  scope?: "costum" | "network";
}

export function MembershipTab({ types, scope }: MembershipTabProps = {}) {
  const { entity } = useProfileEntity();
  const { me, entity: porteur } = useCocolight();
  const listes = types?.length ? types : LISTES;
  // Le slug du PORTEUR du site est le périmètre : c'est lui que le serveur compare à `source.keys` /
  // `reference.costum` (cf. `buildSourceKey`). Sans porteur (site non costum), pas de périmètre.
  const slugPorteur = (porteur as { slug?: string } | null)?.slug;
  const perimetre = scope === "costum" && slugPorteur ? { sourceKey: [slugPorteur] } : {};
  const t = useT("modules/profil");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>(() => (types?.length ? types[0] : "organizations"));
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Queries avec infinite scroll
  const {
    organizations,
    totalCount: organizationsCount,
    isLoading: organizationsLoading,
    isFetchingNextPage: organizationsFetching,
    lastItemRef: organizationsLastRef,
    hasNextPage: organizationsHasNext
  } = useUserOrganizations(entity, {
    search: debouncedSearch,
    indexStep: 20,
    // Les quatre hooks sont appelés (règle des hooks), mais seule une liste DÉCLARÉE interroge le
    // réseau : sans ce garde, afficher les seules organisations coûtait trois requêtes paginées
    // inutiles au montage, et trois de plus à chaque frappe dans la recherche.
    enabled: listes.includes("organizations"),
    ...perimetre,
  });

  const {
    projects,
    totalCount: projectsCount,
    isLoading: projectsLoading,
    isFetchingNextPage: projectsFetching,
    lastItemRef: projectsLastRef,
    hasNextPage: projectsHasNext
  } = useUserProjects(entity, {
    search: debouncedSearch,
    indexStep: 20,
    // Les quatre hooks sont appelés (règle des hooks), mais seule une liste DÉCLARÉE interroge le
    // réseau : sans ce garde, afficher les seules organisations coûtait trois requêtes paginées
    // inutiles au montage, et trois de plus à chaque frappe dans la recherche.
    enabled: listes.includes("projects"),
    ...perimetre,
  });

  const {
    pois,
    totalCount: poisCount,
    isLoading: poisLoading,
    isFetchingNextPage: poisFetching,
    lastItemRef: poisLastRef,
    hasNextPage: poisHasNext
  } = useUserPois(entity, {
    search: debouncedSearch,
    indexStep: 20,
    // Les quatre hooks sont appelés (règle des hooks), mais seule une liste DÉCLARÉE interroge le
    // réseau : sans ce garde, afficher les seules organisations coûtait trois requêtes paginées
    // inutiles au montage, et trois de plus à chaque frappe dans la recherche.
    enabled: listes.includes("pois"),
    ...perimetre,
  });

  const {
    events,
    totalCount: eventsCount,
    isLoading: eventsLoading,
    isFetchingNextPage: eventsFetching,
    lastItemRef: eventsLastRef,
    hasNextPage: eventsHasNext
  } = useUserEvents(entity, {
    search: debouncedSearch,
    indexStep: 20,
    // Les quatre hooks sont appelés (règle des hooks), mais seule une liste DÉCLARÉE interroge le
    // réseau : sans ce garde, afficher les seules organisations coûtait trois requêtes paginées
    // inutiles au montage, et trois de plus à chaque frappe dans la recherche.
    enabled: listes.includes("events"),
    ...perimetre,
  });

  const isOwnProfile = me?.slug === entity?.slug;

  if (!isOwnProfile) {
    return (
      <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-16">
          <div className="text-muted-foreground mb-4">
            <Building2 className="w-16 h-16 mx-auto" />
          </div>
          <p className="text-xl font-semibold text-foreground mb-2">{t("MembershipTab.privateProfile")}</p>
          <p className="text-muted-foreground">{t("MembershipTab.cannotViewMemberships")}</p>
        </div>
      </div>
    );
  }

  const getEmptyStateAction = (type: CollectionKey) => {
    const actionLabels: Partial<Record<CollectionKey, string>> = {
      organizations: t("MembershipTab.joinOrganization"),
      projects: t("MembershipTab.joinProject"),
      poi: t("MembershipTab.addPoi"),
      events: t("MembershipTab.createEvent"),
    };

    return {
      label: actionLabels[type] || type,
      onClick: () => {
        // TODO: Implémenter l'action
        console.log(`Action for ${type}`);
      },
      icon: <Plus className="w-4 h-4 mr-2" />,
    };
  };

  const renderEmptyState = (type: CollectionKey, emptyMessage: string) => (
    <EntityEmptyState
      icon={getEntityIcon(type)}
      title={emptyMessage}
      description={searchTerm ? t("MembershipTab.tryDifferentSearch") : t("MembershipTab.startJoining")}
      action={getEmptyStateAction(type)}
    />
  );

  const renderTabContent = (
    items: EntityTypes[],
    loading: boolean,
    isFetchingNext: boolean,
    hasNext: boolean,
    lastItemRef: (node: HTMLElement | null) => void,
    type: CollectionKey,
    emptyMessage: string
  ) => (
    <EntityGrid
      items={items}
      isLoading={loading}
      isFetchingNext={isFetchingNext}
      hasNextPage={hasNext}
      lastItemRef={lastItemRef}
      columns={{ sm: 1, md: 1, lg: 1, xl: 1 }}
      renderItem={(item, _index, isLast, ref) => (
        <EntityCard
          key={item.id || item.slug}
          entity={item}
          showRole={true}
          lastItemRef={isLast && hasNext ? ref : undefined}
        />
      )}
      emptyState={renderEmptyState(type, emptyMessage)}
    />
  );

  /** Une entrée par liste — l'onglet ET son contenu sont rendus depuis cette table, non plus en dur :
   *  c'est ce qui permet à `types` de n'en déclarer qu'une (institutBleu : les organisations seules). */
  const blocs: Record<ListeAdhesion, { Icone: typeof Building2; label: string; count: number; contenu: () => React.ReactNode }> = {
    organizations: {
      Icone: Building2, label: t("MembershipTab.tabs.organizations"), count: organizationsCount,
      contenu: () => renderTabContent(organizations, organizationsLoading, organizationsFetching, !!organizationsHasNext, organizationsLastRef, "organizations", t("MembershipTab.noOrganizations")),
    },
    projects: {
      Icone: Briefcase, label: t("MembershipTab.tabs.projects"), count: projectsCount,
      contenu: () => renderTabContent(projects, projectsLoading, projectsFetching, !!projectsHasNext, projectsLastRef, "projects", t("MembershipTab.noProjects")),
    },
    pois: {
      Icone: MapPin, label: t("MembershipTab.tabs.pois"), count: poisCount,
      contenu: () => renderTabContent(pois, poisLoading, poisFetching, !!poisHasNext, poisLastRef, "poi", t("MembershipTab.noPois")),
    },
    events: {
      Icone: Calendar, label: t("MembershipTab.tabs.events"), count: eventsCount,
      contenu: () => renderTabContent(events, eventsLoading, eventsFetching, !!eventsHasNext, eventsLastRef, "events", t("MembershipTab.noEvents")),
    },
  };

  return (
    <div className="space-y-6">
      {/* Header avec recherche */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t("MembershipTab.searchMemberships")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Classes littérales : Tailwind ne génère pas une classe concaténée (`grid-cols-${n}`). */}
        <TabsList className={cn("grid w-full", COLONNES[listes.length] ?? "grid-cols-4")}>
          {listes.map((cle) => {
            const bloc = blocs[cle];
            return (
              <TabsTrigger key={cle} value={cle} className="flex items-center gap-2">
                <bloc.Icone className="w-4 h-4" />
                <span className="hidden sm:inline">{bloc.label}</span>
                {bloc.count > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
                    {bloc.count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {listes.map((cle) => (
          <TabsContent key={cle} value={cle}>{blocs[cle].contenu()}</TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default MembershipTab;
