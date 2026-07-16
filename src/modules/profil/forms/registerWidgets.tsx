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
import { IconFormField } from "../components/profile-edit/fields/IconFormField";
import { FormFieldTags } from "../components/profile-edit/fields/FormFieldTags";
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

const WidgetFallback = () => <div className="h-10 animate-pulse rounded-md bg-muted" />;
type FinderSearchType = NonNullable<GlobalAutocompleteCostumData["searchType"]>[number];
type FinderValue = Record<string, { type: string; name?: string }>;
const control = (form: UseFormReturn<FieldValues>) => form.control as Control<FieldValues>;
const fname = (n: string) => n as FieldPath<FieldValues>;
const lbl = (p: WidgetProps) => (p.field.label ? p.t(p.field.label) : "");

// email/tel : input à icône (i18n profil via TranslatedFormMessage interne d'IconFormField).
registerWidget("email", (p) => <IconFormField control={control(p.form)} name={fname(p.field.name)} icon={Mail} type="email" label={lbl(p)}
  placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined} />);
registerWidget("tel", (p) => <IconFormField control={control(p.form)} name={fname(p.field.name)} icon={Phone} type="tel" label={lbl(p)} />);

// tags : recherche de tags SDK (useSearchTags → useCocolight).
registerWidget("tags", (p) => <FormFieldTags control={control(p.form)} name={fname(p.field.name)} label={lbl(p)}
  searchable={(p.field.widgetProps?.searchable as boolean) ?? true}
  extendedTexts={(p.field.widgetProps?.extendedTexts as boolean) ?? false} />);

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
