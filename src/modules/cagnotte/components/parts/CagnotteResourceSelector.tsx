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
import {CagnotteResource, CagnotteTypeConfig} from "@/modules/cagnotte/types.ts";

interface CagnotteResourceSelectorProps {
  /** Entité orga courante. Si `null` → affiche un placeholder "no organization". */
  hasEntity: boolean;
  /** `true` tant que la liste des projets se charge. */
  isLoading: boolean;
  /** Liste des projets typés. */
  resources: CagnotteResource[];
  /** Projet actuellement sélectionné (peut être `undefined` au mount). */
  selectedResource: CagnotteResource | undefined;
  /** Id du projet sélectionné (state controlled). */
  selectedResourceId: string;
  /** Callback pour changer le projet/proposition sélectionné. */
  onSelectedResourceIdChange: (id: string) => void;
  /** Si `true` → mode read-only (pas de select, juste affichage du projet). */
  hideResourceSelect: boolean;
  /** Map resourceId → montants agrégés. */
  fundingByResourceId: Map<string, { totalFunding: number; totalCost: number }>;
  /** `true` si le projet/proposition sélectionné est déjà le resourceModalId courant → cache le bouton save. */
  isCurrentResourceModalId: boolean;
  /** `true` pendant la sauvegarde "main cagnotte". */
  isSavingResourceModal: boolean;
  /** Callback déclenché par le bouton "definir comme cagnotte principale". */
  onSaveResourceModal: () => void;
  /** Configuration de la cagnotte */
  cagnotteConfig: CagnotteTypeConfig;
  /** Pour personalisation des textes à afficher pour certain groupe d'organisation */
  context: string;
}

/**
 * Sélecteur de projet pour le `CagnotteDialog`.
 *
 * Gère 4 états visuels :
 *  1. Pas d'entité → message "aucune organisation".
 *  2. Loading → spinner + label.
 *  3. Projets/Propositions chargés + `hideResourceSelect` → affichage read-only du projet.
 *  4. Projets/Propositions chargés + select interactif → dropdown + bouton "main cagnotte".
 */
export function CagnotteResourceSelector({
  hasEntity,
  isLoading,
  resources,
  selectedResource,
  selectedResourceId,
  onSelectedResourceIdChange,
  hideResourceSelect,
  fundingByResourceId,
  isCurrentResourceModalId,
  isSavingResourceModal,
  onSaveResourceModal,
  cagnotteConfig,
  context
}: CagnotteResourceSelectorProps) {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const untitled = String(t("CagnotteDialog.fallbacks.untitled", undefined, { context: cagnotteConfig.selectorType+context }));

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-primary" />
        <Label className="text-sm font-medium text-foreground">
          {hideResourceSelect
            ? t("CagnotteDialog.labels.supportedResource", undefined, { context: cagnotteConfig.selectorType+context })
            : t("CagnotteDialog.labels.selectResource", undefined, { context: cagnotteConfig.selectorType+context })}
        </Label>
      </div>

      {!hasEntity ? (
        <div className="py-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          <p>{t("CagnotteDialog.labels.noOrganization", undefined, { context: cagnotteConfig.selectorType+context })}</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t("CagnotteDialog.labels.loadingResources", undefined, { context: cagnotteConfig.selectorType+context })}</span>
        </div>
      ) : resources.length > 0 ? (
        hideResourceSelect ? (
          <div className="h-10 rounded-md border bg-muted/20 px-3 flex items-center gap-2">
            {selectedResource?.image ? (
              <img
                src={selectedResource.image}
                alt={selectedResource.name || untitled}
                className="w-5 h-5 rounded object-cover"
              />
            ) : null}
            <span className="text-sm font-medium truncate">
              {selectedResource?.name || untitled}
            </span>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select value={selectedResourceId} onValueChange={onSelectedResourceIdChange}>
                <SelectTrigger className="h-10">
                  {selectedResource ? (
                    <div className="flex items-center gap-2">
                      {selectedResource.image && (
                        <img
                          src={selectedResource.image}
                          alt={selectedResource.name || untitled}
                          className="w-5 h-5 rounded object-cover"
                        />
                      )}
                      <span className="truncate block">{selectedResource.name || untitled}</span>
                    </div>
                  ) : (
                    <SelectValue
                      placeholder={String(t("CagnotteDialog.labels.selectResourcePlaceholder", undefined, { context: cagnotteConfig.selectorType+context }))}
                    />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {resources.map((resource) => {
                    if (!resource.id) return null;
                    const funding = fundingByResourceId.get(resource.id);
                    const totalFunding = funding?.totalFunding ?? resource.resourceFinancedAmount;
                    const totalCost = funding?.totalCost ?? resource.resourceTotalAmount;
                    const displayName = resource.name || untitled;
                    return (
                      <SelectItem key={resource.id} value={resource.id}>
                        <div className="flex items-center justify-between gap-3 w-full">
                          <div className="flex items-center gap-2">
                            {resource.image && (
                              <img
                                src={resource.image}
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
            {selectedResourceId && !isCurrentResourceModalId && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onSaveResourceModal}
                      disabled={isSavingResourceModal}
                      variant="secondary"
                      size="icon"
                      className="h-10 w-10"
                    >
                      {isSavingResourceModal ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("CagnotteDialog.labels.setAsMainCagnotte", undefined, { context: cagnotteConfig.selectorType+context })}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )
      ) : (
        <div className="py-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          <p>{t("CagnotteDialog.labels.noResource", undefined, { context: cagnotteConfig.selectorType+context })}</p>
        </div>
      )}
    </div>
  );
}
