/**
 * `EntityFormModal` — modale UNIQUE config-driven (add + edit) remplaçant les modales spécifiques par entité
 * (PoiEquipementGenericModal / TiersLieuxGenericModal / AddEntityGenericModals / EditProfileGenericModal).
 * Tout ce qui variait d'une modale à l'autre est porté par un `EntityModalConfig` (données + closures pour
 * les bouts RUNTIME : scope, defaults, schéma, slots, spec mutation). Le composant, lui, est 100 % générique :
 *  - RENDU  : `configToDescriptor(formDescriptorToConfig(config.descriptor))` → GenericForm ;
 *  - READ   : `config.buildDefaults({mode, entity, scope})` ;
 *  - WRITE  : `useEntityMutation(config.buildSpec({...}))` (cœur générique) ;
 *  - chrome / imageField / listsOptions / slots : déclarés dans la config.
 */
import { useMemo, type ReactNode } from "react";
import type { FieldValues } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";

import { GenericForm, configToDescriptor, formDescriptorToConfig, type FormDescriptor } from "@/modules/formEngine";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { useEntityMutation, type EntityMutationSpec } from "../hooks/useEntityMutation";

const KEEP_KEYS = (l: unknown) => (typeof l === "string" ? l : ((l as { fr?: string })?.fr ?? "")); // labels = clés i18n → GenericForm les résout

/** Contexte runtime passé aux closures de la config (scope/parent/entité/mode/me). */
export interface EntityModalCtx {
  mode: "add" | "edit";
  /** edit : l'entité éditée ; add : null. */
  entity?: EntityTypes | null;
  /** add : entité parente éventuelle. */
  parent?: EntityTypes | null;
  /** scope costum résolu (config.resolveScope). */
  scope?: unknown;
  /** utilisateur connecté. */
  me?: EntityTypes | null;
  /** entité PORTEUSE du costum (useCocolight().entity = VITE_SLUG). */
  carrier?: EntityTypes | null;
  /** contexte costum du site (useSite().config.costum) — tags mainTag/compagnon (tiers-lieu). */
  costum?: unknown;
}

/** Config déclarative d'une entité/costum — élimine sa modale spécifique. */
export interface EntityModalConfig {
  /** Descripteur UNIFIÉ (render + read/write). Passé par la config au round-trip → rendu config-driven. */
  descriptor: FormDescriptor;
  // ── chrome ──
  title: { add: string; edit: string };
  description?: { add?: string; edit?: string };
  submitLabel?: { add: string; edit: string };
  icon?: string;
  gradientHeader?: boolean;
  dialogClassName?: string;
  validationFailedKey?: string;
  /** libellés de navigation (wizard) — reçoit `t`. */
  texts?: (t: (k: string, ...a: unknown[]) => string) => { next: string; previous: string; cancel: string; stepLabel?: (i: number, n: number) => string };
  // ── validation externe optionnelle (ex. getProfileSchema) ──
  getSchema?: () => z.ZodTypeAny;
  // ── read ──
  buildDefaults: (ctx: EntityModalCtx) => FieldValues;
  // ── image ──
  imageField?: string;
  imageExistingUrl?: (entity: EntityTypes) => string | undefined;
  // ── options runtime (selects) ──
  listsFromCarrier?: boolean;
  // ── scope costum ──
  resolveScope?: (carrier: EntityTypes | null | undefined) => unknown;
  // ── slots (UI custom : doublons/parentInfo) ──
  slots?: (ctx: EntityModalCtx) => Record<string, ReactNode>;
  // ── nettoyage des valeurs avant submit (ex. URLs vides) ──
  cleanValues?: (values: FieldValues) => FieldValues;
  // ── WRITE : construit le spec useEntityMutation (mode-aware, runtime). ──
  buildSpec: (ctx: EntityModalCtx) => EntityMutationSpec;
}

