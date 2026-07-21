import { Calendar, Mic } from "lucide-react";
import type { Poi } from "@communecter/cocolight-api-client";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { formatDateLong, toValidDate } from "@/helpers/formatDate";
import { toStringArray } from "@/helpers/toStringArray";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { PAROLE_CATEGORY_STYLE, paroleAudioUrl } from "../../lib/parole";
import { PreviewProps } from "../../schema";

/**
 * Preview « parole » (contenu de la modale `detailsMode:"dialog"`). Le conteneur (DialogContent) pose la
 * croix de fermeture en haut-droite → l'en-tête réserve `pr-12`. Rendu : catégorie + titre, LECTEUR AUDIO
 * plein (medias[audio]), transcription markdown (`renderMarkdown` — sanitize DOMPurify inclus),
 * taxonomies complètes, date. Réutilise `AudioPlayer` + les helpers partagés (cf. cartographie-fonctions).
 */
function TaxoRow({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {values.map((v, i) => (
        <Badge key={`${v}-${i}`} variant="secondary" className="font-normal">
          {v}
        </Badge>
      ))}
    </div>
  );
}

export default function PreviewParole({ item }: PreviewProps) {
  const sd = (item as Poi).serverData;
  const name = sd.name ?? "";
  const category = (sd.category as string | undefined) ?? "";
  const audioUrl = paroleAudioUrl(sd.medias);
  const created = toValidDate(sd.created);
  const descHtml =
    typeof sd.description === "string" && sd.description.trim()
      ? renderMarkdown(sd.description, { markdownEnabled: true })
      : "";

  return (
    <div className="flex max-h-[85vh] flex-col">
      <div className="shrink-0 space-y-2 border-b border-border py-4 pl-5 pr-12">
        {category && (
          <Badge variant="outline" className={PAROLE_CATEGORY_STYLE[category] ?? ""}>
            {category}
          </Badge>
        )}
        <h2 className="text-lg font-semibold leading-tight text-foreground">{name}</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {audioUrl && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> Écouter la parole
            </p>
            <AudioPlayer src={audioUrl} />
          </div>
        )}

        {descHtml && (
          <div
            className="prose prose-sm prose-gray max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: descHtml }}
            suppressHydrationWarning
          />
        )}

        <div className="space-y-2">
          <TaxoRow label="Territoires" values={toStringArray(sd.territoires)} />
          <TaxoRow label="Publics" values={toStringArray(sd.publics)} />
          <TaxoRow label="Âges" values={toStringArray(sd.ages)} />
          <TaxoRow label="Thèmes" values={toStringArray(sd.themes)} />
          <TaxoRow label="Mots-clés" values={toStringArray(sd.tags)} />
        </div>

        {created && (
          <div className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateLong(created)}
          </div>
        )}
      </div>
    </div>
  );
}
