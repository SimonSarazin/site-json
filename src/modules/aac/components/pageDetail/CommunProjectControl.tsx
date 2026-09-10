import { useState } from "react";
import { Eye, Loader2, Search, Sparkles } from "lucide-react";
import type { Api, Organization, Project } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EntityPreviewDrawer } from "@/modules/profil/components/shared/EntityPreviewDrawer";
import { FinderSearchModal } from "@/modules/coform/components/FinderSearchModal";
import type { FinderConfig, FinderElement } from "@/modules/coform/types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/lib/toastUtils";
import { useGenerateAacProject } from "../../hooks/useGenerateAacProject";
import { useAssociateExistingAacProject } from "../../hooks/useAssociateExistingAacProject";

/**
 * Bouton "Ouvrir le projet" / "Générer le projet" / "Associer un projet
 * existant" de la fiche d'un commun AAC.
 */
export interface CommunProjectControlProps {
  api: Api | null;
  /**
   * Qui peut rattacher un projet à ce commun — seuls eux voient "Générer"/"Associer".
   * Le déposant du commun et l'admin de l'AAC courant (cf. `AacCommunDetailPage`) :
   * ouvrir le suivi de SON commun fait partie de ce qu'on gère soi-même.
   */
  canManageProject: boolean;
  answerId: string | null;
  /** `targetResource?.projectId` — présence = projet déjà lié (généré ou associé). */
  projectId?: string | null;
  /** Slug résolu du projet (pour le lien "aller sur la page" du drawer). */
  projectSlug?: string | null;
  /** `directory.contextId` — costum.contextId legacy. */
  parentId: string | null;
  /** `directory.context?.type` — costum.contextType legacy. */
  parentType?: string | null;
  /** Utilisateur courant — requis pour le backfill dépense lors d'une association. */
  userId: string | null;
  /**
   * Hôte du costum (`useCocolight().entity`) — pour la double vérif « projet déjà
   * rattaché à un autre commun » à l'association (`coformAnswersSearch` scopé costum).
   */
  contextEntity?: Organization | Project | null;
  onGenerated?: () => void;
  className?: string;
}

const PROJECT_FINDER_CONFIG_BASE: Omit<
  FinderConfig,
  "elementLabel" | "buttonLabel" | "placeholderSearchField" | "filters"
> = {
  type: "projects",
  excludeFilters: [],
  notSourceKey: true,
  myContacts: false,
  initCurrentUser: false,
  field: "project",
  multiple: false,
  addNew: false,
  invite: false,
  linkToAnswer: false,
  singleAnswerPerElement: false,
  msgSingleAnswerPerElement: "",
  redirectSingleAnswerPerElement: "Accueil",
  editElement: false,
  addToLinks: { value: false, links: "" },
};

export function CommunProjectControl({
  api,
  canManageProject,
  answerId,
  projectId,
  projectSlug,
  parentId,
  parentType,
  userId,
  contextEntity,
  onGenerated,
  className,
}: CommunProjectControlProps) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [associateOpen, setAssociateOpen] = useState(false);
  const [projectEntity, setProjectEntity] = useState<Project | null>(null);
  const [isResolvingPreview, setIsResolvingPreview] = useState(false);

  const generate = useGenerateAacProject({
    api,
    answerId,
    parentId,
    parentType: parentType ?? null,
  });
  const associate = useAssociateExistingAacProject({ api, answerId, userId, context: contextEntity ?? null });

  const hasProject = Boolean(projectId);

  const openPreview = async () => {
    if (!api || !projectId) return;
    if (!projectEntity) {
      setIsResolvingPreview(true);
      try {
        const entity = (await api.project({ id: projectId })) as Project;
        setProjectEntity(entity);
      } catch (error) {
        // Projet supprimé, visibilité restreinte, 500 transitoire : sans retour, le
        // spinner s'éteignait et le bouton redevenait cliquable comme si de rien
        // n'était — le seul chemin d'erreur du composant à ne rien dire.
        console.warn("Impossible de résoudre le projet pour l'aperçu", error);
        showErrorToast(error, "detail.project.toasts.openError", t);
        return;
      } finally {
        setIsResolvingPreview(false);
      }
    }
    setPreviewOpen(true);
  };

  if (hasProject) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          onClick={openPreview}
          disabled={isResolvingPreview}
        >
          {isResolvingPreview ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Eye className="size-3.5" />
          )}
          {String(t("detail.project.openCta"))}
        </Button>

        {projectEntity && (
          <EntityPreviewDrawer
            entity={projectEntity}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            link={projectSlug ? `/profil/${projectSlug}` : undefined}
            openPageTitle={String(t("detail.project.openFullPage"))}
          />
        )}
      </>
    );
  }

  if (!canManageProject) {
    return <CommunProjectBadge className={className} />;
  }

  const confirmer = () => {
    generate.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false);
        onGenerated?.();
      },
    });
  };

  const handleSelectExistingProject = (elements: FinderElement[]) => {
    const picked = elements[0];
    if (!picked) return;
    associate.mutate(
      { projectId: picked.id },
      {
        onSuccess: () => {
          setAssociateOpen(false);
          onGenerated?.();
        },
      }
    );
  };

  const projectFinderConfig: FinderConfig = {
    ...PROJECT_FINDER_CONFIG_BASE,
    filters: userId
      ? [
          { attributeName: `links.contributors.${userId}.type`, valueName: "citoyens" },
          { attributeName: `links.contributors.${userId}.isAdmin`, valueName: "true" },
        ]
      : [],
    elementLabel: String(t("detail.project.associate.finderLabel")),
    buttonLabel: String(t("detail.project.associate.finderButton")),
    placeholderSearchField: String(t("detail.project.associate.finderPlaceholder")),
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => setConfirmOpen(true)}
        disabled={generate.isPending}
      >
        {generate.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        {String(t("detail.project.generateCta"))}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => setAssociateOpen(true)}
        disabled={associate.isPending || !userId}
      >
        {associate.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Search className="size-3.5" />
        )}
        {String(t("detail.project.associateCta"))}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={confirmer}
        title={String(t("detail.project.confirmGenerate.title"))}
        description={String(t("detail.project.confirmGenerate.description"))}
        confirmLabel={String(t("detail.project.confirmGenerate.confirm"))}
        cancelLabel={String(t("detail.project.confirmGenerate.cancel"))}
        isDestructive
        isPending={generate.isPending}
      />

      {associateOpen && (
        <FinderSearchModal
          config={projectFinderConfig}
          selectedElements={{}}
          onClose={() => setAssociateOpen(false)}
          onValidate={handleSelectExistingProject}
        />
      )}
    </>
  );
}

/** Statut en lecture seule "Phase proposition" — commun pas encore promu en projet. */
export function CommunProjectBadge({ className }: { className?: string }) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        "bg-accent/80 text-accent-foreground",
        className
      )}
    >
      {String(t("detail.project.proposalPhaseBadge"))}
    </span>
  );
}
