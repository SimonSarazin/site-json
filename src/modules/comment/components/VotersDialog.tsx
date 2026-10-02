import type { Comment } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCommentVoters } from "../hooks/useCommentVoters";
import { initialesDe } from "../lib/initiales";
import { groupVotersByReaction } from "../lib/voters";
import { voteTypeMap } from "../constants/voteTypes";

export interface VotersDialogProps {
  readonly commentId: string;
  readonly instance?: Comment | null;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Qui a réagi à un message.
 *
 * Monté seulement à l'ouverture, et c'est ce montage qui déclenche la requête : la liste des
 * votants n'est chargée pour aucun des messages qu'on se contente de lire.
 *
 * Elle affiche nom et avatar sans appel supplémentaire — `SHOW_VOTE` les porte déjà (mesuré).
 */
export function VotersDialog({ commentId, instance, onOpenChange }: VotersDialogProps) {
  const t = useT("modules/comment");
  const { voters, isLoading } = useCommentVoters({ commentId, instance, enabled: true });
  const grouped = groupVotersByReaction(voters);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("reactions.add")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("a11y.reactionCount", undefined, { reaction: "", count: voters.length })}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("thread.loading")}</p>
        ) : voters.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("thread.empty")}</p>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="space-y-4 pe-2">
              {Array.from(grouped.entries()).map(([reaction, list]) => {
                const meta = voteTypeMap[reaction];
                const Icon = meta?.icon;
                return (
                  <section key={reaction}>
                    <h3 className="flex items-center gap-1.5 pb-1 text-xs font-semibold text-muted-foreground">
                      {Icon ? <Icon className={cn("size-3.5", meta?.iconClass)} aria-hidden /> : null}
                      {meta?.label ? t(meta.label) : reaction}
                      <span className="tabular-nums">({list.length})</span>
                    </h3>
                    <ul className="space-y-1">
                      {list.map(voter => (
                        <li key={voter.id} className="flex items-center gap-2">
                          <Avatar className="size-7 bg-card">
                            {voter.avatarUrl ? (
                              <AvatarImage src={voter.avatarUrl} alt="" className="object-cover" />
                            ) : null}
                            <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                              {initialesDe(voter.name, 1)}
                            </AvatarFallback>
                          </Avatar>
                          {voter.slug ? (
                            <a href={`/profil/${voter.slug}`} className="truncate text-sm hover:underline">
                              {voter.name}
                            </a>
                          ) : (
                            <span className="truncate text-sm">{voter.name}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
