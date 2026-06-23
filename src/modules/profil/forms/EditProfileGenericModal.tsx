/**
 * Édition de profil — ROUTER par entité. Les entités MIGRÉES (EDIT_DESCRIPTORS) passent par le moteur
 * générique (descripteur plat par entité) ; les autres tombent sur l'ancien EditProfileModal (fallback)
 * → migration incrémentale sûre. Réutilise tels quels : READ (useProfileFormData), WRITE (useUpdateProfile),
 * SCHÉMA (getProfileSchema, via `schema`), mapping write (buildProfileUpdateData), composites (location/social).
 */
import { useMemo, type ReactNode } from "react";
import type { FieldValues } from "react-hook-form";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";

import { GenericForm, configToDescriptor, formDescriptorToConfig, type FormDescriptor } from "@/modules/formEngine";
import { getProfileSchema } from "../schemaForm";
import { useProfileFormData } from "../hooks/useProfileFormData";
import { useUpdateProfile } from "../hooks/useProfileMutations";
import { EditProfileModal } from "../components/profile-edit/EditProfileModal";
import { buildProfileUpdateData } from "./editProfilePayload";
import { EDIT_DESCRIPTORS } from "./editProfile.descriptor";
import { useUnsavedGuard } from "./useUnsavedGuard";

interface Props {
  entity: EntityTypes;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Modal d'édition générique pour UNE entité migrée (descripteur + schéma de l'entité). */
function EditEntityModal({ entity, open, onOpenChange, descriptor, entityType }: Props & { descriptor: FormDescriptor; entityType: string }): ReactNode {
  const t = useT("modules/profil");
  const tr = (k: string) => t(k);
  const { defaultValues } = useProfileFormData(entity);
  const update = useUpdateProfile(entity);
  const schema = useMemo(() => getProfileSchema(entityType), [entityType]);
  // CONFIG-DRIVEN : rendu via le descripteur issu de la config (round-trip identique → rendu + `validate`
  // clé préservés). Labels gardés = clés i18n. READ/WRITE passent déjà par la config (PROFIL_SPECS).
  const renderDescriptor = useMemo(
    () => configToDescriptor(formDescriptorToConfig(descriptor), { tLoc: (l) => (typeof l === "string" ? l : ((l as { fr?: string })?.fr ?? "")) }),
    [descriptor],
  );
  // events : filtre runtime du finder `parent` (sous-événement) = events organisés par le parent de l'entité.
  const fieldProps = useMemo(() => {
    if (entityType !== "events") return undefined;
    const pid = (entity as { parent?: { id?: string } }).parent?.id;
    return pid ? { parent: { filters: { filters: { [`organizer.${pid}`]: { $exists: true } } } } } : undefined;
  }, [entityType, entity]);

  const onSubmit = async (values: FieldValues) => {
    const updateData = buildProfileUpdateData(entityType, values as Record<string, unknown>);
    const oldSlug = entity.slug;
    const newSlug = values.slug as string | undefined;
    try {
      await update.mutateAsync(updateData);
      onOpenChange(false);
      // Slug changé → recharger sur la nouvelle URL (effet hors moteur, comme l'ancien modal).
      if (newSlug && newSlug !== oldSlug && typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname.replace(oldSlug, newSlug));
        window.location.reload();
      }
    } catch { /* toast émis par useUpdateProfile */ }
  };

  const guard = useUnsavedGuard(onOpenChange);

  return (
    <>
    <Dialog open={open} onOpenChange={guard.guardedOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{tr("ProfileEdit.title")}</DialogTitle>
          <DialogDescription className="sr-only">{tr("ProfileEdit.title")}</DialogDescription>
        </DialogHeader>
        {defaultValues && (
          <GenericForm
            key={entity.slug}
            descriptor={renderDescriptor}
            schema={schema}
            defaultValues={defaultValues as FieldValues}
            onSubmit={onSubmit}
            t={tr}
            submitLabel={tr("ProfileEdit.save")}
            texts={{ next: "", previous: "", cancel: tr("ProfileEdit.cancel") }}
            submitting={update.isPending}
            onDirtyChange={guard.setDirty}
            onCancel={() => guard.guardedOpenChange(false)}
            fieldProps={fieldProps}
          />
        )}
      </DialogContent>
    </Dialog>
    {guard.confirmDialog}
    </>
  );
}

/** Choisit le moteur générique (entité migrée) ou l'ancien EditProfileModal (fallback). */
export function EditProfileGenericModal({ entity, open, onOpenChange }: Props): ReactNode {
  const entityType = typeof entity.getEntityType === "function" ? entity.getEntityType() : "citoyens";
  const descriptor = entityType ? EDIT_DESCRIPTORS[entityType] : undefined;
  if (!descriptor) {
    return <EditProfileModal entity={entity} open={open} onOpenChange={onOpenChange} />;
  }
  return <EditEntityModal entity={entity} open={open} onOpenChange={onOpenChange} descriptor={descriptor} entityType={entityType} />;
}

export default EditProfileGenericModal;
