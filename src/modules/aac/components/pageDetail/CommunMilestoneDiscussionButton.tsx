import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { lineDiscussion, useDiscussionSpaceQuery, useSpaceLauncher, type SpaceRef } from "@/modules/comment/launch";
import { OPENER_ATTRIBUTE, milestoneOpener, prechaufferLaModale } from "./communDiscussion";

export interface CommunMilestoneDiscussionButtonProps {
    /** Le commun : c'est son espace de discussion qui s'ouvre. */
    answerId: string;
    /** La CLÉ de la ligne de dépense dans le document du commun — pas sa position à l'écran. */
    lineKey: string;
    /** Le nom du palier, pour dire de quoi l'on discute. */
    name?: string | null;
    className?: string;
}

/**
 * Le bouton « Discuter » d'un palier : il ouvre l'espace de discussion du commun sur le fil de
 * CETTE ligne de dépense.
 *
 * Parité legacy : c'est l'action « Commenter » que porte chaque carte de la liste des dépenses
 * (`newDepenseList.php`), au dépôt comme à l'étape de financement — un fil par ligne (doc/38,
 * fils d'une ligne de dépense).
 *
 * Il ne monte rien : la modale est celle de `CommunDiscussionControl`, qui s'ouvre par l'adresse.
 * Le fil vient de la liste de l'espace, qui fait autorité — c'est elle qui dit où l'on entre, et
 * sur quelle liste se lance un fil que personne n'a encore écrit. Sans fil pour la ligne, ou sans
 * rien à y lire pour qui ne peut pas écrire, il n'y a pas de bouton.
 *
 * Le compteur vient de la même entrée de cache que celui de la fiche : un bouton par palier ne
 * coûte aucune requête de plus.
 */
export function CommunMilestoneDiscussionButton({ answerId, lineKey, name, className }: CommunMilestoneDiscussionButtonProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const space = useMemo<SpaceRef>(() => ({ type: "answers", id: answerId }), [answerId]);
    const launcher = useSpaceLauncher(space);
    const { threads, canComment } = useDiscussionSpaceQuery(space);
    const { target, total, unread } = lineDiscussion(threads, lineKey);

    if (target === null || (total === 0 && !canComment)) return null;

    const nom = name?.trim();
    // Le nom accessible COMMENCE par le texte visible (« Discuter ») : qui dicte ce qu'il lit le trouve.
    const libelle = [
        String(nom ? t("detail.discussion.milestoneNamed", undefined, { name: nom }) : t("detail.discussion.milestone")),
        total > 0 ? String(t("detail.discussion.messages", undefined, { count: total })) : null,
        unread > 0 ? String(t("detail.discussion.unread", undefined, { count: unread })) : null,
    ].filter(Boolean).join(", ");
    const ouvreur = milestoneOpener(lineKey);

    return (
        <Button
            variant="ghost"
            size="sm"
            // `has-[>svg]:` : c'est sous cette variante que la taille `sm` pose sa marge quand le
            // bouton porte une icône — un `px-2` nu perdait contre elle.
            className={cn("text-muted-foreground hover:text-foreground h-8 gap-1.5 has-[>svg]:px-2", className)}
            // Ce que le bouton ouvre est un dialogue : le lecteur d'écran l'annonce avant le clic.
            aria-haspopup="dialog"
            aria-label={libelle}
            title={libelle}
            onClick={() => launcher.openAt(target, ouvreur)}
            // Même geste que le bouton de la fiche : le code de la modale arrive avant le clic.
            onMouseEnter={prechaufferLaModale}
            onFocus={prechaufferLaModale}
            data-milestone-discussion={lineKey}
            {...{ [OPENER_ATTRIBUTE]: ouvreur }}
        >
            <MessageSquare className="size-4" aria-hidden />
            {/* Le mot n'arrive qu'à 80 rem : en deçà il prenait au NOM du palier la place qui lui
                restait (42 px entre 640 et 767 px, mesuré le 13/10). L'icône et le compteur
                suffisent, et le nom accessible dit le reste. */}
            <span className="hidden xl:inline">{String(t("detail.discussion.milestoneCta"))}</span>
            {total > 0 && <span className="tabular-nums" data-milestone-discussion-total>{total}</span>}
            {unread > 0 && (
                <span
                    className="bg-primary text-primary-foreground min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.6875rem] leading-none font-semibold tabular-nums"
                    data-milestone-discussion-unread
                >
                    {unread > 99 ? "99+" : unread}
                </span>
            )}
        </Button>
    );
}
