/**
 * Modal tiers-lieu v2 — moteur générique `GenericForm` + `tiersLieuDescriptor`, à la place du
 * `TiersLieuxForm` codé en dur. Réutilise tel quel le READ (`mapEntityToTiersLieuxValues`),
 * le WRITE (`buildTiersLieuxPayload` via `useAddTiersLieu`/`useEditTiersLieu`) et le scope costum
 * (lib `me.costum(slug).organization()`). cf. doc/moteur-formulaire-generique.md §10.
 */
import { useMemo } from "react";
import type { FieldValues } from "react-hook-form";
import { toast } from "sonner";
import type { EntityTypes, Organization } from "@communecter/cocolight-api-client";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";

import { GenericForm } from "@/modules/formEngine";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { useAddTiersLieu } from "../hooks/useAddMutations";
import { useEditTiersLieu } from "../hooks/useEditTiersLieu";
// CONFIG-DRIVEN : rendu via le descripteur issu de la config (tiersLieuConfigDescriptor) ; READ (mapEntity…)
// et WRITE (buildTiersLieuxPayload, via les mutations) passent déjà par ce même descripteur config-driven.
import { mapEntityToTiersLieuxValues, tiersLieuConfigDescriptor } from "../utils/tiersLieuxMapping";
import {
  getDefaultTiersLieuxValues,
  type TiersLieuxFormData,
  type TiersLieuxSubmitPayload,
} from "../utils/tiersLieux.schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "add" | "edit";
  organization?: Organization | null;
  parent?: EntityTypes | null;
}

export function TiersLieuxGenericModal({ open, onOpenChange, mode = "add", organization, parent }: Props) {
  const t = useT("modules/profil");
  const tr = (key: string) => t(key);
  const isEdit = mode === "edit" && Boolean(organization);

  const defaults = useMemo<TiersLieuxFormData>(
    () => (isEdit && organization ? mapEntityToTiersLieuxValues(organization) : getDefaultTiersLieuxValues()),
    [isEdit, organization],
  );

  // Aperçu du logo existant en édition (parité ancien modal) → widgetProps du champ image `_logoFile`.
  const fieldProps = useMemo(() => {
    if (!isEdit || !organization) return undefined;
    const sd = organization.serverData;
    const existingUrl = sd?.profilMediumImageUrl || sd?.profilImageUrl || sd?.profilThumbImageUrl || undefined;
    return existingUrl ? { _logoFile: { existingUrl } } : undefined;
  }, [isEdit, organization]);

  const addMutation = useAddTiersLieu(parent);
  const editMutation = useEditTiersLieu(organization ?? null);
  const submitting = addMutation.isPending || editMutation.isPending;

  const onSubmit = async (values: FieldValues) => {
    // Le moteur produit des valeurs plates (mêmes noms que TiersLieuxFormData). `_logoFile` est posé
    // par le widget image ; `_imageDeleted` (suppression du logo existant) est lu par useEditTiersLieu.
    const payload = {
      ...(values as unknown as TiersLieuxFormData),
      _logoFile: (values._logoFile as File | null) ?? null,
      _photoFiles: [],
    } as TiersLieuxSubmitPayload;
    if (isEdit) await editMutation.mutateAsync(payload);
    else await addMutation.mutateAsync(payload);
    onOpenChange(false);
  };

  const guard = useUnsavedGuard(onOpenChange);

  return (
    <>
    <Dialog open={open} onOpenChange={guard.guardedOpenChange}>
      <DialogContent className="sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Tint solide (le dégradé→transparent est porté par le header du layout) → bandeau continu, sans bande. */}
        <DialogHeader className="px-6 pt-6 pb-3 bg-primary/5">
          <div className="flex items-center gap-3">
            {tiersLieuConfigDescriptor.icon && (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <DynamicIcon name={tiersLieuConfigDescriptor.icon as IconName} className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0">
              <DialogTitle>{isEdit ? tr("EditTiersLieux.title") : tr("AddTiersLieux.title")}</DialogTitle>
              <DialogDescription className="sr-only">
                {isEdit ? tr("EditTiersLieux.title") : tr("AddTiersLieux.title")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <GenericForm
          descriptor={tiersLieuConfigDescriptor}
          defaultValues={defaults as unknown as FieldValues}
          onSubmit={onSubmit}
          onInvalid={() => toast.error(tr("AddTiersLieux.errors.validationFailed"))}
          t={tr}
          submitLabel={isEdit ? tr("EditTiersLieux.buttons.submit") : tr("AddTiersLieux.buttons.submit")}
          texts={{
            next: tr("AddTiersLieux.buttons.next"),
            previous: tr("AddTiersLieux.buttons.previous"),
            cancel: tr("AddTiersLieux.buttons.cancel"),
            stepLabel: (index, total) => `${tr("AddTiersLieux.step")} ${index} ${tr("AddTiersLieux.stepOf")} ${total}`,
          }}
          submitting={submitting}
          onDirtyChange={guard.setDirty}
          onCancel={() => guard.guardedOpenChange(false)}
          fieldProps={fieldProps}
        />
      </DialogContent>
    </Dialog>
    {guard.confirmDialog}
    </>
  );
}

export default TiersLieuxGenericModal;
