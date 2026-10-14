import { Link } from "react-router";
import { Heart, MapPin, Users, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { AacHiddenTagsBadge } from "../../components/directory/AacHiddenTagsBadge";
import { AacCommunDeleteButton } from "../../components/directory/AacCommunDeleteButton";
import { AacCommunProjectLink } from "../../components/directory/AacCommunProjectLink";
import type { AacCommunItemProps } from "../../components/directory/variants/items";
import { formatAacAmount, progressBarWidth } from "../../lib/aacDisplay";
import { communPath } from "../../lib/communPath";

/** Tags affichés avant le repli dans la pastille « … ». */
const VISIBLE_TAGS = 1;

/**
 * Carte d'un commun, interface « editorial » (`project-card` de la maquette) : sans image,
 * titre en police d'affichage, collecte en pied. Cliquable par un lien étiré sur le titre
 * (pas de `<a>` englobant : la carte peut porter un bouton de suppression).
 */
export default function CommunCardEditorial({
  commun,
  onRequestDelete,
  isDeleting,
  className,
}: AacCommunItemProps) {
  const t = useT("modules/aac");
  const title = commun.hasTitle ? commun.title : String(t("directory.card.untitled"));

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg",
        className
      )}
    >
      {onRequestDelete && (
        // Au-dessus du lien étiré.
        <div className="absolute top-2 right-2 z-10">
          <AacCommunDeleteButton
            communTitle={commun.title}
            onClick={() => onRequestDelete(commun)}
            disabled={isDeleting}
          />
        </div>
      )}

      <div className="flex min-h-4 items-center gap-2 pr-8 text-xs text-muted-foreground">
        {commun.address?.locality && (
          <>
            <span className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">{String(t("directory.card.location"))}</span>
              <span className="relative z-10 min-w-0 truncate" title={commun.address.label || undefined}>
                {commun.address.locality}
              </span>
            </span>
            {commun.tags.length > 0 && (
              <span className="text-border" aria-hidden="true">
                •
              </span>
            )}
          </>
        )}
        {commun.tags.slice(0, VISIBLE_TAGS).map((tag, i) => (
          <span key={tag} className="flex items-center gap-2">
            {i > 0 && <span className="text-border" aria-hidden="true">•</span>}
            {tag}
          </span>
        ))}
        <AacHiddenTagsBadge
          tags={commun.tags.slice(VISIBLE_TAGS)}
          className="relative z-10 px-1.5 py-px text-[11px]"
        />
      </div>

      <h3 className="mt-3 font-display text-2xl leading-[1.08]">
        <Link to={communPath(commun.id)} className="text-foreground transition-colors group-hover:text-primary after:absolute after:inset-0 after:content-['']">
          {title}
        </Link>
      </h3>
      {commun.description && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{commun.description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {commun.isSelected === false && (
          <Badge variant="outline" className="border-accent bg-accent/60 text-accent-foreground">
            {String(t("directory.card.pending"))}
          </Badge>
        )}
        <AacCommunProjectLink
          project={commun.project}
          className="rounded-md border border-primary/30 px-2 py-0.5 font-medium text-primary"
        />
        {commun.keywords.map((keyword) => (
          <Badge key={keyword} variant="outline">
            {keyword}
          </Badge>
        ))}
      </div>

      <div className="mt-auto pt-5">
        {commun.hasFundingRequest && (
          <Progress
            value={progressBarWidth(commun.progressPercent)}
            className="h-1.5"
            aria-label={String(t("directory.card.collected"))}
          />
        )}
        {/* Collecte et réactions ; compteurs au-dessus du lien étiré pour garder leur tooltip. */}
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p className="min-w-0">
            {commun.hasFundingRequest
              ? String(
                  t("editorial.directory.card.raised", undefined, {
                    raised: formatAacAmount(commun.totalFunded),
                    needed: formatAacAmount(commun.totalRequested),
                  })
                )
              : String(t("directory.card.noFunding"))}
          </p>
          <div className="relative z-10 flex shrink-0 items-center gap-3">
            <Reaction
              icon={Users}
              count={commun.usersCount}
              label={String(t(commun.usersCount > 1 ? "directory.card.users" : "directory.card.user"))}
            />
            <Reaction
              icon={Heart}
              count={commun.interestCount}
              label={String(
                t(commun.interestCount > 1 ? "directory.card.interested_other" : "directory.card.interested_one")
              )}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Un compteur de réaction, avec son libellé complet (« 2 utilisateurs ») en tooltip. */
function Reaction({ icon: Icon, count, label }: { icon: LucideIcon; count: number; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Focusable : tooltip au clavier. */}
        <span tabIndex={0} className="flex cursor-default items-center gap-1 rounded-sm">
          <Icon className="size-3.5" aria-hidden="true" />
          {count}
          <span className="sr-only">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {count} {label}
      </TooltipContent>
    </Tooltip>
  );
}
