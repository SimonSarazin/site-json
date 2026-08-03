/**
 * WidgetRegistry (§4 du design) : `WidgetKind` → composant de champ. LEAF : ce module n'importe QUE des
 * widgets GÉNÉRIQUES (locaux à formEngine) — AUCUN import de profil/SDK/app-métier.
 *
 * Les widgets DOMAINE (location/finder/eventDates/editSocial/editSchedule/tags/image/email/tel — couplés
 * SDK/useCocolight/i18n profil) sont ENREGISTRÉS depuis profil via `registerWidget(kind, comp)` au démarrage
 * (cf. `profil/forms/registerWidgets.tsx`, importé en side-effect par EntityFormModal). Le registre est donc
 * rempli en 2 temps : génériques ici (au chargement), domaine injectés par profil (inversion de dépendance).
 */
import { lazy, Suspense, type ReactElement } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import {
  FormFieldText, FormFieldNumber, FormFieldSwitch, FormFieldCheckbox, FormFieldDate,
  FormFieldSelectObject, FormFieldCheckboxGroup,
} from "./fields/genericFields";
import { TextareaFormField } from "./fields/TextareaFormField";
import { FormFieldUrlList } from "./fields/FormFieldUrlList";
import type { FieldArrayItem } from "./FieldArrayField";
import type { FieldDescriptor, I18n } from "../types";

const OpeningHoursField = lazy(() => import("./OpeningHoursField"));
const FieldArrayField = lazy(() => import("./FieldArrayField"));

/** Placeholder le temps du chargement d'un widget lazy. */
import { WidgetFallback } from "./WidgetFallback";

export interface WidgetProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  /** Traduction : clé i18n (i18next) OU LocalizedString inline (useLocalization) → texte. Fournie par GenericForm `t`. */
  t: (key: I18n) => string;
  /** Options résolues `{value,label}` (label déjà traduit). */
  options: Array<{ value: string; label: string }>;
}

export type WidgetComponent = (p: WidgetProps) => ReactElement | null;

const control = (form: UseFormReturn<FieldValues>) => form.control as Control<FieldValues>;
const fname = (n: string) => n as FieldPath<FieldValues>;
// Label vide (`field.label` falsy) → on ne passe rien (le composant masque alors le FormLabel).
const lbl = (p: WidgetProps) => (p.field.label ? p.t(p.field.label) : "");
// Repli TRADUIT pour la zone de recherche d'un select/multiselect : sans `placeholderSearch` déclaré, le
// composant SelectObject retombait sur un "Search..." codé en dur (non traduit). LocalizedString inline →
// résolu locale-aware par `p.t`, sans dépendre d'une clé i18n d'un autre module (LEAF).
const SEARCH_PLACEHOLDER_FALLBACK: I18n = { fr: "Rechercher…", en: "Search…" };
const searchPh = (p: WidgetProps) => p.t(p.field.placeholderSearch ?? SEARCH_PLACEHOLDER_FALLBACK);

const registry: Partial<Record<string, WidgetComponent>> = {
  hidden: () => null,

  // `widgetProps.inputType` (text|email|tel|url) → input HTML natif typé.
  text: (p) => <FormFieldText control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    type={(p.field.widgetProps?.inputType as string) ?? "text"}
    required={p.field.required} placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    hint={p.field.info ? p.t(p.field.info) : undefined} errorTranslate={p.t} />,

  textarea: (p) => <TextareaFormField control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    required={p.field.required} placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    description={p.field.info ? p.t(p.field.info) : undefined}
    rows={(p.field.widgetProps?.rows as number) ?? 4} errorTranslate={p.t} />,

  number: (p) => <FormFieldNumber control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} required={p.field.required}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined} errorTranslate={p.t} />,

  switch: (p) => <FormFieldSwitch control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} />,

  checkbox: (p) => <FormFieldCheckbox control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} />,

  checkboxGroup: (p) => <FormFieldCheckboxGroup control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} options={p.options}
    variant={p.field.widgetProps?.variant as "plain" | "card" | undefined} errorTranslate={p.t} />,

  select: (p) => <FormFieldSelectObject control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    required={p.field.required} options={p.options}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    placeholderSearch={searchPh(p)} errorTranslate={p.t} />,

  selectFromLists: (p) => <FormFieldSelectObject control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    required={p.field.required} options={p.options}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    placeholderSearch={searchPh(p)} errorTranslate={p.t} />,

  // `widgetProps.maxItems` plafonne la MULTI-sélection (pendant du `maximumSelectionLength` de select2
  // côté legacy) ; la garde de validation reste `rules.max`, appliquée à la LONGUEUR du tableau.
  multiselect: (p) => <FormFieldSelectObject control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    required={p.field.required} multiple options={p.options}
    maxItems={p.field.widgetProps?.maxItems as number | undefined}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    placeholderSearch={searchPh(p)} errorTranslate={p.t} />,

  date: (p) => <FormFieldDate control={control(p.form)} name={fname(p.field.name)} label={lbl(p)} required={p.field.required}
    placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
    hint={p.field.info ? p.t(p.field.info) : undefined}
    startYear={p.field.widgetProps?.startYear as number | undefined}
    endYear={p.field.widgetProps?.endYear as number | undefined} errorTranslate={p.t} />,

  urlList: (p) => <FormFieldUrlList control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
    addLabel={p.t((p.field.widgetProps?.addLabel as string) ?? "common.add")}
    removeLabel={p.t((p.field.widgetProps?.removeLabel as string) ?? "common.remove")} errorTranslate={p.t} />,

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
  // `label`/`placeholder`/`options.label` peuvent être une clé i18n (string) OU une LocalizedString
  // inline `{fr,en}`. On passe la valeur BRUTE à `p.t` (qui gère les deux) — surtout PAS `String(...)`,
  // qui transformerait `{fr,en}` en "[object Object]".
  return raw.map((f) => ({
    name: String(f.name),
    kind: f.kind === "select" ? "select" : "text",
    label: f.label ? p.t(f.label as I18n) : undefined,
    placeholder: f.placeholder ? p.t(f.placeholder as I18n) : undefined,
    options: Array.isArray(f.options)
      ? (f.options as Array<{ value: unknown; label: I18n }>).map((o) => ({ value: String(o.value), label: p.t(o.label) }))
      : undefined,
  }));
}

/** Enregistre/écrase un widget par kind. Utilisé par profil pour injecter les widgets DOMAINE (inversion). */
export function registerWidget(kind: string, comp: WidgetComponent): void {
  registry[kind] = comp;
}

/** Un widget est-il enregistré (générique OU domaine poussé) ? Utilisé par la garde des clés costum. */
export function hasWidget(kind: string): boolean {
  return registry[kind] != null;
}

export function getWidget(kind: string): WidgetComponent {
  const comp = registry[kind];
  if (comp == null) {
    // Repli silencieux historique → warn explicite : un widget DOMAINE non importé (cf. profil/forms/registerWidgets)
    // rendrait un input texte muet. Valeur retournée INCHANGÉE (fallback text) pour ne rien casser.
    console.warn(`[formEngine] widget "${kind}" non enregistré — repli sur "text" (widget domaine non importé ? cf. profil/forms/registerWidgets).`);
    return registry.text!;
  }
  return comp;
}
