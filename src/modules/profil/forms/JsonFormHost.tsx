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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import type { JsonFormModalConfig } from "@/types/site-schema";

import { GenericForm, configToDescriptor, type JsonFormConfig } from "@/modules/formEngine";
import { toJsonFormConfig } from "./legacyConfig";
import { runSubmit, buildConfigDefaults, type MeLike, type SubmitTarget } from "./jsonFormSubmit";
import "./validators"; // side-effect : enregistre addressValid/eventDatesValid pour les configs (validateFn)

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
  formConfig?: JsonFormConfig | JsonFormModalConfig;
}

export function JsonFormHost({ open, onOpenChange, parent, formConfig }: Props): ReactNode {
  const t = useT("modules/profil"); // résout clés i18n ET LocalizedString {fr,en,…}
  const { me } = useCocolight();
  const queryClient = useQueryClient();

  const config = useMemo(() => (formConfig ? toJsonFormConfig(formConfig) : null), [formConfig]);
  const descriptor = useMemo(() => (config ? configToDescriptor(config, { tLoc: (l) => t(l) }) : null), [config, t]);
  const defaultValues = useMemo(() => (config ? buildConfigDefaults(config) : {}), [config]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <GenericForm
          descriptor={descriptor}
          defaultValues={defaultValues as FieldValues}
          onSubmit={(v) => { void mutation.mutateAsync(v).catch(() => { /* toast émis par onError */ }); }}
          t={t}
          submitLabel={submitLabel}
          texts={{ next: "Suivant", previous: "Précédent", cancel: t("common.cancel") }}
          submitting={mutation.isPending}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export default JsonFormHost;
