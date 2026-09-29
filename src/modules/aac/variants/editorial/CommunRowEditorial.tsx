import { Link } from "react-router";
import { Heart, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { AacCommunDeleteButton } from "../../components/directory/AacCommunDeleteButton";
import type { AacCommunItemProps } from "../../components/directory/variants/items";
import { AAC_VISIBLE_TAGS, formatAacAmount, progressBarWidth } from "../../lib/aacDisplay";
import { communPath } from "../../lib/communPath";

/**
 * Ligne d'un commun, interface « editorial » : les données de la carte en largeur.
 * Même lien étiré que la carte, bouton de suppression au-dessus.
 */
export default function CommunRowEditorial({ commun, onRequestDelete, isDeleting, className }: AacCommunItemProps) {
  const t = useT("modules/aac");
  const title = commun.hasTitle ? commun.title : String(t("directory.card.untitled"));

  return (
    <article
      className={cn(
        "group relative flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/45",
        className
      )}
    >
      <div className="min-w-0 grow">
        <h3 className="truncate font-display text-xl leading-tight">
          <Link to={communPath(commun.id)} className="text-foreground transition-colors group-hover:text-primary after:absolute after:inset-0 after:content-['']">
            {title}
          </Link>
        </h3>
        {/* Commune puis tags (commune seulement avec le rôle `directory.fields.adresse`). */}
        <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          {commun.address?.locality && (
            <>
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">{String(t("directory.card.location"))}</span>
              {/* Au-dessus du lien étiré pour que l'infobulle s'ouvre. */}
              <span
                className="relative z-10 shrink-0"
                title={commun.address.label || undefined}
              >
                {commun.address.locality}
              </span>
              {commun.tags.length > 0 && (
                <span className="text-border" aria-hidden="true">
                  •
                </span>
              )}
            </>
          )}
          <span className="min-w-0 truncate">{commun.tags.slice(0, AAC_VISIBLE_TAGS).join(" • ")}</span>
        </p>
      </div>

      <div className="hidden shrink-0 gap-1.5 lg:flex">
        {commun.isSelected === false && (
          <Badge variant="outline" className="border-accent bg-accent/60 text-accent-foreground">
            {String(t("directory.card.pending"))}
          </Badge>
        )}
        {commun.maturity && <Badge variant="secondary">{commun.maturity}</Badge>}
      </div>
      {/* Sous `lg`, seul le badge « en attente » reste. */}
      {commun.isSelected === false && (
        <Badge variant="outline" className="shrink-0 border-accent bg-accent/60 text-accent-foreground lg:hidden">
          {String(t("directory.card.pending"))}
        </Badge>
      )}

      <div className="hidden w-36 shrink-0 sm:block">
        {commun.hasFundingRequest ? (
          <>
            <Progress
              value={progressBarWidth(commun.progressPercent)}
              className="h-1.5"
              aria-label={String(t("directory.card.collected"))}
            />
            <p className="mt-1 truncate text-right text-xs text-muted-foreground">
              {formatAacAmount(commun.totalFunded)} €
            </p>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3.5" aria-hidden="true" />
          {commun.usersCount}
          <span className="sr-only">
            {String(t(commun.usersCount > 1 ? "directory.card.users" : "directory.card.user"))}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Heart className="size-3.5" aria-hidden="true" />
          {commun.interestCount}
          <span className="sr-only">
            {String(t(commun.interestCount > 1 ? "directory.card.interested_other" : "directory.card.interested_one"))}
          </span>
        </span>
      </div>

      {onRequestDelete && (
        <div className="relative z-10 shrink-0">
          <AacCommunDeleteButton
            communTitle={commun.title}
            onClick={() => onRequestDelete(commun)}
            disabled={isDeleting}
          />
        </div>
      )}
    </article>
  );
}
