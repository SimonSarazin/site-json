import React, { Suspense, useMemo, useState } from "react";
import { lazy } from "vite-preload";
import { ChevronDown, MessageCircleHeart } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import LazyImage from "@/components/layout/LazyImage";
import { useT } from "@/hooks/useT";
import useItem from "@/modules/search/hooks/useItem";
import { PreviewProps } from "@/modules/search/schema";
import { decorateTags } from "@/modules/search/lib/colorBy";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { cn } from "@/lib/utils";

// Lazy : le lecteur n'est chargé que si la parole a un média audio.
const AudioPlayer = lazy(() => import("@/components/ui/audio-player"));

/** Média d'une parole (convention `serverData.medias`, cf. dictionnaire parents62). */
type ParoleMedia = { type?: string; url?: string; mimeType?: string };

/** Catégories de navigation du module Paroles (valeurs du champ `category`). */
const CATEGORY_LABELS: Record<string, string> = {
  complique: "Compliqué",
  difficile: "Difficile",
  "a-changer": "Ce qui est à changer",
};

/**
 * Détail d'une PAROLE DE PARENTS (POI `type:"affiche"`, CDC parents62) :
 * badge catégorie (`category`), chips territoire/thèmes colorées
 * (`preview.tagColors`, même mécanique que les cartes), lecteur audio si la
 * parole a un média `{type:"audio"}`, et texte intégral — affiché directement
 * pour une parole écrite, replié derrière « Lire la transcription » quand il
 * double un audio. Branché `preview.type:"parole"`.
 */
const PreviewParole: React.FC<PreviewProps> = ({ item, preview }) => {
  const t = useT("modules/search");
  const data = useItem(item);
  const { name, profilImageUrl, image, description, tags = [] } = data;

  // Champs de la convention parole, hors mapping générique useItem.
  const sd = (item.serverData ?? {}) as Record<string, unknown>;
  const category = typeof sd.category === "string" ? sd.category : null;
  const audioUrl = useMemo(() => {
    const medias = Array.isArray(sd.medias) ? (sd.medias as ParoleMedia[]) : [];
    return medias.find((m) => m?.type === "audio" && typeof m.url === "string")?.url ?? null;
  }, [sd.medias]);

  const displayTags = useMemo(
    () => decorateTags(Array.from(new Set(tags)), preview?.tagColors),
    [tags, preview?.tagColors],
  );

  const [transcriptionOpen, setTranscriptionOpen] = useState(false);
  const paroleHtml = description
    ? renderMarkdown(description, { markdownEnabled: true })
    : null;

  return (
    <Card className="h-[calc(100vh-130px)] overflow-y-auto bg-background text-foreground rounded-md shadow-md">
      {(profilImageUrl || image) && (
        <CardHeader className="p-0">
          <AspectRatio ratio={16 / 9} className="w-full overflow-hidden rounded-t-md">
            <LazyImage
              src={profilImageUrl || image || "/images/defaultImage.png"}
              alt={name}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/images/defaultImage.png";
              }}
              className="object-cover w-full h-full"
            />
          </AspectRatio>
        </CardHeader>
      )}

      <CardContent className="px-4 py-4 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <MessageCircleHeart className="h-5 w-5 shrink-0" />
            <span className="text-xs font-medium uppercase tracking-wide">
              {t("Parole de parents")}
            </span>
          </div>
          <h2 className="text-2xl font-bold">{name}</h2>
          {category && (
            <Badge className="text-sm" title={t("Type de contenu")}>
              {t(CATEGORY_LABELS[category] ?? category)}
            </Badge>
          )}
        </div>

        {audioUrl && (
          <Suspense fallback={<Skeleton className="h-16 w-full rounded-md" />}>
            <AudioPlayer src={audioUrl} title={name} />
          </Suspense>
        )}

        {paroleHtml && (
          <>
            <Separator />
            {audioUrl ? (
              // Parole audio : le texte est la TRANSCRIPTION (accessibilité) → replié.
              <Collapsible open={transcriptionOpen} onOpenChange={setTranscriptionOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    {t("Lire la transcription")}
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", transcriptionOpen && "rotate-180")}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: paroleHtml }}
                  />
                </CollapsibleContent>
              </Collapsible>
            ) : (
              // Parole écrite : le texte EST le contenu → affiché directement.
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: paroleHtml }}
              />
            )}
          </>
        )}

        {displayTags.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {displayTags.map(({ tag, label, cssColor }) => (
                <Badge key={tag} variant="secondary" className="text-sm" title={tag}>
                  {cssColor && (
                    <span
                      aria-hidden
                      className="mr-1 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cssColor }}
                    />
                  )}
                  {label}
                </Badge>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PreviewParole;
