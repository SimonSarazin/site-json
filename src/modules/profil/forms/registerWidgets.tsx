/**
 * Enregistrement (side-effect) des widgets DOMAINE de profil dans le registre générique de formEngine.
 * Inversion de dépendance : formEngine N'IMPORTE PAS ces composants (couplés SDK/useCocolight/i18n profil) ;
 * c'est profil qui les POUSSE via `registerWidget(kind, comp)`. À importer en side-effect AVANT le 1er rendu
 * (cf. EntityFormModal `import "./registerWidgets"`). Les fabriques JSX sont reprises telles quelles de
 * l'ancien registry.tsx (lazy + Suspense préservés pour le code-split des composites lourds).
 */
import { lazy, Suspense } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { Mail, Phone } from "lucide-react";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { registerWidget, type WidgetProps } from "@/modules/formEngine";
import { searchPh } from "@/modules/formEngine/widgets/registry";
import { IconFormField } from "../components/profile-edit/fields/IconFormField";
import { ValueSelectField } from "./fields/ValueSelectField";
import { TagsWidget } from "./fields/TagsWidget";
import { FormFieldMarkdown } from "../components/profile-edit/fields/FormFieldMarkdown";
import { TranslatedFormMessage } from "../components/profile-edit/fields/TranslatedFormMessage";
import GalleryUploadField, { emptyGalleryValue, type GalleryValue } from "../components/profile-edit/fields/GalleryUploadField";
import DocumentUploadField from "../components/profile-edit/fields/DocumentUploadField";

// Composites LOURDS chargés à la demande (code-split Vite) — préservé à l'identique.
const ImageUploadField = lazy(() => import("../components/profile-edit/fields/ImageUploadField"));
const EditLocationTab = lazy(() => import("../components/profile-edit/EditLocationTab").then((m) => ({ default: m.EditLocationTab })));
const SelectParent = lazy(() => import("../components/profile-edit/fields/SelectParent").then((m) => ({ default: m.SelectParent })));
const EditEventDatesTab = lazy(() => import("../components/profile-edit/EditEventDatesTab").then((m) => ({ default: m.EditEventDatesTab })));
const EditSocialTab = lazy(() => import("../components/profile-edit/EditSocialTab").then((m) => ({ default: m.EditSocialTab })));
const EditScheduleTab = lazy(() => import("../components/profile-edit/EditScheduleTab").then((m) => ({ default: m.EditScheduleTab })));

import { WidgetFallback } from "@/modules/formEngine/widgets/WidgetFallback";
type FinderSearchType = NonNullable<GlobalAutocompleteCostumData["searchType"]>[number];
type FinderValue = Record<string, { type: string; name?: string }>;
const control = (form: UseFormReturn<FieldValues>) => form.control as Control<FieldValues>;
const fname = (n: string) => n as FieldPath<FieldValues>;
const lbl = (p: WidgetProps) => (p.field.label ? p.t(p.field.label) : "");

// email/tel : input à icône (i18n profil via TranslatedFormMessage interne d'IconFormField).
registerWidget("email", (p) => <IconFormField control={control(p.form)} name={fname(p.field.name)} icon={Mail} type="email" label={lbl(p)}
  placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined} />);
registerWidget("tel", (p) => <IconFormField control={control(p.form)} name={fname(p.field.name)} icon={Phone} type="tel" label={lbl(p)} />);

// tags : mots-clés. Recherche de tags SDK (useSearchTags, tout le réseau) — comportement d'origine,
// INCHANGÉ par défaut. `widgetProps.list` y AJOUTE les valeurs d'une liste déclarée du costum : en
// statique elles arrivent par `options` (chemin ordinaire du moteur), en dynamique le hook les résout
// (`{collection,distinct}` = les mots-clés réellement employés). Les deux sources coexistent — la
// recherche réseau reste disponible sauf `searchable:false`.
registerWidget("tags", (p) => <TagsWidget p={p} />);

