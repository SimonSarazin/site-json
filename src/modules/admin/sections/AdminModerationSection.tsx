import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Flag, Loader2, ShieldX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";
import type { AdminSection } from "../schema";

/**
 * Section `moderation` — file de modération ACTIONNABLE (chantier #34, port de la vue moderateAll
 * legacy) : news + commentaires signalés via `me.getModerationQueue()` (MODERATE), et par item :
 *  - « Laisser publié » / « C'est un abus » → `me.saveModeration(ctx, id, isAnAbuse)` — vote de
 *    modération ; les NEWS tranchent `isAnAbuse` au seuil de 3 votes (majorité >49%, backend) ;
 *  - drapeau → modale de détail `me.consolidateModeration(ctx, id)` (raisons consolidées + détail
 *    par signaleur). ⚠ réponse legacy `{result: tmp}` SANS booléen.
 * Les erreurs API sont AFFICHÉES (Alert destructive) — plus de « 0 » silencieux : contre le legacy
 * 5080, cette file n'existe pas en JSON (la page moderateAll est du HTML → l'appel échoue).
 * Accès superAdmin (gaté par l'onglet). Requiert le SDK ≥ 1.0.162 (consolidateModeration/saveModeration).
 */
interface Flagged {
  /** Posé par la normalisation lib (_transformData/_reviveClean) — `_id` brut est un ObjectId revivé. */
  id?: string;
  _id?: { $id?: string };
  text?: string;
  name?: string;
  reportAbuseCount?: number;
}

interface ModerationUser {
  getModerationQueue: () => Promise<{ result: boolean; news: unknown[]; comments: unknown[] }>;
  consolidateModeration: (ctx: "news" | "comments", id: string) => Promise<{ result: { text: string | null; reason: Record<string, number> | unknown[]; detail?: Record<string, string> } }>;
  saveModeration: (ctx: "news" | "comments", id: string, isAnAbuse: boolean) => Promise<{ result: boolean; msg: string }>;
}

function FlaggedList({
  items,
  empty,
  onVote,
  onDetail,
  votePending,
}: {
  items: Flagged[];
  empty: string;
  onVote: (id: string, isAnAbuse: boolean) => void;
  onDetail: (id: string) => void;
  votePending: boolean;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {items.map((it, i) => {
        const id = it.id ?? it._id?.$id ?? "";
        return (
          <li key={id || i} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm">{it.text || it.name || "(sans texte)"}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="destructive">
                {it.reportAbuseCount ?? 0} signalement{(it.reportAbuseCount ?? 0) > 1 ? "s" : ""}
              </Badge>
              <Button size="sm" variant="ghost" title="Détail des signalements" onClick={() => onDetail(id)} disabled={!id}>
                <Flag className="h-4 w-4 text-amber-600" />
              </Button>
              <Button size="sm" variant="outline" disabled={!id || votePending} onClick={() => onVote(id, false)}>
                <Check className="mr-1.5 h-3.5 w-3.5" /> Laisser publié
              </Button>
              <Button size="sm" variant="destructive" disabled={!id || votePending} onClick={() => onVote(id, true)}>
                <ShieldX className="mr-1.5 h-3.5 w-3.5" /> C&apos;est un abus
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminModerationSection({ section }: { section: AdminSection }) {
  const modSection = section as { title?: Parameters<ReturnType<typeof useT>>[0] };
  const t = useT();
  const { me } = useCocolight();
  const mod = me as unknown as ModerationUser | null;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"news" | "comments">("news");
  const [detail, setDetail] = useState<{ id: string; ctx: "news" | "comments" } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ADMIN_QUERY_KEYS.MODERATION,
    queryFn: async () => {
      if (!mod) throw new Error("Non connecté");
      return mod.getModerationQueue();
    },
    enabled: !!mod,
    retry: false,
  });
  const news = (data?.news ?? []) as Flagged[];
  const comments = (data?.comments ?? []) as Flagged[];

  const vote = useMutation({
    mutationFn: ({ ctx, id, isAnAbuse }: { ctx: "news" | "comments"; id: string; isAnAbuse: boolean }) =>
      mod!.saveModeration(ctx, id, isAnAbuse),
    onSuccess: (res, vars) => {
      if (res.result) {
        toast.success(vars.isAnAbuse ? "Signalé comme abus" : "Laissé publié");
        void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.MODERATION });
        void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.DASHBOARD_MODERATION });
      } else {
        toast.error(res.msg || "Échec de la modération");
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Échec de la modération"),
  });

  const detailQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.MODERATION_DETAIL(detail?.ctx, detail?.id),
    queryFn: async () => mod!.consolidateModeration(detail!.ctx, detail!.id),
    enabled: !!mod && !!detail,
    retry: false,
  });
  const detailData = detailQuery.data?.result;
  const reasons = detailData && !Array.isArray(detailData.reason) ? Object.entries(detailData.reason as Record<string, number>) : [];
  const reporters = detailData?.detail ? Object.values(detailData.detail) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          {modSection.title ? t(modSection.title) : "Modération"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          // Erreur VISIBLE (plus de « 0 » silencieux) — cas typique : backend sans file JSON (legacy).
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>File de modération indisponible</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Le serveur n'a pas renvoyé la file de modération."}
            </AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="news">Actualités ({news.length})</TabsTrigger>
              <TabsTrigger value="comments">Commentaires ({comments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="news" className="mt-3">
              <FlaggedList
                items={news}
                empty="Aucune actualité à modérer."
                votePending={vote.isPending}
                onVote={(id, isAnAbuse) => vote.mutate({ ctx: "news", id, isAnAbuse })}
                onDetail={(id) => setDetail({ id, ctx: "news" })}
              />
            </TabsContent>
            <TabsContent value="comments" className="mt-3">
              <FlaggedList
                items={comments}
                empty="Aucun commentaire à modérer."
                votePending={vote.isPending}
                onVote={(id, isAnAbuse) => vote.mutate({ ctx: "comments", id, isAnAbuse })}
                onDetail={(id) => setDetail({ id, ctx: "comments" })}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      {/* Modale de détail des signalements (consolidateModerate{News,Comment}) */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail des signalements</DialogTitle>
            <DialogDescription className="line-clamp-3">
              {detailQuery.isLoading ? "Chargement…" : detailData?.text || "(sans texte)"}
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : detailQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger le détail des signalements.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-1 font-medium">Motifs</p>
                {reasons.length === 0 ? (
                  <p className="text-muted-foreground">Aucun motif renseigné.</p>
                ) : (
                  <ul className="list-inside list-disc">
                    {reasons.map(([reason, count]) => (
                      <li key={reason}>{reason} : {count}</li>
                    ))}
                  </ul>
                )}
              </div>
              {reporters.length > 0 && (
                <div>
                  <p className="mb-1 font-medium">Signalé par</p>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {reporters.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={!detail || vote.isPending}
              onClick={() => { if (detail) { vote.mutate({ ctx: detail.ctx, id: detail.id, isAnAbuse: false }); setDetail(null); } }}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Laisser publié
            </Button>
            <Button
              variant="destructive"
              disabled={!detail || vote.isPending}
              onClick={() => { if (detail) { vote.mutate({ ctx: detail.ctx, id: detail.id, isAnAbuse: true }); setDetail(null); } }}
            >
              <ShieldX className="mr-1.5 h-3.5 w-3.5" /> C&apos;est un abus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
