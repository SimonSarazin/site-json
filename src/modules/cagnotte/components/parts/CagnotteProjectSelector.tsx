import { Briefcase, Loader, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { OrgProject } from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers";

interface CagnotteProjectSelectorProps {
  /** Entité orga courante. Si `null` → affiche un placeholder "no organization". */
  hasEntity: boolean;
  /** `true` tant que la liste des projets se charge. */
  isLoading: boolean;
  /** Liste des projets typés. */
  projects: OrgProject[];
  /** Projet actuellement sélectionné (peut être `undefined` au mount). */
  selectedProject: OrgProject | undefined;
  /** Id du projet sélectionné (state controlled). */
  selectedProjectId: string;
  /** Callback pour changer le projet sélectionné. */
  onSelectedProjectIdChange: (id: string) => void;
  /** Si `true` → mode read-only (pas de select, juste affichage du projet). */
  hideProjectSelect: boolean;
  /** Map projetId → montants agrégés (priorité sur `OrgProject.cagnotte{Total,Target}Amount`). */
  fundingByProjectId: Map<string, { totalFunding: number; totalCost: number }>;
  /** `true` si le projet sélectionné est déjà le projectModalId courant → cache le bouton save. */
  isCurrentProjectModalId: boolean;
  /** `true` pendant la sauvegarde "main cagnotte". */
  isSavingProjectModal: boolean;
  /** Callback déclenché par le bouton "definir comme cagnotte principale". */
  onSaveProjectModal: () => void;
}

/**
 * Sélecteur de projet pour le `CagnotteDialog`.
 *
 * Gère 4 états visuels :
 *  1. Pas d'entité → message "aucune organisation".
 *  2. Loading → spinner + label.
 *  3. Projets chargés + `hideProjectSelect` → affichage read-only du projet.
 *  4. Projets chargés + select interactif → dropdown + bouton "main cagnotte".
 */
export function CagnotteProjectSelector({
  hasEntity,
  isLoading,
  projects,
  selectedProject,
  selectedProjectId,
  onSelectedProjectIdChange,
  hideProjectSelect,
  fundingByProjectId,
  isCurrentProjectModalId,
  isSavingProjectModal,
  onSaveProjectModal,
}: CagnotteProjectSelectorProps) {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const untitled = String(t("CagnotteDialog.fallbacks.untitled"));

  return (
    <div className="space-y-3 border-t pt-6">
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-primary" />
        <Label className="text-sm font-medium text-foreground">
          {hideProjectSelect
            ? t("CagnotteDialog.labels.supportedProject")
            : t("CagnotteDialog.labels.selectProject")}
        </Label>
      </div>

      {!hasEntity ? (
        <div className="py-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          <p>{t("CagnotteDialog.labels.noOrganization")}</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t("CagnotteDialog.labels.loadingProjects")}</span>
        </div>
      ) : projects.length > 0 ? (
        hideProjectSelect ? (
          <div className="h-10 rounded-md border bg-muted/20 px-3 flex items-center gap-2">
            {selectedProject?.image ? (
              <img
                src={selectedProject.image}
                alt={selectedProject.name || untitled}
                className="w-5 h-5 rounded object-cover"
              />
            ) : null}
            <span className="text-sm font-medium truncate">
              {selectedProject?.name || untitled}
            </span>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select value={selectedProjectId} onValueChange={onSelectedProjectIdChange}>
                <SelectTrigger className="h-10">
                  {selectedProject ? (
                    <div className="flex items-center gap-2">
                      {selectedProject.image && (
                        <img
                          src={selectedProject.image}
                          alt={selectedProject.name || untitled}
                          className="w-5 h-5 rounded object-cover"
                        />
                      )}
                      <span>{selectedProject.name || untitled}</span>
                    </div>
                  ) : (
                    <SelectValue
                      placeholder={String(t("CagnotteDialog.labels.selectProjectPlaceholder"))}
                    />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => {
                    if (!project.id) return null;
                    const funding = fundingByProjectId.get(project.id);
                    const totalFunding = funding?.totalFunding ?? project.cagnotteTotalAmount;
                    const totalCost = funding?.totalCost ?? project.cagnotteTargetAmount;
                    const displayName = project.name || untitled;
                    return (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center justify-between gap-3 w-full">
                          <div className="flex items-center gap-2">
                            {project.image && (
                              <img
                                src={project.image}
                                alt={displayName}
                                className="w-5 h-5 rounded object-cover"
                              />
                            )}
                            <span>{displayName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {totalFunding}€ / {totalCost}€
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Bouton "définir comme cagnotte principale" (icône + tooltip) */}
            {selectedProjectId && !isCurrentProjectModalId && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onSaveProjectModal}
                      disabled={isSavingProjectModal}
                      variant="secondary"
                      size="icon"
                      className="h-10 w-10"
                    >
                      {isSavingProjectModal ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("CagnotteDialog.labels.setAsMainCagnotte")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )
      ) : (
        <div className="py-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          <p>{t("CagnotteDialog.labels.noProjects")}</p>
        </div>
      )}
    </div>
  );
}
