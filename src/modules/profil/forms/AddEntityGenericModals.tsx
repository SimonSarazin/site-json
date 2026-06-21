/**
 * Modals « Ajouter <entité> » v2 (poi / projet / organisation / événement) — moteur générique
 * GenericForm + descripteurs, à la place des AddPoiModal / AddProjectModal / AddOrganizationModal /
 * AddEventModal codés main. Réutilisent tels quels les hooks d'écriture (useAddPoi/Project/Organization/
 * Event) : onSubmit ne fait que leur passer les valeurs plates produites par le moteur. Layout tabs.
 */
import { useMemo, type ReactNode } from "react";
import type { FieldValues } from "react-hook-form";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";

import { GenericForm, type FormDescriptor } from "@/modules/formEngine";
import { ParentInfoReadonly } from "../components/profile-edit/fields";
import { useAddPoi, useAddProject, useAddOrganization, useAddEvent } from "../hooks/useAddMutations";
import type { AddPoiFormData, AddProjectFormData, AddOrganizationFormData, AddEventFormData } from "../schemaForm";
import { addPoiDescriptor } from "./addPoi.descriptor";
import { addProjectDescriptor } from "./addProject.descriptor";
import { addOrganizationDescriptor } from "./addOrganization.descriptor";
import { buildAddEventDescriptor } from "./addEvent.descriptor";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

// Valeurs par défaut reprises à l'identique des anciens modals (les champs sans UI — preferences/geo —
// y restent pour transiter inchangés jusqu'au hook d'écriture). cf. anciens Add*Modal.
const POI_DEFAULTS: FieldValues = {
  name: "", type: "place", description: "", tags: [],
  addressCountry: "", addressLocality: "", localityId: "", postalCode: "", streetAddress: "",
};
const PROJECT_DEFAULTS: FieldValues = {
  name: "", shortDescription: "", public: true, url: "", tags: [],
  preferences: { isOpenData: false, isOpenEdition: false, crowdfunding: true },
  addressCountry: "", addressLocality: "", localityId: "", postalCode: "", streetAddress: "",
};
const ORG_DEFAULTS: FieldValues = {
  name: "", type: "NGO", role: "admin", shortDescription: "", email: undefined, url: "", tags: [],
  addressCountry: "", addressLocality: "", localityId: "", postalCode: "", streetAddress: "",
};

/** Présentation partagée : Dialog + GenericForm (layout tabs). slots/fieldProps fournis par le wrapper. */
function AddEntityGenericModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descriptor: FormDescriptor;
  defaultValues: FieldValues;
  titleKey: string;
  descKey: string;
  submitting: boolean;
  onSubmit: (values: FieldValues) => Promise<void>;
  slots?: Record<string, ReactNode>;
  fieldProps?: Record<string, Record<string, unknown>>;
}): ReactNode {
  const t = useT("modules/profil");
  const tr = (k: string) => t(k);
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{tr(props.titleKey)}</DialogTitle>
          <DialogDescription>{tr(props.descKey)}</DialogDescription>
        </DialogHeader>
        <GenericForm
          descriptor={props.descriptor}
          defaultValues={props.defaultValues}
          onSubmit={props.onSubmit}
          t={tr}
          submitLabel={tr("AddEntity.create")}
          texts={{ next: "", previous: "", cancel: tr("common.cancel") }}
          submitting={props.submitting}
          onCancel={() => props.onOpenChange(false)}
          slots={props.slots}
          fieldProps={props.fieldProps}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Slot « parent en lecture seule » (info tab des add modals). */
const parentSlot = (parent?: EntityTypes | null, labelKey?: string): Record<string, ReactNode> =>
  ({ parentInfo: <ParentInfoReadonly parent={parent ?? null} />, organizerInfo: <ParentInfoReadonly parent={parent ?? null} labelKey={labelKey} /> });

export function AddPoiGenericModal({ open, onOpenChange, parent }: ModalProps): ReactNode {
  const m = useAddPoi(parent);
  const onSubmit = async (values: FieldValues) => {
    try { await m.mutateAsync(values as AddPoiFormData); onOpenChange(false); } catch { /* toast émis par le hook */ }
  };
  return <AddEntityGenericModal open={open} onOpenChange={onOpenChange}
    descriptor={addPoiDescriptor} defaultValues={POI_DEFAULTS}
    titleKey="AddEntity.modal.poi.title" descKey="AddEntity.modal.poi.description"
    submitting={m.isPending} onSubmit={onSubmit} slots={parentSlot(parent)} />;
}

export function AddProjectGenericModal({ open, onOpenChange, parent }: ModalProps): ReactNode {
  const m = useAddProject(parent);
  const onSubmit = async (values: FieldValues) => {
    try { await m.mutateAsync(values as AddProjectFormData); onOpenChange(false); } catch { /* toast émis par le hook */ }
  };
  return <AddEntityGenericModal open={open} onOpenChange={onOpenChange}
    descriptor={addProjectDescriptor} defaultValues={PROJECT_DEFAULTS}
    titleKey="AddEntity.modal.project.title" descKey="AddEntity.modal.project.description"
    submitting={m.isPending} onSubmit={onSubmit} slots={parentSlot(parent)} />;
}

export function AddOrganizationGenericModal({ open, onOpenChange, parent }: ModalProps): ReactNode {
  const m = useAddOrganization();
  const onSubmit = async (values: FieldValues) => {
    try { await m.mutateAsync(values as AddOrganizationFormData); onOpenChange(false); } catch { /* toast émis par le hook */ }
  };
  return <AddEntityGenericModal open={open} onOpenChange={onOpenChange}
    descriptor={addOrganizationDescriptor} defaultValues={ORG_DEFAULTS}
    titleKey="AddEntity.modal.organization.title" descKey="AddEntity.modal.organization.description"
    submitting={m.isPending} onSubmit={onSubmit} slots={parentSlot(parent)} />;
}

export function AddEventGenericModal({ open, onOpenChange, parent }: ModalProps): ReactNode {
  const m = useAddEvent(parent);
  // Descripteur dépendant du parent (validation organizer) + defaults runtime (organizer hérité du parent).
  const descriptor = useMemo(() => buildAddEventDescriptor(Boolean(parent)), [parent]);
  const defaultValues = useMemo<FieldValues>(() => ({
    name: "", type: "meeting", shortDescription: "", url: "", tags: [], public: true,
    recurrency: false, startDate: undefined, endDate: undefined, openingHours: undefined,
    organizer: parent?.id
      ? { [parent.id]: { type: parent.getEntityType?.() || "organizations", name: parent.serverData?.name } }
      : undefined,
    addressCountry: "", addressLocality: "", localityId: "", postalCode: "", streetAddress: "", parent: undefined,
  }), [parent]);
  // Filtre runtime du finder sous-événement : events organisés par le parent.
  const fieldProps = useMemo(() => (
    parent?.id ? { parent: { filters: { filters: { [`organizer.${parent.id}`]: { $exists: true } } } } } : undefined
  ), [parent?.id]);

  const onSubmit = async (values: FieldValues) => {
    try { await m.mutateAsync(values as AddEventFormData); onOpenChange(false); } catch { /* toast émis par le hook */ }
  };
  return <AddEntityGenericModal open={open} onOpenChange={onOpenChange}
    descriptor={descriptor} defaultValues={defaultValues}
    titleKey="AddEntity.modal.event.title" descKey="AddEntity.modal.event.description"
    submitting={m.isPending} onSubmit={onSubmit}
    slots={parentSlot(parent, "ProfileEdit.fields.organizer.label")} fieldProps={fieldProps} />;
}