// valueSelect : sélection d'une ou plusieurs VALEURS d'une liste du costum, saisie libre facultative.
// Sans rapport avec les tags — vise `territoires`, `auteurs`, `legalStatus`… `widgetProps` :
// `list` (défaut : le nom du champ), `costumSlug`, `multiple` (défaut true), `min`, `max`, `creatable`,
// `saveNewValue` (défaut FALSE — opt-in par champ : une valeur libre acceptée par ce champ est aussi
// promue dans `costum.lists.<list>`, réservé admin ; cf. `growCostumLists`, `profil/forms/costum/parent62/fns.ts`).
// À `true`, restreint AUSSI la saisie libre (`creatable`) aux admins — un visiteur non-admin ne choisit
// alors que parmi l'existant, cf. docstring `ValueSelectField`.
registerWidget("valueSelect", (p) => <ValueSelectField control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
  options={p.options?.map((o) => o.value)}
  list={p.field.widgetProps?.list as string | undefined}
  costumSlug={p.field.widgetProps?.costumSlug as string | undefined}
  multiple={(p.field.widgetProps?.multiple as boolean) ?? true}
  min={p.field.widgetProps?.min as number | undefined}
  max={p.field.widgetProps?.max as number | undefined}
  creatable={(p.field.widgetProps?.creatable as boolean) ?? true}
  saveNewValue={(p.field.widgetProps?.saveNewValue as boolean) ?? false}
  required={p.field.required}
  placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
  placeholderSearch={searchPh(p)}
  errorTranslate={p.t} />);


// markdown : éditeur markdown (coform MarkdownEditor, client-only/SSR-safe). Value = string markdown brut.
registerWidget("markdown", (p) => <FormFieldMarkdown control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
  required={Boolean(p.field.required)}
  height={(p.field.widgetProps?.height as number) ?? 300}
  preview={(p.field.widgetProps?.preview as "edit" | "live" | "preview") ?? "edit"} />);

// image : ImageUploadField (dépend de @/modules/news ImageCropDialog).
registerWidget("image", (p) => (
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
));

// gallery : galerie multi-images (Option C). Collecte locale ; upload post-save par `runEntityMutation`
// (via `entity.uploadDocument(file, {contentKey})`). Valeur = GalleryValue (auto-reconnue par l'orchestration).
registerWidget("gallery", (p) => {
  const contentKey = (p.field.widgetProps?.contentKey as string) ?? "slider";
  const docType = ((p.field.widgetProps?.docType as string) ?? "image") as "image" | "file";
  return (
    <FormField control={control(p.form)} name={fname(p.field.name)} render={({ field }) => (
      <GalleryUploadField
        value={(field.value as GalleryValue) ?? emptyGalleryValue(contentKey, docType)}
        onChange={(v) => field.onChange(v)}
        label={lbl(p)}
        hint={p.field.info ? p.t(p.field.info) : undefined}
        maxItems={p.field.widgetProps?.maxItems as number | undefined}
      />
    )} />
  );
});

// file : documents non-image (pendant fichier de "gallery"). Collecte locale ; upload/suppression
// post-save par `processGalleryFields` (via `entity.uploadDocument(file, {contentKey, docType:"file"})`).
registerWidget("file", (p) => {
  const contentKey = (p.field.widgetProps?.contentKey as string) ?? "file";
  return (
    <FormField control={control(p.form)} name={fname(p.field.name)} render={({ field }) => (
      <DocumentUploadField
        value={(field.value as GalleryValue) ?? emptyGalleryValue(contentKey, "file")}
        onChange={(v) => field.onChange(v)}
        label={lbl(p)}
        hint={p.field.info ? p.t(p.field.info) : undefined}
        maxItems={p.field.widgetProps?.maxItems as number | undefined}
        accept={p.field.widgetProps?.accept as string | undefined}
        allowRecording={p.field.widgetProps?.allowRecording as boolean | undefined}
      />
    )} />
  );
});

// location : EditLocationTab (API villes/rues via useCocolight). Erreur cross-champ portée sur `address`.
registerWidget("location", (p) => {
  const req = Boolean(p.field.required || p.field.widgetProps?.required);
  return (
    <Suspense fallback={<WidgetFallback />}>
      <FormField control={control(p.form)} name={fname(p.field.name)} render={() => (
        <FormItem>
          {p.field.label && <FormLabel>{lbl(p)}{req ? " *" : ""}</FormLabel>}
          <EditLocationTab form={p.form} />
          <TranslatedFormMessage />
        </FormItem>
      )} />
    </Suspense>
  );
});

// finder : recherche/sélection d'une entité (référence `{id:{type,name}}`) via l'autocomplete SDK.
registerWidget("finder", (p) => (
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
));

// composites edit-profil (gèrent leurs champs via le form).
registerWidget("eventDates", (p) => <Suspense fallback={<WidgetFallback />}><EditEventDatesTab form={p.form} /></Suspense>);
registerWidget("editSocial", (p) => <Suspense fallback={<WidgetFallback />}><EditSocialTab form={p.form} /></Suspense>);
registerWidget("editSchedule", (p) => <Suspense fallback={<WidgetFallback />}><EditScheduleTab form={p.form} /></Suspense>);
