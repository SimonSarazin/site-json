import { SearchCardProps } from "../../schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, Image } from "lucide-react";

export default function CardContact({ item, onClick }: SearchCardProps) {
  const serverData = item?.serverData;

  const image = serverData?.profilImageUrl;
  const title = serverData?.name ?? "—";
  const sd = serverData as Record<string, unknown> | undefined;
  const email = sd?.email as string | undefined;
  const phone = (sd?.telephone ?? sd?.phone) as string | undefined;

  const addr = serverData?.address as Record<string, unknown> | undefined;
  const addressStr = [addr?.streetAddress, addr?.postalCode, addr?.addressLocality]
    .filter(Boolean)
    .join(" ");

  const rawTags: unknown[] = (serverData?.tags as unknown[]) ?? [];
  const tags = rawTags.map((t) => (typeof t === "string" ? t : String(t)));
  const visibleTags = tags.slice(0, 3);
  const hiddenCount = tags.length - visibleTags.length;

  // "Validé" si l'entité n'est pas en attente de validation
  const toBeValidated = (sd?.preferences as Record<string, unknown> | undefined)?.toBeValidated as Record<string, unknown> | undefined;
  const isValidated = !toBeValidated || (typeof toBeValidated === "object" && Object.keys(toBeValidated).length === 0);

  return (
    <article
      onClick={onClick}
      className="group bg-card rounded-xl border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col"
    >
      {/* Zone principale : thumbnail + infos */}
      <div className="flex gap-3 p-3 flex-1">
        {/* Thumbnail */}
        <div className="shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          {image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" />
          ) : (
            <Image className="w-7 h-7 text-muted-foreground/40" />
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* Titre + badge */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {title}
            </h3>
            {isValidated && (
              <Badge className="shrink-0 bg-green-500/15 hover:bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 text-[10px] px-1.5 py-0 h-5">
                Validé
              </Badge>
            )}
          </div>

          {/* Contacts */}
          <div className="flex flex-col gap-0.5 mt-0.5">
            {email && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Mail className="w-3 h-3 shrink-0 text-primary/50" />
                <span className="truncate">{email}</span>
              </span>
            )}
            {phone && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Phone className="w-3 h-3 shrink-0 text-primary/50" />
                <span>{phone}</span>
              </span>
            )}
            {addressStr && (
              <span className="flex items-start gap-1 text-[11px] text-muted-foreground">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-primary/50" />
                <span className="line-clamp-2 leading-tight">{addressStr}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer : tags + bouton */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/50 bg-muted/30">
        <div className="flex flex-wrap gap-1 min-w-0 overflow-hidden">
          {visibleTags.map((tag, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 border-border/60 text-muted-foreground font-normal"
            >
              #{tag}
            </Badge>
          ))}
          {hiddenCount > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-5 font-normal"
            >
              +{hiddenCount}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          className="shrink-0 text-[11px] h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        >
          Voir la fiche
        </Button>
      </div>
    </article>
  );
}
