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
import { Button } from "@/components/ui/button";
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
  const { voters, data, isLoading, isError, refetch } = useCommentVoters({ commentId, instance, enabled: true });
  const grouped = groupVotersByReaction(voters);
  // Sans instance, la requête ne part pas : rien ne viendra, c'est un échec et non une liste vide.
  // Une relecture ratée, elle, garde la liste servie — React Query la conserve à travers l'erreur
  // —, comme le panneau et le fil (relecture du lot, 16/10).
  const enEchec = !instance || (isError && data === undefined);

  // Ses propres libellés (revue du 16/10) : elle s'intitulait « Ajouter une réaction », chargeait
  // « la discussion » et disait « Aucun message » — un échec compris —, sous une description vide ;
  // et `max-w-sm` cédait au `sm:max-w-lg` de la base dès 640 px.
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("voters.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("voters.description")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("voters.loading")}</p>
        ) : enEchec ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm">
            <p className="text-muted-foreground">{t("voters.error")}</p>
            {instance ? (
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                {t("thread.retry")}
              </Button>
            ) : null}
          </div>
        ) : voters.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("voters.empty")}</p>
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
