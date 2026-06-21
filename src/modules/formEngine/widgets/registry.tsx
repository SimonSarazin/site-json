/**
 * WidgetRegistry (§4 du design) : `WidgetKind` → composant de champ.
 * Extensible : `registerWidget(kind, comp)` pour ajouter un widget.
 *
 * Les `FormField*` du repo prennent `control` (Controller interne) et doivent vivre sous
 * `<Form {...form}>` (FormProvider, assuré par GenericForm). Les composites contrôlés
 * (ImageUploadField, EditLocationTab, SelectParent) sont bridgés via le form/Controller.
 */
import { lazy, Suspense, type ReactElement } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import {
  FormFieldText, FormFieldNumber, FormFieldSwitch, FormFieldCheckbox, FormFieldDate,
  FormFieldSelectObject, FormFieldCheckboxGroup,
} from "@/modules/profil/components/profile-edit/fields/genericFields";
import { TextareaFormField } from "@/modules/profil/components/profile-edit/fields/TextareaFormField";
import { IconFormField } from "@/modules/profil/components/profile-edit/fields/IconFormField";
import { FormFieldTags } from "@/modules/profil/components/profile-edit/fields/FormFieldTags";
import { FormFieldUrlList } from "@/modules/profil/components/profile-edit/fields/FormFieldUrlList";
import { TranslatedFormMessage } from "@/modules/profil/components/profile-edit/fields/TranslatedFormMessage";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Mail, Phone } from "lucide-react";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import type { FieldArrayItem } from "./FieldArrayField";
import type { FieldDescriptor } from "../types";

/** Type de recherche du finder (aligné sur SelectParent / l'autocomplete lib). */
type FinderSearchType = NonNullable<GlobalAutocompleteCostumData["searchType"]>[number];
/** Valeur d'un finder = référence parent MongoDB `{ id: { type, name } }`. */
type FinderValue = Record<string, { type: string; name?: string }>;

// Widgets LOURDS chargés à la demande (code-split Vite) — EditLocationTab embarque l'API villes/rues,
// SelectParent l'autocomplete, EditEventDatesTab les pickers date/horaires, etc. Rendus sous <Suspense>.
const ImageUploadField = lazy(() => import("@/modules/profil/components/profile-edit/fields/ImageUploadField"));
const EditLocationTab = lazy(() => import("@/modules/profil/components/profile-edit/EditLocationTab").then((m) => ({ default: m.EditLocationTab })));
const SelectParent = lazy(() => import("@/modules/profil/components/profile-edit/fields/SelectParent").then((m) => ({ default: m.SelectParent })));
const EditEventDatesTab = lazy(() => import("@/modules/profil/components/profile-edit/EditEventDatesTab").then((m) => ({ default: m.EditEventDatesTab })));
const EditSocialTab = lazy(() => import("@/modules/profil/components/profile-edit/EditSocialTab").then((m) => ({ default: m.EditSocialTab })));
const EditScheduleTab = lazy(() => import("@/modules/profil/components/profile-edit/EditScheduleTab").then((m) => ({ default: m.EditScheduleTab })));
const OpeningHoursField = lazy(() => import("./OpeningHoursField"));
const FieldArrayField = lazy(() => import("./FieldArrayField"));

/** Placeholder le temps du chargement d'un widget lazy. */
const WidgetFallback = () => <div className="h-10 animate-pulse rounded-md bg-muted" />;

export interface WidgetProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  /** Traduction (clé i18n → texte). */
  t: (key: string) => string;
  /** Options résolues `{value,label}` (label déjà traduit) : depuis `field.enum` (value≠label) ou une
   *  source runtime string[] (ex. serverData.lists → value=label). */
  options: Array<{ value: string; label: string }>;
}

type WidgetComponent = (p: WidgetProps) => ReactElement | null;

