import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Crown, ExternalLink, MailCheck, UserPlus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { initials } from "@/modules/cagnotte/utils/format";
import { InviteMemberDialog } from "@/modules/profil/components/members/InviteMemberDialog";
import { useProjectContributors } from "@/modules/profil/hooks/useMembersQuery";
import { AAC_QUERY_KEYS } from "@/modules/aac/constants/queryKeys";
import { useCommunProjectContributors } from "@/modules/aac/hooks/useCommunProjectContributors";
import { useCommunProjectEntity } from "@/modules/aac/hooks/useCommunProjectEntity";
import {
    canInviteContributors,
    isProjectAdmin,
    toCommunContributors,
    type CommunContributor,
    type ContributorSource,
} from "@/modules/aac/lib/communContributors";

interface CommunContributorsSectionProps {
    /** Le projet du commun. Absent = la section n'a pas lieu d'être affichée. */
    projectId?: string | null;
    /** Slug du projet, pour le lien « voir le projet » quand la liste est tronquée. */
    projectSlug?: string | null;
    /**
     * Le visiteur est le DÉPOSANT de ce commun. Calculé par la page, qui tient
     * déjà l'auteur de la réponse (`resolveAnswerAuthorId`) : il compose l'équipe
     * de son commun même sans administrer le projet lié.
     */
    isCommunAuthor?: boolean;
    /**
     * L'id du déposant, pour marquer SA ligne dans la liste. Distinct de
     * `isCommunAuthor`, qui dit si c'est le VISITEUR : l'un décore une fiche,
     * l'autre ouvre un droit, et le composant ne peut déduire ni l'un de l'autre
     * — il ne connaît pas l'utilisateur courant.
     */
    authorId?: string | null;
}

/** Cadre commun aux états vides et en erreur — même boîte que les cofinanceurs. */
function NoticeBox({ children }: { children: ReactNode }) {
    return (
        <div className="p-5 rounded-lg border border-border bg-surface/60">
            <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
        </div>
    );
}

