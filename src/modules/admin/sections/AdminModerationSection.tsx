import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCocolight } from "@/hooks/useCocolight";

import type { AdminSection } from "../schema";

/**
 * Section `moderation` (P5) — file de modération : news + commentaires signalés (reportAbuse), via
 * `me.getModerationQueue()` (MODERATE / ModerateAction). Lecture ; les actions (valider/supprimer) =
 * itération suivante. Accès superAdmin (gaté par l'onglet).
 */
interface Flagged {
  _id?: { $id?: string };
  text?: string;
  name?: string;
  reportAbuseCount?: number;
}

function FlaggedList({ items, empty }: { items: Flagged[]; empty: string }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {items.map((it, i) => (
        <li key={it._id?.$id ?? i} className="flex items-start justify-between gap-3 py-3">
          <span className="line-clamp-2 text-sm">{it.text || it.name || "(sans texte)"}</span>
          <Badge variant="destructive" className="shrink-0">
            {it.reportAbuseCount ?? 0} signalement{(it.reportAbuseCount ?? 0) > 1 ? "s" : ""}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export default function AdminModerationSection({ section: _section }: { section: AdminSection }) {
  const { me } = useCocolight();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-moderation"],
    queryFn: async () => (me ? me.getModerationQueue() : { result: false, news: [], comments: [] }),
    enabled: !!me,
  });
  const news = (data?.news ?? []) as Flagged[];
  const comments = (data?.comments ?? []) as Flagged[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Modération
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="news">
            <TabsList>
              <TabsTrigger value="news">Actualités ({news.length})</TabsTrigger>
              <TabsTrigger value="comments">Commentaires ({comments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="news" className="mt-3">
              <FlaggedList items={news} empty="Aucune actualité à modérer." />
            </TabsContent>
            <TabsContent value="comments" className="mt-3">
              <FlaggedList items={comments} empty="Aucun commentaire à modérer." />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