const control = (form: UseFormReturn<FieldValues>) => form.control as Control<FieldValues>;
const fname = (n: string) => n as FieldPath<FieldValues>;
// Label vide (`field.label` falsy) → on ne passe rien (le composant masque alors le FormLabel) :
// permet un sous-champ sans label propre sous un titre de GROUPE (ex. mois/année sous « Date d'ouverture »).
const lbl = (p: WidgetProps) => (p.field.label ? p.t(p.field.label) : "");

const registry: Partial<Record<string, WidgetComponent>> = {
  hidden: () => null,

  // `widgetProps.inputType` (text|email|tel|url) → input HTML natif typé SANS icône (parité inputs plain).
  text: (p) => <FormFieldText control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    type={(p.field.widgetProps?.inputType as string) ?? "text"}
    required={p.field.required} placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    hint={p.field.info ? p.t(p.field.info) : undefined} />,

  email: (p) => <IconFormField control={control(p.form)} name={fname(p.field.name)} icon={Mail} type="email" label={lbl(p)}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined} />,

  tel: (p) => <IconFormField control={control(p.form)} name={fname(p.field.name)} icon={Phone} type="tel" label={lbl(p)} />,

  textarea: (p) => <TextareaFormField control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    required={p.field.required} placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    description={p.field.info ? p.t(p.field.info) : undefined}
    rows={(p.field.widgetProps?.rows as number) ?? 4} />,

  number: (p) => <FormFieldNumber control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} required={p.field.required}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined} />,

  switch: (p) => <FormFieldSwitch control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} />,

  checkbox: (p) => <FormFieldCheckbox control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} />,

  checkboxGroup: (p) => <FormFieldCheckboxGroup control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} options={p.options}
    variant={p.field.widgetProps?.variant as "plain" | "card" | undefined} />,

  select: (p) => <FormFieldSelectObject control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    required={p.field.required} options={p.options}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    placeholderSearch={p.field.placeholderSearch ? p.t(p.field.placeholderSearch) : undefined} />,

  selectFromLists: (p) => <FormFieldSelectObject control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    required={p.field.required} options={p.options}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    placeholderSearch={p.field.placeholderSearch ? p.t(p.field.placeholderSearch) : undefined} />,

  multiselect: (p) => <FormFieldSelectObject control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    required={p.field.required} multiple options={p.options}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    placeholderSearch={p.field.placeholderSearch ? p.t(p.field.placeholderSearch) : undefined} />,

  tags: (p) => <FormFieldTags control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    searchable={(p.field.widgetProps?.searchable as boolean) ?? true}
    extendedTexts={(p.field.widgetProps?.extendedTexts as boolean) ?? false} />,

  date: (p) => <FormFieldDate control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} required={p.field.required}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    hint={p.field.info ? p.t(p.field.info) : undefined}
    startYear={p.field.widgetProps?.startYear as number | undefined}
    endYear={p.field.widgetProps?.endYear as number | undefined} />,

  urlList: (p) => <FormFieldUrlList control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    addLabel={p.t((p.field.widgetProps?.addLabel as string) ?? "common.add")}
    removeLabel={p.t((p.field.widgetProps?.removeLabel as string) ?? "common.remove")} />,

  image: (p) => (
    <Suspense fallback={<WidgetFallback />}>
      <FormField control={control(p.form)} name={fname(p.field.name)} render={({ field }) => (
        <ImageUploadField
          value={(field.value as File | null) ?? null}
          onChange={(f) => { field.onChange(f); p.form.setValue(fname("_imageDeleted"), false); }}
          existingUrl={p.field.widgetProps?.existingUrl as string | undefined}
          existingDeleted={Boolean(p.form.watch(fname("_imageDeleted")))}
          onRemoveExisting={() => p.form.setValue(fname("_imageDeleted"), true)}
          aspect={(p.field.widgetProps?.aspect as number) ?? 1}
          shape={p.field.widgetProps?.shape as "square" | "circle" | undefined}
          label={lbl(p)}
          hint={p.field.info ? p.t(p.field.info) : undefined}
        />
      )} />
    </Suspense>
  ),

  // Composite : rend tout le bloc adresse (lit/écrit ~14 champs via le form).
  location: (p) => <Suspense fallback={<WidgetFallback />}><EditLocationTab form={p.form} /></Suspense>,

  // Composite : recherche/sélection d'une entité parente (référence `{id:{type,name}}`) via l'autocomplete.
  // widgetProps : searchTypes / multiple / includeMe ; `filters` runtime (ex. via fieldProps).
  finder: (p) => (
    <Suspense fallback={<WidgetFallback />}>
      <FormField control={control(p.form)} name={fname(p.field.name)} render={({ field }) => (
        <FormItem>
          {p.field.label && <FormLabel>{lbl(p)}</FormLabel>}
          <FormControl>
            <SelectParent
              value={field.value as FinderValue | undefined}
              onChange={field.onChange}
              placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
              searchTypes={p.field.widgetProps?.searchTypes as FinderSearchType[] | undefined}
              multiple={p.field.widgetProps?.multiple as boolean | undefined}
              includeMe={p.field.widgetProps?.includeMe as boolean | undefined}
              filters={p.field.widgetProps?.filters as Partial<GlobalAutocompleteCostumData> | undefined}
            />
          </FormControl>
          <TranslatedFormMessage />
        </FormItem>
      )} />
    </Suspense>
  ),

  // Composite : onglet dates/horaires d'événement (recurrency → startDate/endDate, sinon openingHours).
  eventDates: (p) => <Suspense fallback={<WidgetFallback />}><EditEventDatesTab form={p.form} /></Suspense>,

  // Composites edit-profil réutilisés (gèrent leurs champs via le form).
  editSocial: (p) => <Suspense fallback={<WidgetFallback />}><EditSocialTab form={p.form} /></Suspense>,
  editSchedule: (p) => <Suspense fallback={<WidgetFallback />}><EditScheduleTab form={p.form} /></Suspense>,

  // Composite : horaires d'ouverture par jour (`${name}.${jour}.{enabled,start,end}`).
  openingHours: (p) => (
    <Suspense fallback={<WidgetFallback />}>
      <OpeningHoursField form={p.form} name={p.field.name} label={lbl(p)} t={p.t}
        days={p.field.widgetProps?.days as string[] | undefined}
        dayLabelPrefix={p.field.widgetProps?.dayLabelPrefix as string | undefined} />
    </Suspense>
  ),

  // Composite : liste répétable d'objets (sous-champs déclarés dans widgetProps.itemFields).
  fieldArray: (p) => (
    <Suspense fallback={<WidgetFallback />}>
      <FieldArrayField form={p.form} name={p.field.name} label={lbl(p)}
        addLabel={p.t((p.field.widgetProps?.addLabel as string) ?? "common.add")}
        itemFields={resolveItemFields(p)} />
    </Suspense>
  ),
};

/** Résout les sous-champs d'un `fieldArray` (labels/placeholders/options traduits) depuis widgetProps. */
function resolveItemFields(p: WidgetProps): FieldArrayItem[] {
  const raw = (p.field.widgetProps?.itemFields as Array<Record<string, unknown>> | undefined) ?? [];
  return raw.map((f) => ({
    name: String(f.name),
    kind: f.kind === "select" ? "select" : "text",
    label: f.label ? p.t(String(f.label)) : undefined,
    placeholder: f.placeholder ? p.t(String(f.placeholder)) : undefined,
    options: Array.isArray(f.options)
      ? (f.options as Array<{ value: string; label: string }>).map((o) => ({ value: String(o.value), label: p.t(String(o.label)) }))
      : undefined,
  }));
}

export function registerWidget(kind: string, comp: WidgetComponent): void {
  registry[kind] = comp;
}

export function getWidget(kind: string): WidgetComponent {
  return registry[kind] ?? registry.text!;
}
