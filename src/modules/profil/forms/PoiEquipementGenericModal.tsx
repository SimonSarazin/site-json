/**
 * Modal POI équipement v2 — utilise le moteur générique `GenericForm` + le descripteur, à la place
 * du `PoiEquipementForm` codé en dur. Réutilise scope / defaults (read) / mutations (write) existants.
 * cf. doc/moteur-formulaire-generique.md §10 (étape 1).
 */
import { useMemo } from "react";
import type { FieldValues } from "react-hook-form";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { EntityTypes, Poi } from "@communecter/cocolight-api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants";

import { GenericForm } from "@/modules/formEngine";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { ParentInfoReadonly } from "../components/profile-edit/fields";
import { poiEquipementDescriptor } from "./poiEquipement.descriptor";
import { PoiEquipementDoublonsSlot } from "./PoiEquipementDoublonsSlot";
import { resolvePoiEquipementScope, createEmptyDefaults, buildEditDefaults, buildEditPatch,
  type PoiEquipementSubmitPayload, type PoiEquipementEditPayload } from "../components/add/poiEquipement";
import { useAddPoi, useUpdatePoi } from "../hooks/useAddMutations";
import type { AddPoiFormData } from "../schemaForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "add" | "edit";
  poi?: Poi | null;
  parent?: EntityTypes | null;
}

export function PoiEquipementGenericModal({ open, onOpenChange, mode = "add", poi, parent }: Props) {
  const t = useT("modules/profil");
  const tr = (key: string) => t(key);
  const queryClient = useQueryClient();
  const { entity } = useCocolight();
  const isEdit = mode === "edit" && Boolean(poi);

  const scope = useMemo(() => resolvePoiEquipementScope(entity), [entity]);
  const listsOptions = (entity?.serverData?.lists as Record<string, string[]> | undefined) ?? {};
  const defaults = useMemo<AddPoiFormData>(
    () => (isEdit ? buildEditDefaults(poi as Poi) : createEmptyDefaults(scope)),
    [isEdit, poi, scope],
  );
  const defaultValues = defaults as unknown as FieldValues;

  // Aperçu de l'image de profil existante en édition (parité ancien modal).
  const fieldProps = useMemo(() => {
    if (!isEdit) return undefined;
    const sd = (poi as Poi).serverData;
    const existingUrl = sd?.profilMediumImageUrl || sd?.profilImageUrl || sd?.profilThumbImageUrl || undefined;
    return existingUrl ? { _imageFile: { existingUrl } } : undefined;
  }, [isEdit, poi]);

  const addMutation = useAddPoi(parent, undefined, { navigateOnSuccess: false, costumSlug: scope.sourceKey });
  const updateMutation = useUpdatePoi(poi ?? null);
  const submitting = addMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: FieldValues) => {
    // Retire les URLs vides (entrées ajoutées non remplies) — parité ancien form.
    const cleaned = {
      ...values,
      urls: Array.isArray(values.urls)
        ? (values.urls as unknown[]).filter((u) => String(u ?? "").trim().length > 0)
        : values.urls,
    } as AddPoiFormData;
    if (isEdit) {
      // Patch partiel : seuls les champs modifiés (diff vs defaults). Évite la
      // reconstruction lossy de l'adresse + les dates re-sérialisées parasites
      // (cf. buildEditPatch — sinon Object.assign écraserait l'adresse serveur).
      const patch = buildEditPatch(cleaned, defaults);
      await updateMutation.mutateAsync(patch as PoiEquipementEditPayload);
    } else {
      await addMutation.mutateAsync(cleaned as unknown as PoiEquipementSubmitPayload);
    }
    // rafraîchir la recherche (liste équipements + détection doublons), comme l'ancien modal.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumStatic") }),
      queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX("poi-equipement-matches") }),
    ]);
    onOpenChange(false);
  };

  const guard = useUnsavedGuard(onOpenChange);

  return (
    <>
    <Dialog open={open} onOpenChange={guard.guardedOpenChange}>
      <DialogContent className="sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{isEdit ? tr("AddPoiEquipement.title.edit") : tr("AddPoiEquipement.title.add")}</DialogTitle>
          <DialogDescription>{isEdit ? tr("AddPoiEquipement.description.edit") : tr("AddPoiEquipement.description.add")}</DialogDescription>
        </DialogHeader>
        <GenericForm
            descriptor={poiEquipementDescriptor}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            onInvalid={() => toast.error(tr("AddPoiEquipement.validationFailed"))}
            t={tr}
            submitLabel={isEdit ? tr("ProfileEdit.save") : tr("AddEntity.create")}
            texts={{
              next: tr("AddPoiEquipement.buttons.next"),
              previous: tr("AddPoiEquipement.buttons.previous"),
              cancel: tr("common.cancel"),
              stepLabel: (index, total) => t("AddPoiEquipement.stepIndicator", undefined, { index, total }),
            }}
            submitting={submitting}
            onDirtyChange={guard.setDirty}
            onCancel={() => guard.guardedOpenChange(false)}
            listsOptions={listsOptions}
            fieldProps={fieldProps}
            slots={{
              parentInfo: <ParentInfoReadonly parent={parent ?? null} />,
              doublons: <PoiEquipementDoublonsSlot scope={scope} />,
            }}
          />
      </DialogContent>
    </Dialog>
    {guard.confirmDialog}
    </>
  );
}

export default PoiEquipementGenericModal;
