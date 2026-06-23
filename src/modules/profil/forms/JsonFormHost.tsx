/**
 * JsonFormHost — hôte des formulaires CONFIG-DRIVEN (remplaçant fonctionnel de JsonFormModal).
 * Accepte une config ANCIEN ou NOUVEAU format (normalisée via toJsonFormConfig), la convertit en
 * FormDescriptor (configToDescriptor) rendu par GenericForm, et soumet via le pipeline générique
 * (runSubmit : payload → presets → SDK scopé costum → save). cf. P2 de doc/formulaire-config-driven.md.
 */
import { useMemo, type ReactNode } from "react";
import type { FieldValues } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import type { JsonFormModalConfig } from "@/types/site-schema";

import { GenericForm, configToDescriptor, type JsonFormConfig, type EntityLike } from "@/modules/formEngine";
import { toJsonFormConfig } from "./legacyConfig";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { runSubmit, buildConfigDefaults, buildPipelineDefaults, isPipelineConfig, type MeLike, type SubmitTarget } from "./jsonFormSubmit";
import "./validators"; // side-effect : enregistre addressValid/eventDatesValid pour les configs (validateFn)

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
  formConfig?: JsonFormConfig | JsonFormModalConfig;
  /** Entité éditée (config-driven EDIT) : pré-remplit le form via le pipeline du descripteur (seedEntity). */
  entity?: EntityLike;
}

export function JsonFormHost({ open, onOpenChange, parent, formConfig, entity }: Props): ReactNode {
  const t = useT("modules/profil"); // résout clés i18n ET LocalizedString {fr,en,…}
  const { me } = useCocolight();
  const queryClient = useQueryClient();

  const config = useMemo(() => (formConfig ? toJsonFormConfig(formConfig) : null), [formConfig]);
  const descriptor = useMemo(() => (config ? configToDescriptor(config, { tLoc: (l) => t(l) }) : null), [config, t]);
  // READ : config UNIFIÉE → seedEntity (entity-aware, lit l'entité éditée) ; legacy → défauts par champ.
  const defaultValues = useMemo(
    () => (config ? (isPipelineConfig(config) ? buildPipelineDefaults(config, entity ?? null) : buildConfigDefaults(config)) : {}),
    [config, entity],
  );
  const guard = useUnsavedGuard(onOpenChange);

  const mutation = useMutation({
    mutationFn: async (values: FieldValues) => {
      if (!config || !me) throw new Error("config ou utilisateur manquant");
      return runSubmit(config, values as Record<string, unknown>, {
        me: me as unknown as MeLike,
        parent: (parent ?? null) as unknown as SubmitTarget | null,
      });
    },
    onSuccess: () => {
      toast.success(config?.submit?.successMessage ? t(config.submit.successMessage) : t("AddEntity.create"));
      void queryClient.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e) => {
      toast.error(config?.submit?.errorMessage ? t(config.submit.errorMessage) : t("toast.add.organizationError"));
      console.error("[JsonFormHost] submit error", e);
    },
  });

  if (!config || !descriptor) return null;

  const title = config.title ? t(config.title) : t("AddEntity.create");
  const submitLabel = config.submitLabel ? t(config.submitLabel) : t("AddEntity.create");
  const gradientHeader = (config.layout as { header?: string }).header === "gradient";

  return (
    <>
    <Dialog open={open} onOpenChange={guard.guardedOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className={`px-6 pt-6${gradientHeader ? " pb-3 bg-primary/5" : ""}`}>
          <div className="flex items-center gap-3">
            {config.icon && (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <DynamicIcon name={config.icon as IconName} className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="sr-only">{title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <GenericForm
          descriptor={descriptor}
          defaultValues={defaultValues as FieldValues}
          onSubmit={(v) => { void mutation.mutateAsync(v).catch(() => { /* toast émis par onError */ }); }}
          t={t}
          submitLabel={submitLabel}
          texts={{ next: "Suivant", previous: "Précédent", cancel: t("common.cancel") }}
          submitting={mutation.isPending}
          onDirtyChange={guard.setDirty}
          onCancel={() => guard.guardedOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
    {guard.confirmDialog}
    </>
  );
}

export default JsonFormHost;
