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

import { GenericForm, configToDescriptor, formDescriptorToConfig, type FormDescriptor, type I18n } from "@/modules/formEngine";
import "./registerWidgets"; // side-effect : enregistre les widgets DOMAINE (location/finder/tags/image/…) AVANT le 1er rendu
import "./registerSpecFns"; // side-effect : enregistre descripteurs + fns costum (par clé) AVANT le 1er rendu d'une spec
import { useUnsavedGuard } from "./useUnsavedGuard";
import { useEntityMutation, type EntityMutationSpec } from "../hooks/useEntityMutation";
import { specToConfig } from "./resolveModalSpec";
import type { EntityModalCtx, EntityModalSpec } from "./entityModalSpec";

export type { EntityModalCtx };

// tLoc PRÉSERVANT : on garde le LocalizedString inline TEL QUEL (au lieu de l'aplatir en `.fr`) → il atteint le
// widget où `useT`/`tr` le résout locale-aware (EN/FR). Les clés string sont déjà passées telles quelles par
// resolveLabel. Ainsi un label `{fr,en}` du schéma costum bascule de langue ; une clé reste résolue par i18next.
const PRESERVE_LABELS = (l: I18n): I18n => l;

/** Config déclarative d'une entité/costum — élimine sa modale spécifique. */
export interface EntityModalConfig {
  /** Descripteur UNIFIÉ (render + read/write), ou résolveur runtime (ex. event : factory selon le parent ;
   *  edit profil : EDIT_DESCRIPTORS[entityType]). Passé au round-trip → rendu config-driven. */
  descriptor: FormDescriptor | ((ctx: EntityModalCtx) => FormDescriptor);
  /** widgetProps runtime par champ (ex. filtre du finder `parent` event). Fusionnés au fieldProps image. */
  buildFieldProps?: (ctx: EntityModalCtx) => Record<string, Record<string, unknown>> | undefined;
  /** effet de bord après submit réussi (ex. reload au changement de slug en édition profil). */
  afterSubmit?: (ctx: EntityModalCtx, values: FieldValues) => void;
  // ── chrome ── libellés = clé i18n string OU LocalizedString inline {fr,en} (résolus par `tr`/useT au rendu).
  title: { add: I18n; edit: I18n };
  description?: { add?: I18n; edit?: I18n };
  submitLabel?: { add: I18n; edit: I18n };
  icon?: string;
  gradientHeader?: boolean;
  dialogClassName?: string;
  validationFailedKey?: I18n;
  /** libellés de navigation (wizard) — reçoit `t` (résout clé i18n OU LocalizedString). */
  texts?: (t: (k: I18n, ...a: unknown[]) => string) => { next: string; previous: string; cancel: string; stepLabel?: (i: number, n: number) => string };
  // ── validation externe optionnelle (ex. getProfileSchema(entityType)) ──
  getSchema?: (ctx: EntityModalCtx) => z.ZodTypeAny;
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
  /** Config TS (entités standard — transitoire) OU `spec` sérialisable (costum — cible). L'une des deux requise. */
  config?: EntityModalConfig;
  /** Spec déclarative sérialisable ; compilée en EntityModalConfig via `specToConfig`. */
  spec?: EntityModalSpec;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "add" | "edit";
  entity?: EntityTypes | null;
  parent?: EntityTypes | null;
}

export function EntityFormModal({ config: configProp, spec, open, onOpenChange, mode = "add", entity, parent }: EntityFormModalProps): ReactNode {
  const config = useMemo(() => configProp ?? specToConfig(spec as EntityModalSpec), [configProp, spec]);
  const t = useT("modules/profil");
  const tr = (k: I18n) => t(k); // résout clé i18n OU LocalizedString inline (useT route selon le type)
  const { me, entity: carrier } = useCocolight();
  const { config: siteConfig } = useSite();
  const isEdit = mode === "edit" && Boolean(entity);
  const effMode: "add" | "edit" = isEdit ? "edit" : "add";

  const scope = useMemo(() => config.resolveScope?.(carrier), [config, carrier]);
  const ctx: EntityModalCtx = { mode: effMode, entity: entity ?? null, parent: parent ?? null, scope, me, carrier, costum: siteConfig.costum };

  const rawDescriptor = typeof config.descriptor === "function" ? config.descriptor(ctx) : config.descriptor;
  const descriptor = useMemo(() => configToDescriptor(formDescriptorToConfig(rawDescriptor), { tLoc: PRESERVE_LABELS }), [rawDescriptor]);
  const defaultValues = useMemo(() => config.buildDefaults(ctx), [config, effMode, entity, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const schema = useMemo(() => config.getSchema?.(ctx), [config, effMode, entity]); // eslint-disable-line react-hooks/exhaustive-deps
  const listsOptions = config.listsFromCarrier ? ((carrier?.serverData?.lists as Record<string, string[]> | undefined) ?? {}) : undefined;
  const fieldProps = useMemo(() => {
    const fromConfig = config.buildFieldProps?.(ctx);
    let image: Record<string, Record<string, unknown>> | undefined;
    if (isEdit && config.imageField && config.imageExistingUrl && entity) {
      const url = config.imageExistingUrl(entity);
      if (url) image = { [config.imageField]: { existingUrl: url } };
    }
    if (!fromConfig && !image) return undefined;
    return { ...fromConfig, ...image };
  }, [isEdit, entity, config, parent, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const slots = useMemo(() => config.slots?.(ctx), [config, effMode, entity, parent, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useEntityMutation(config.buildSpec(ctx));
  const guard = useUnsavedGuard(onOpenChange);

  const onSubmit = async (values: FieldValues) => {
    const cleaned = config.cleanValues ? config.cleanValues(values) : values;
    await mutation.mutateAsync(cleaned as Record<string, unknown>);
    config.afterSubmit?.(ctx, cleaned);
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
            onInvalid={config.validationFailedKey ? () => toast.error(tr(config.validationFailedKey!)) : undefined}
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
