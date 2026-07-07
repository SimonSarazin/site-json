import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Clock, Database } from "lucide-react";
import { useNavigate } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { useVisibilityList } from "@/lib/visibility";

import { useAdminAccess } from "../hooks/useAdminAccess";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";
import type { AdminConfig, AdminResourceSection, AdminSection } from "../schema";

/**
 * Section `dashboard` — vue d'ensemble DÉRIVÉE de la config (aucun champ à déclarer) :
 *  - une tuile par section `resource` des onglets (`config.admin.tabs`) : compteur TOTAL
 *    (+ badge « à valider » quand la resource gère la validation) via searchCostum variant `admin`
 *    (count serveur, indexStep:1 — pas de chargement de données, filtres de la resource respectés) ;
 *  - une tuile Modération (si l'onglet existe) : taille de la file (news + commentaires signalés) —
 *    masquée si l'appel échoue (réservée super-admin) ;
 *  - chaque tuile est un raccourci vers son onglet (deep-link /admin/<tab>).
 */
interface CarrierLike {
  searchCostum: (data: Record<string, unknown>, opts?: unknown) => Promise<{ count?: { total?: number } }>;
}
interface ModerationLike {
  getModerationQueue: () => Promise<{ news: unknown[]; comments: unknown[] }>;
}

interface ResourceStat {
  tabId: string;
  entityType: string;
  label?: AdminResourceSection["label"];
  withStatus: boolean;
  total: number | null;
  pending: number | null;
}

export default function DashboardSection({ section }: { section: AdminSection }) {
  const t = useT();
  const navigate = useNavigate();
  const { entity: carrier, me } = useCocolight();
  const { config } = useSite();
  const access = useAdminAccess();
  const admin = (config as { admin?: AdminConfig }).admin;
  const costumSlug = (carrier as { slug?: string } | null)?.slug ?? "";
  const title = (section as { title?: Parameters<typeof t>[0] }).title;

  // MÊME filtre d'onglets qu'AdminRenderer (condition + access) : pas de tuile vers un onglet masqué.
  const allTabs = useMemo(() => admin?.tabs ?? [], [admin?.tabs]);
  const conditionResults = useVisibilityList(useMemo(() => allTabs.map((tb) => tb.condition), [allTabs]));
  const visibleTabs = allTabs.filter((tab, i) => conditionResults[i] && (!tab.access || access.has(tab.access)));

  // Dérivation : toutes les sections resource des onglets (avec l'id d'onglet pour le raccourci).
  const resources = visibleTabs.flatMap((tab) =>
    tab.sections
      .filter((s): s is AdminResourceSection => s.type === "resource")
      .map((s) => ({ tabId: tab.id, resource: s })),
  );
  const moderationTab = visibleTabs.find((tab) => tab.sections.some((s) => s.type === "moderation"));

  const stats = useQuery({
    queryKey: ADMIN_QUERY_KEYS.DASHBOARD_STATS(costumSlug, resources.map((r) => r.resource.entityType)),
    enabled: !!carrier && resources.length > 0,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<ResourceStat[]> => {
      const c = carrier as unknown as CarrierLike;
      return Promise.all(resources.map(async ({ tabId, resource }): Promise<ResourceStat> => {
        const withStatus = (resource.rowActions ?? []).includes("validate") || !!resource.status;
        const base = {
          searchType: [resource.entityType],
          count: true,
          countType: [resource.entityType],
          indexMin: 0,
          indexStep: 1,
          fields: ["name"],
          ...(resource.source?.defaultFilters ? { filters: resource.source.defaultFilters } : {}),
        };
        try {
          const totalPage = await c.searchCostum(base, { variant: "admin" });
          let pending: number | null = null;
          if (withStatus && costumSlug) {
            const pendingPage = await c.searchCostum({
              ...base,
              filters: { ...(resource.source?.defaultFilters ?? {}), [`preferences.toBeValidated.${costumSlug}`]: { $exists: true } },
            }, { variant: "admin" });
            pending = pendingPage.count?.total ?? 0;
          }
          return { tabId, entityType: resource.entityType, label: resource.label, withStatus, total: totalPage.count?.total ?? 0, pending };
        } catch {
          // Compteur indisponible (droits/serveur) → tuile en « — », pas d'erreur bloquante.
          return { tabId, entityType: resource.entityType, label: resource.label, withStatus, total: null, pending: null };
        }
      }));
    },
  });

  const moderation = useQuery({
    queryKey: ADMIN_QUERY_KEYS.DASHBOARD_MODERATION,
    enabled: !!me && !!moderationTab,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const q = await (me as unknown as ModerationLike).getModerationQueue();
      return (q.news?.length ?? 0) + (q.comments?.length ?? 0);
    },
  });

  return (
    <div className="space-y-3">
    {title && <h2 className="text-lg font-semibold">{t(title)}</h2>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stats.isLoading &&
        resources.map(({ tabId, resource }) => (
          <Card key={`${tabId}-${resource.entityType}`}>
            <CardHeader className="pb-2"><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-16" /></CardContent>
          </Card>
        ))}
      {(stats.data ?? []).map((s) => (
        <Card
          key={`${s.tabId}-${s.entityType}`}
          className="cursor-pointer transition-colors hover:bg-muted/40"
          onClick={() => navigate(`/admin/${s.tabId}`)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {s.label ? t(s.label) : <span className="capitalize">{s.entityType}</span>}
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">{s.total ?? "—"}</span>
              {s.withStatus && s.pending != null && s.pending > 0 && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  <Clock className="mr-1 h-3 w-3" />
                  {s.pending} à valider
                </Badge>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              Gérer <ArrowRight className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>
      ))}
      {moderationTab && moderation.data != null && (
        <Card
          className="cursor-pointer transition-colors hover:bg-muted/40"
          onClick={() => navigate(`/admin/${moderationTab.id}`)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Modération</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">{moderation.data}</span>
              <span className="text-xs text-muted-foreground">signalement{moderation.data > 1 ? "s" : ""} en attente</span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              Modérer <ArrowRight className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>
      )}
      {!stats.isLoading && resources.length === 0 && !moderationTab && (
        <Card className="sm:col-span-2 lg:col-span-3">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucune resource configurée — déclarez des sections <code>resource</code> dans <code>config.admin.tabs</code>.
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
