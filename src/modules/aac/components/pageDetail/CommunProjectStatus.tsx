import { useState } from "react";
import { FolderKanban, Loader2 } from "lucide-react";
import type { Api, Project } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { EntityPreviewDrawer } from "@/modules/profil/components/shared/EntityPreviewDrawer";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/lib/toastUtils";

/**
 * Le projet d'un commun AAC, côté lecture : « Ouvrir le projet », visible de TOUS, et la pastille
 * « Phase proposition ». Le passage en projet — générer ou associer — est une action de « ⋯ »
 * (`useCommunProjectActions`, câblé par `CommunActionBar`).
 */
export interface CommunProjectOpenButtonProps {
  api: Api | null;
  /** `targetResource?.projectId` — le projet lié, généré ou associé. */
  projectId: string;
  /** Slug résolu du projet (pour le lien "aller sur la page" du drawer). */
  projectSlug?: string | null;
  className?: string;
}

/**
 * Ouvre le drawer d'aperçu partagé du module profil (`EntityPreviewDrawer`) — PAS une navigation
 * `/profil/:slug`. L'entité n'est résolue qu'au premier clic, et une seule fois.
 */
export function CommunProjectOpenButton({ api, projectId, projectSlug, className }: CommunProjectOpenButtonProps) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [projectEntity, setProjectEntity] = useState<Project | null>(null);
  const [isResolvingPreview, setIsResolvingPreview] = useState(false);

  const openPreview = async () => {
    if (!api) return;
    if (!projectEntity) {
      setIsResolvingPreview(true);
      try {
        const entity = (await api.project({ id: projectId })) as Project;
        setProjectEntity(entity);
      } catch (error) {
        // Projet supprimé, visibilité restreinte, 500 transitoire : sans retour, le spinner
        // s'éteignait et le bouton redevenait cliquable comme si de rien n'était.
        console.warn("Impossible de résoudre le projet pour l'aperçu", error);
        showErrorToast(error, "detail.project.toasts.openError", t);
        return;
      } finally {
        setIsResolvingPreview(false);
      }
    }
    setPreviewOpen(true);
  };

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
          <FolderKanban className="size-3.5" />
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

/** Statut en lecture seule "Phase proposition" — commun pas encore passé en projet. */
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
