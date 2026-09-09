import { useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MilestoneEditDialog } from "@/modules/cagnotte/components/sections/parts/MilestoneEditDialog";
import CreateMilestoneDialog from "@/modules/cagnotte/components/sections/CreateMilestoneDialog";
import type { EditMilestoneParams } from "@/modules/cagnotte/actions/mutations/milestone";
import type { useCommunObjectivesController } from "@/modules/aac/hooks/useCommunObjectivesController";
import { COMMUN_RAW_DEPENSES_QUERY_KEY } from "@/modules/aac/hooks/useCommunRawDepenses";

export type CommunObjectivesController = ReturnType<typeof useCommunObjectivesController>;

/**
 * Les dialogues de palier de la fiche commun, montés UNE SEULE FOIS pour la page.
 *
 * « Besoins financiers » et « Suivi des actions » les rendaient chacun de leur côté,
 * à l'identique. Tant que chaque section avait SON contrôleur, chaque copie était
 * pilotée par un état distinct et une seule s'ouvrait. Depuis que le contrôleur est
 * remonté dans la page, les deux copies partageraient le même
 * `pendingDeleteMilestone` — donc s'ouvriraient ensemble. Les remonter ici n'est pas
 * qu'une déduplication : c'est ce qui rend le contrôleur unique tenable.
 *
 * Le bouton « Ajouter un palier » reste, lui, dans chaque section : il appartient à
 * la mise en page de son bloc, et ne fait qu'appeler `openCreateMilestoneModal`.
 */
export function CommunMilestoneDialogs({ ctrl }: { ctrl: CommunObjectivesController }) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const queryClient = useQueryClient();

    /**
     * La liste des paliers de la fiche est PILOTÉE par `useCommunRawDepenses`
     * (`buildItemsFromRawDepenses` itère sur les dépenses brutes ; l'enveloppe
     * n'enrichit qu'une dépense déjà présente). Or `CreateMilestoneDialog`
     * construit son propre contexte de mutation, sans `extraInvalidate` : sa
     * mutation n'invalide que l'enveloppe. Sans cette invalidation, le palier
     * créé n'apparaissait qu'au rechargement de la page — le toast de succès
     * avait pourtant été affiché. Même préfixe que `milestoneCtx` du contrôleur
     * pour éditer / clore / supprimer / restaurer.
     */
    const handleMilestoneCreated = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: [COMMUN_RAW_DEPENSES_QUERY_KEY, ctrl.resolvedAnswerId] }),
            ctrl.refetchFundingEnvelope(),
        ]);
    };

    return (
        <>
            <ConfirmDialog
                open={!!ctrl.pendingDeleteMilestone}
                onOpenChange={(open) => {
                    if (!open) ctrl.cancelDeleteMilestone();
                }}
                title={String(t("detail.objectives.deleteMilestoneConfirm.title"))}
                description={
                    ctrl.pendingDeleteMilestone
                        ? String(t("detail.objectives.deleteMilestoneConfirm.description", undefined, { name: ctrl.pendingDeleteMilestone.milestone.title }))
                        : ""
                }
                confirmLabel={String(t("detail.objectives.deleteMilestoneConfirm.confirm"))}
                cancelLabel={String(t("detail.objectives.deleteMilestoneConfirm.cancel"))}
                isDestructive
                isPending={
                    !!ctrl.pendingDeleteMilestone &&
                    ctrl.loadingIds.deletingItemId === ctrl.pendingDeleteMilestone.itemId
                }
                onConfirm={ctrl.confirmDeleteMilestone}
            />

            {ctrl.selectedMilestone && ctrl.milestoneEditInitialValues ? (
                <MilestoneEditDialog
                    open={ctrl.isEditMilestoneOpen}
                    onOpenChange={(open) => {
                        ctrl.setIsEditMilestoneOpen(open);
                        if (!open) ctrl.setSelectedMilestone(null);
                    }}
                    initialValues={ctrl.milestoneEditInitialValues}
                    milestoneId={ctrl.selectedMilestone.id}
                    answerDepenseIndex={ctrl.selectedMilestone.answerDepenseIndex}
                    mutation={ctrl.activeEditMilestoneMutation as unknown as UseMutationResult<void, Error, EditMilestoneParams>}
                    apiErrorFallbackKey="ActionsSection.errors.milestoneEditFailed"
                    onSuccess={ctrl.handleMilestoneEditSuccess}
                />
            ) : null}

            <CreateMilestoneDialog
                open={ctrl.isCreateMilestoneOpen}
                onOpenChange={ctrl.setIsCreateMilestoneOpen}
                selectedProjectId={ctrl.resolvedProjectId}
                answerId={ctrl.resolvedAnswerId}
                currentUserId={ctrl.currentUserId || ""}
                existingMilestoneIds={ctrl.existingMilestoneIds}
                isConnected={ctrl.isConnected}
                inputIdPrefix="aac-milestone"
                onCreated={handleMilestoneCreated}
                onRefetch={async () => {
                    await ctrl.refetchFundingEnvelope();
                }}
            />
        </>
    );
}