export interface EntityFormModalProps {
  config: EntityModalConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "add" | "edit";
  entity?: EntityTypes | null;
  parent?: EntityTypes | null;
}

export function EntityFormModal({ config, open, onOpenChange, mode = "add", entity, parent }: EntityFormModalProps): ReactNode {
  const t = useT("modules/profil");
  const tr = (k: string) => t(k);
  const { me, entity: carrier } = useCocolight();
  const { config: siteConfig } = useSite();
  const isEdit = mode === "edit" && Boolean(entity);
  const effMode: "add" | "edit" = isEdit ? "edit" : "add";

  const scope = useMemo(() => config.resolveScope?.(carrier), [config, carrier]);
  const ctx: EntityModalCtx = { mode: effMode, entity: entity ?? null, parent: parent ?? null, scope, me, carrier, costum: siteConfig.costum };

  const descriptor = useMemo(() => configToDescriptor(formDescriptorToConfig(config.descriptor), { tLoc: KEEP_KEYS }), [config]);
  const defaultValues = useMemo(() => config.buildDefaults(ctx), [config, effMode, entity, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const schema = useMemo(() => config.getSchema?.(), [config]);
  const listsOptions = config.listsFromCarrier ? ((carrier?.serverData?.lists as Record<string, string[]> | undefined) ?? {}) : undefined;
  const fieldProps = useMemo(() => {
    if (!isEdit || !config.imageField || !config.imageExistingUrl || !entity) return undefined;
    const url = config.imageExistingUrl(entity);
    return url ? { [config.imageField]: { existingUrl: url } } : undefined;
  }, [isEdit, entity, config]);
  const slots = useMemo(() => config.slots?.(ctx), [config, effMode, entity, parent, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useEntityMutation(config.buildSpec(ctx));
  const guard = useUnsavedGuard(onOpenChange);

  const onSubmit = async (values: FieldValues) => {
    const cleaned = config.cleanValues ? config.cleanValues(values) : values;
    await mutation.mutateAsync(cleaned as Record<string, unknown>);
    onOpenChange(false);
  };

  const titleKey = isEdit ? config.title.edit : config.title.add;
  const descKey = isEdit ? config.description?.edit : config.description?.add;
  const submitLabel = config.submitLabel
    ? (isEdit ? config.submitLabel.edit : config.submitLabel.add)
    : (isEdit ? "ProfileEdit.save" : "AddEntity.create");
  const texts = config.texts?.(t as never) ?? { next: "", previous: "", cancel: tr("common.cancel") };

  return (
    <>
      <Dialog open={open} onOpenChange={guard.guardedOpenChange}>
        <DialogContent className={config.dialogClassName ?? "sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"}>
          <DialogHeader className={`px-6 pt-6${config.gradientHeader ? " pb-3 bg-primary/5" : ""}`}>
            <div className="flex items-center gap-3">
              {config.icon && (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <DynamicIcon name={config.icon as IconName} className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0">
                <DialogTitle>{tr(titleKey)}</DialogTitle>
                {descKey
                  ? <DialogDescription>{tr(descKey)}</DialogDescription>
                  : <DialogDescription className="sr-only">{tr(titleKey)}</DialogDescription>}
              </div>
            </div>
          </DialogHeader>
          <GenericForm
            key={entity?.slug ?? "add"}
            descriptor={descriptor}
            schema={schema}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            onInvalid={config.validationFailedKey ? () => toast.error(tr(config.validationFailedKey as string)) : undefined}
            t={tr}
            submitLabel={tr(submitLabel)}
            texts={texts}
            submitting={mutation.isPending}
            onDirtyChange={guard.setDirty}
            onCancel={() => guard.guardedOpenChange(false)}
            listsOptions={listsOptions}
            fieldProps={fieldProps}
            slots={slots}
          />
        </DialogContent>
      </Dialog>
      {guard.confirmDialog}
    </>
  );
}

export default EntityFormModal;