function ContributorGrid({ children }: { children: ReactNode }) {
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function ContributorCard({
    contributor,
    roleLabel,
    authorLabel,
    icon,
    isAuthor = false,
    muted = false,
}: {
    contributor: CommunContributor;
    roleLabel: string;
    authorLabel: string;
    icon?: ReactNode;
    isAuthor?: boolean;
    muted?: boolean;
}) {
    const displayName = contributor.name;

    const roleLine = contributor.roles.length > 0
        ? `${roleLabel} · ${contributor.roles.join(", ")}`
        : roleLabel;

    return (
        <div
            className={cn(
                "flex items-center gap-3 p-3 rounded-lg border border-border bg-surface/60 transition-colors",
                muted ? "border-dashed opacity-75" : "hover:bg-surface"
            )}
        >
            <Avatar className="size-10 shrink-0">
                <AvatarImage src={contributor.imageUrl} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">
                    {displayName ? initials(displayName) : <Building2 className="size-4" aria-hidden="true" />}
                </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                    {contributor.slug ? (
                        <Link
                            to={`/profil/${contributor.slug}`}
                            className="truncate font-medium text-foreground hover:underline"
                        >
                            {displayName}
                        </Link>
                    ) : (
                        <p className="truncate font-medium text-foreground">{displayName}</p>
                    )}
                    {isAuthor && (
                        <Badge variant="secondary" className="text-[10px]">
                            {authorLabel}
                        </Badge>
                    )}
                </div>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground" title={roleLine}>
                    {icon}
                    {roleLine}
                </p>
            </div>
        </div>
    );
}

export function CommunContributorsSection({
    projectId,
    projectSlug,
    isCommunAuthor = false,
    authorId,
}: CommunContributorsSectionProps) {
    useLoadNamespace("modules/aac");
    useLoadNamespace("modules/profil");
    const t = useT("modules/aac");
    const queryClient = useQueryClient();

    const [isInviteOpen, setIsInviteOpen] = useState(false);

    const { contributors, total, links, isLoading, isError } = useCommunProjectContributors(projectId);

    const projectEntity = useCommunProjectEntity(projectId);
    const isAdminOfProject = isProjectAdmin(projectEntity);
    const canInvite = canInviteContributors(projectEntity, { isCommunAuthor });

    const { contributors: pendingResults } = useProjectContributors(
        isAdminOfProject ? projectEntity : null,
        { isInviting: true }
    );

    const pending = useMemo(() => {
        const dejaListes = new Set(contributors.map((contributor) => contributor.id));
        return toCommunContributors(pendingResults as ContributorSource[], links).filter(
            (contributor) => !dejaListes.has(contributor.id)
        );
    }, [pendingResults, contributors, links]);

    if (!projectId) return null;

    const nomAffiche = (contributor: CommunContributor): CommunContributor =>
        contributor.name ? contributor : { ...contributor, name: String(t("detail.noname")) };

    const estDeposant = (contributor: CommunContributor): boolean =>
        !!authorId && contributor.id === authorId;

    const authorLabel = String(t("detail.contributorsSection.author"));

    const hidden = Math.max(total - contributors.length, 0);

    const handleInviteOpenChange = (ouvert: boolean) => {
        setIsInviteOpen(ouvert);
        if (!ouvert) {
            queryClient.invalidateQueries({ queryKey: AAC_QUERY_KEYS.COMMUN_CONTRIBUTORS_PREFIX() });
        }
    };

    let corps: ReactNode;
    if (isLoading) {
        corps = (
            <ContributorGrid>
                {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-[66px] rounded-lg" />
                ))}
            </ContributorGrid>
        );
    } else if (isError) {
        corps = <NoticeBox>{String(t("detail.contributorsSection.error"))}</NoticeBox>;
    } else if (contributors.length === 0) {
        corps = <NoticeBox>{String(t("detail.contributorsSection.empty"))}</NoticeBox>;
    } else {
        corps = (
            <ContributorGrid>
                {contributors.map((contributor) => (
                    <ContributorCard
                        key={contributor.id}
                        contributor={nomAffiche(contributor)}
                        isAuthor={estDeposant(contributor)}
                        authorLabel={authorLabel}
                        icon={
                            contributor.isAdmin ? (
                                <Crown className="size-3 shrink-0" aria-hidden="true" />
                            ) : contributor.type === "organizations" ? (
                                <Building2 className="size-3 shrink-0" aria-hidden="true" />
                            ) : undefined
                        }
                        roleLabel={String(
                            t(
                                contributor.isAdmin
                                    ? "detail.contributorsSection.admin"
                                    : contributor.type === "organizations"
                                        ? "detail.contributorsSection.organization"
                                        : "detail.contributorsSection.contributor"
                            )
                        )}
                    />
                ))}
            </ContributorGrid>
        );
    }

    return (
        <div className="space-y-4">
            {canInvite && (
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsInviteOpen(true)}>
                        <UserPlus className="size-3.5" />
                        {String(t("detail.contributorsSection.addCta"))}
                    </Button>
                </div>
            )}

            {corps}

            {pending.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {String(t("detail.contributorsSection.pendingTitle"))}
                    </p>
                    <ContributorGrid>
                        {pending.map((contributor) => (
                            <ContributorCard
                                key={contributor.id}
                                contributor={nomAffiche(contributor)}
                                isAuthor={estDeposant(contributor)}
                                authorLabel={authorLabel}
                                icon={<MailCheck className="size-3 shrink-0" aria-hidden="true" />}
                                roleLabel={String(t("detail.contributorsSection.pendingInvitation"))}
                                muted
                            />
                        ))}
                    </ContributorGrid>
                </div>
            )}

            {hidden > 0 && (
                <p className="text-sm text-muted-foreground">
                    {String(t("detail.contributorsSection.more", undefined, { count: hidden }))}
                    {projectSlug && (
                        <>
                            {" "}
                            <Link
                                to={`/profil/${projectSlug}`}
                                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                                {String(t("detail.contributorsSection.seeProject"))}
                                <ExternalLink className="size-3" aria-hidden="true" />
                            </Link>
                        </>
                    )}
                </p>
            )}

            {canInvite && projectEntity && (
                <InviteMemberDialog
                    entity={projectEntity}
                    open={isInviteOpen}
                    onOpenChange={handleInviteOpenChange}
                />
            )}
        </div>
    );
}
