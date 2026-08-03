import { CalendarPlus, Share2, PencilLine, MessageCircle, ThumbsUp, Lock, Users, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/hooks/useT";
import { useFormatNews } from "@/modules/news/hooks/useFormatNews";
import { newsExcerpt } from "@/modules/news/lib/newsExcerpt";
import type { News } from "@communecter/cocolight-api-client";
import { SearchCardProps } from "../../schema";

function initialsOf(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

// Portées non-publiques → icône + libellé (tooltip). `public` = pas de chip.
const SCOPE_META = {
  private: { Icon: Lock, key: "Privé" },
  restricted: { Icon: Users, key: "Réservé aux membres" },
} as const;

/**
 * Carte "actualité" pour searchProStatic (`card.type: "news"`), TEXT-FIRST.
 *
 * Deux natures de news cohabitent (cf. collection `news`) :
 *  - VRAIE news éditoriale (`type=news`) : a un `text` (markdown) + média + tags, PAS d'`object`.
 *  - Item de fil (`type=activityStream`, `verb=create`) : PAS de texte, référence un `object`.
 * On rend donc l'EXTRAIT en priorité (texte éditorial aplati en clair via `newsExcerpt`) et on
 * retombe sur une LIGNE-ENTITÉ CITÉE ("a créé [object]" + vignette) sinon.
 *
 * Normalisation via `useFormatNews` (même source que le mur profil : author/date/média/tags/scope/counts).
 * Le clic (onClick) ouvre le détail (drawer/dialog → PreviewNews).
 */
export default function CardNews({ item, onClick, card = {} }: SearchCardProps<News>) {
  const t = useT("modules/search");
  const f = useFormatNews(item, null);
  const nd = (item.serverData ?? {}) as Record<string, unknown>;
  const object = (nd.object ?? {}) as {
    type?: string; name?: string; profilMediumImageUrl?: string; profilThumbImageUrl?: string;
  };
  const verb = String(nd.verb ?? "");

  const authorName = f?.authorName || t("Quelqu'un");
  const objectName = object.name ?? "";
  const objectImage = object.profilMediumImageUrl || object.profilThumbImageUrl || "";
  const cover = f?.hasImages ? (f.images[0]?.imageThumbPath || f.images[0]?.imagePath || "") : "";
  // Sans image, l'extrait REMPLIT la zone image (carte à hauteur uniforme) → on récupère beaucoup
  // plus de texte ; le trop-plein est masqué par un fondu (overflow-hidden + dégradé).
  const excerpt = newsExcerpt(f?.text, cover ? 240 : 600); // markdown → texte brut lisible
  const hasText = excerpt.length > 0;
  const tags = (Array.isArray(f?.tags) ? f!.tags : []).filter((x): x is string => typeof x === "string");
  const commentCount = f?.commentCount ?? 0;
  const totalVotes = f?.totalVotes ?? 0;

  // Libellé + icône d'action pour les items de fil (sans texte) : "a créé/partagé/… [object]".
  const activity = (() => {
    switch (verb) {
      case "create": return { label: t("a créé"), Icon: CalendarPlus };
      case "share": return { label: t("a partagé"), Icon: Share2 };
      case "update": return { label: t("a modifié"), Icon: PencilLine };
      default: return { label: t("a publié"), Icon: Share2 };
    }
  })();
  const ActivityIcon = activity.Icon;

  const scope = SCOPE_META[f?.scope as keyof typeof SCOPE_META];
  const ScopeIcon = scope?.Icon;

  return (
    <Card
      className="group relative flex h-full flex-col overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      onClick={onClick}
    >
      {/* Filet d'accent latéral : signature « actualité » */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-primary/70" />

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4 pl-5">
        {/* En-tête : auteur + date (+ portée + cible de partage) */}
        <div className="flex items-center gap-2">
          <Avatar className="h-9 w-9 shrink-0 bg-primary/10">
            <AvatarImage src={f?.authorPhoto ?? undefined} alt={authorName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initialsOf(authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{authorName}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {f?.formattedDate && <span className="truncate">{f.formattedDate}</span>}
              {scope && ScopeIcon && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex shrink-0 items-center">
                        <ScopeIcon className="h-3 w-3" aria-label={t(scope.key)} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t(scope.key)}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {f?.isSharedPost && f.targetName && (
                <span className="truncate">· {t("sur")} {f.targetName}</span>
              )}
            </div>
          </div>
        </div>

        {/* Corps : zone `flex-1` qui REMPLIT la carte → hauteur uniforme, jamais de vide. */}
        {hasText && cover ? (
          // Actu AVEC image : court extrait + image qui occupe tout l'espace restant.
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <p className="line-clamp-2 shrink-0 text-sm leading-relaxed text-foreground/90 break-words">
              {excerpt}
            </p>
            <div className="relative min-h-40 flex-1 overflow-hidden rounded-md bg-muted">
              <OptimizedImage
                src={cover}
                alt={authorName}
                width={480}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
          </div>
        ) : hasText ? (
          // Actu SANS image : le texte occupe la zone image, fondu en bas pour la coupe.
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <p className="text-sm leading-relaxed text-foreground/90 break-words">{excerpt}</p>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent"
            />
          </div>
        ) : objectName ? (
          // Item de fil : entité citée, centrée dans l'espace disponible.
          <div className="flex min-h-0 flex-1 items-center">
            <div className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5">
              {objectImage ? (
                <OptimizedImage
                  src={objectImage}
                  alt={objectName}
                  width={112}
                  className="h-12 w-12 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ActivityIcon className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {activity.label}
                </p>
                <p className="line-clamp-2 text-sm font-medium text-foreground">{objectName}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, card.tagLimit ?? 3).map((tag, i) => (
              <Badge key={i} variant="secondary" className="max-w-[8rem] overflow-hidden text-xs" title={tag}>
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Pied : engagement + affordance « Lire » (visible, s'anime au survol de la carte) */}
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          {totalVotes > 0 && (
            <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{totalVotes}</span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{commentCount}</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 font-medium transition-colors group-hover:text-primary">
            {t("Lire")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
