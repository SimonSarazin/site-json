import { useState } from "react";
import { useForm, useFieldArray, type Resolver, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2, Plus, Trash2, Building2, MapPin, Image as ImageIcon, Share2,
  Globe, Clock, Phone, Video, FileText, AlertCircle,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import { ImageUploadField } from "../profile-edit/fields";

const dayHoursSchema = z.object({
  enabled: z.boolean().default(false),
  start: z.string().default("08:00"),
  end: z.string().default("18:00"),
});

const socialLinkSchema = z.object({
  platform: z.string(),
  url: z.string(),
});

export const tiersLieuxSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  openingMonth: z.string().optional(),
  openingYear: z.string().optional(),
  shortDescription: z.string().min(1, "La description courte est requise"),
  structureName: z.string().optional(),
  managementType: z.string().min(1, "Le mode de gestion est requis"),
  managementTypeOther: z.string().optional(),
  family: z.array(z.string()).optional(),
  familyOther: z.string().optional(),
  surfaceBuilt: z.string().optional(),
  surfaceOutdoor: z.string().optional(),
  addressCountry: z.string().optional(),
  addressLocality: z.string().optional(),
  postalCode: z.string().optional(),
  streetAddress: z.string().optional(),
  localityId: z.string().optional(),
  logo: z.string().optional(),
  photos: z.array(z.string()).default([]),
  socialLinks: z.array(socialLinkSchema).optional(),
  websiteUrl: z.string().optional(),
  hours: z.object({
    monday: dayHoursSchema,
    tuesday: dayHoursSchema,
    wednesday: dayHoursSchema,
    thursday: dayHoursSchema,
    friday: dayHoursSchema,
    saturday: dayHoursSchema,
    sunday: dayHoursSchema,
  }),
  email: z.string().email("Email invalide").min(1, "L'email est requis"),
  phone: z.string().optional(),
  videoUrl: z.string().optional(),
  description: z.string().optional(),
});

export type TiersLieuxFormData = z.infer<typeof tiersLieuxSchema>;

export interface TiersLieuxSubmitPayload extends TiersLieuxFormData {
  _logoFile: File | null;
  _photoFiles: File[];
}

const MANAGEMENT_TYPES = [
  { value: "association", label: "Association" },
  { value: "collectif-citoyen", label: "Collectif citoyen" },
  { value: "universites", label: "Universités / Écoles" },
  { value: "etablissements-scolaires", label: "Établissements scolaires" },
  { value: "collectivites", label: "Collectivités" },
  { value: "sarl-sa-sas", label: "SARL / SA / SAS" },
  { value: "scic", label: "SCIC" },
  { value: "scop", label: "SCOP" },
  { value: "autre", label: "Autre mode de gestion" },
];

const FAMILY_OPTIONS = [
  { value: "ateliers-artisanaux", label: "Ateliers artisanaux partagés" },
  { value: "coworking", label: "Bureaux partagés / Coworking" },
  { value: "foodlab", label: "Cuisine partagée / Foodlab" },
  { value: "fablab", label: "Fablab / Makerspace / Hackerspace" },
  { value: "livinglab", label: "LivingLab / Innovation sociale" },
  { value: "nourricier", label: "Tiers-lieu nourricier" },
  { value: "culturel", label: "Tiers-lieu culturel" },
  { value: "autre", label: "Autre famille de tiers-lieux" },
];

const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter / X" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "mastodon", label: "Mastodon" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
];

const DAYS = [
  { key: "monday", label: "Lundi" },
  { key: "tuesday", label: "Mardi" },
  { key: "wednesday", label: "Mercredi" },
  { key: "thursday", label: "Jeudi" },
  { key: "friday", label: "Vendredi" },
  { key: "saturday", label: "Samedi" },
  { key: "sunday", label: "Dimanche" },
] as const;

const STEPS = [
  { id: "info", label: "Infos", icon: Building2 },
  { id: "contact", label: "Contact", icon: MapPin },
  { id: "media", label: "Médias", icon: ImageIcon },
  { id: "online", label: "En ligne", icon: Globe },
  { id: "details", label: "Détails", icon: FileText },
];

export function getDefaultTiersLieuxValues(): TiersLieuxFormData {
  return {
    name: "",
    openingMonth: "",
    openingYear: "",
    shortDescription: "",
    managementType: "",
    family: [],
    addressCountry: "",
    addressLocality: "",
    postalCode: "",
    streetAddress: "",
    localityId: "",
    logo: "",
    photos: [],
    socialLinks: [],
    hours: {
      monday: { enabled: true, start: "08:00", end: "18:00" },
      tuesday: { enabled: true, start: "08:00", end: "18:00" },
      wednesday: { enabled: true, start: "08:00", end: "18:00" },
      thursday: { enabled: true, start: "08:00", end: "18:00" },
      friday: { enabled: true, start: "08:00", end: "18:00" },
      saturday: { enabled: false, start: "08:00", end: "18:00" },
      sunday: { enabled: false, start: "08:00", end: "18:00" },
    },
    email: "",
  };
}

interface TiersLieuxFormProps {
  mode: "add" | "edit";
  defaultValues: TiersLieuxFormData;
  /** Logo existant (édition) — affiché en aperçu tant qu'aucun nouveau n'est choisi. */
  existingLogoUrl?: string;
  onSubmit: (data: TiersLieuxSubmitPayload) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function TiersLieuxForm({
  mode,
  defaultValues,
  existingLogoUrl,
  onSubmit,
  onCancel,
  isSubmitting,
}: TiersLieuxFormProps) {
  const t = useT("modules/profil");
  const [currentStep, setCurrentStep] = useState(0);

  const form = useForm<TiersLieuxFormData>({
    resolver: zodResolver(tiersLieuxSchema) as Resolver<TiersLieuxFormData>,
    defaultValues,
  });

  const { fields: socialFields, append: appendSocial, remove: removeSocial } = useFieldArray({
    control: form.control,
    name: "socialLinks",
  });

  // Logo : recadrage 1:1 façon avatar, posé dans le draft au submit (`profil_avatar`).
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // TODO(photos) — Upload de photos désactivé tant que non géré côté backend.
  // Réactiver : ce state + les handlers + le bloc UI « Photos » de l'onglet Médias,
  // et remettre `_photoFiles: photoFiles` dans `handleSubmit`.
  // const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  // const [photosUploading] = useState(false);
  // const photosInputRef = useRef<HTMLInputElement>(null);
  // const photoPreviews = photoFiles.map((f) => URL.createObjectURL(f));

  // TODO(photos) — handlers désactivés (cf. state commenté ci-dessus) :
  /*
  const handlePhotosUpload = (files: FileList) => {
    const valid = Array.from(files).filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(t("AddTiersLieux.errors.imageOnly"));
        return false;
      }
      return true;
    });
    setPhotoFiles((prev) => [...prev, ...valid]);
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };
  */

  const handleCancel = () => {
    form.reset();
    setCurrentStep(0);
    onCancel();
  };

  const handleSubmit = async (data: TiersLieuxFormData) => {
    // _photoFiles: [] tant que l'upload photos est désactivé (cf. TODO(photos)).
    await onSubmit({ ...data, _logoFile: logoFile, _photoFiles: [] });
  };

  const STEP_REQUIRED_FIELDS: Record<string, Array<keyof TiersLieuxFormData>> = {
    info: ["name", "shortDescription", "managementType"],
    contact: ["email"],
    media: [],
    online: [],
    details: [],
  };

  // Un onglet est "en erreur" si un de ses champs requis a une erreur de
  // validation. Sert à afficher un badge sur l'onglet + naviguer vers le 1er
  // onglet fautif au submit (sinon une erreur dans un onglet inactif est
  // invisible — l'onglet est caché en CSS par Radix Tabs).
  const hasStepErrors = (stepId: string): boolean =>
    (STEP_REQUIRED_FIELDS[stepId] ?? []).some((field) => !!form.formState.errors[field]);

  const goNext = async () => {
    const fields = STEP_REQUIRED_FIELDS[STEPS[currentStep].id] ?? [];
    const isValid = fields.length === 0 ? true : await form.trigger(fields);
    if (!isValid) return;
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const titleKey = mode === "edit" ? "EditTiersLieux.title" : "AddTiersLieux.title";
  const submitKey = mode === "edit" ? "EditTiersLieux.buttons.submit" : "AddTiersLieux.buttons.submit";
  const submittingKey = mode === "edit" ? "EditTiersLieux.buttons.submitting" : "AddTiersLieux.buttons.submitting";

  return (
    <>
      <div className="px-6 pt-6 pb-4 bg-linear-to-b from-primary/5 to-transparent border-b border-border/50">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 ring-1 ring-primary/20 shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                {t(titleKey)}
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                {t("AddTiersLieux.step")}{" "}
                <span className="font-semibold text-foreground">{currentStep + 1}</span> {t("AddTiersLieux.stepOf")} {STEPS.length} —{" "}
                <span className="text-primary font-medium">{t(`AddTiersLieux.steps.${STEPS[currentStep].id}`)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="w-full bg-muted rounded-full h-1.5 mt-4 overflow-hidden">
          <div
            className="bg-linear-to-r from-primary to-primary/70 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit, () => {
            // Validation échouée : l'erreur peut être dans un onglet inactif
            // (caché). On prévient via toast + on saute au 1er onglet fautif.
            const firstErrorStep = STEPS.findIndex((s) => hasStepErrors(s.id));
            if (firstErrorStep >= 0) setCurrentStep(firstErrorStep);
            toast.error(
              t("AddTiersLieux.errors.validationFailed", "Veuillez corriger les champs en erreur."),
            );
          })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
              e.preventDefault();
            }
          }}
          className="flex-1 flex flex-col min-h-0"
        >
          <Tabs value={STEPS[currentStep].id} className="w-full flex-1 flex flex-col min-h-0">
            <div className="shrink-0 px-6 pt-4">
              <TabsList className="w-full grid grid-cols-5 gap-1 h-auto p-1 bg-muted/50">
                {STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isCompleted = idx < currentStep;
                  const stepHasError = hasStepErrors(step.id);
                  return (
                    <TabsTrigger
                      key={step.id}
                      value={step.id}
                      type="button"
                      onClick={() => setCurrentStep(idx)}
                      className="flex-col sm:flex-row gap-1 px-2 sm:px-3 py-2 text-xs sm:text-sm min-w-0 data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all"
                    >
                      {stepHasError ? (
                        <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
                      ) : (
                        <Icon className={`w-4 h-4 shrink-0 ${isCompleted ? "text-primary" : ""}`} />
                      )}
                      <span className="truncate">{t(`AddTiersLieux.steps.${step.id}`)}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto px-6">
              <TabsContent value="info" className="space-y-5 max-w-2xl mx-auto pb-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("AddTiersLieux.fields.name")} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t("AddTiersLieux.fields.namePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>{t("AddTiersLieux.fields.openingDate")}</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="openingMonth"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("AddTiersLieux.fields.month")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[
                                "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                                "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
                              ].map((m, i) => (
                                <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="openingYear"
                      render={({ field }) => {
                        const currentYear = new Date().getFullYear();
                        const years = Array.from(
                          { length: currentYear + 5 - 1900 + 1 },
                          (_, i) => currentYear + 5 - i
                        );
                        return (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("AddTiersLieux.fields.year")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-60">
                                {years.map((y) => (
                                  <SelectItem key={y} value={String(y)}>
                                    {y}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="shortDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("AddTiersLieux.fields.shortDescription")} *</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="structureName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("AddTiersLieux.fields.structureName")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="managementType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("AddTiersLieux.fields.managementType")} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("AddTiersLieux.fields.selectPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MANAGEMENT_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("managementType") === "autre" && (
                  <FormField
                    control={form.control}
                    name="managementTypeOther"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("AddTiersLieux.fields.managementTypeOther")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="family"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("AddTiersLieux.fields.family")}</FormLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {FAMILY_OPTIONS.map((opt) => {
                          const checked = field.value?.includes(opt.value) ?? false;
                          return (
                            <label
                              key={opt.value}
                              className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted cursor-pointer text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = field.value ?? [];
                                  if (e.target.checked) {
                                    field.onChange([...next, opt.value]);
                                  } else {
                                    field.onChange(next.filter((v) => v !== opt.value));
                                  }
                                }}
                                className="accent-primary"
                              />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="surfaceBuilt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("AddTiersLieux.fields.surfaceBuilt")}</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder={t("AddTiersLieux.fields.surfacePlaceholder")} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="surfaceOutdoor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("AddTiersLieux.fields.surfaceOutdoor")}</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder={t("AddTiersLieux.fields.surfacePlaceholder")} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-6 max-w-2xl mx-auto pb-2 min-h-full flex flex-col justify-center">
                <div className="space-y-4">
                  <EditLocationTab form={form as unknown as UseFormReturn<FieldValues>} />
                </div>

                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                    <Phone className="w-4 h-4" /> Contact
                  </h3>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("AddTiersLieux.fields.email")} *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder={t("AddTiersLieux.fields.emailPlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("AddTiersLieux.fields.phone")}</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder={t("AddTiersLieux.fields.phonePlaceholder")} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="media" className="space-y-8 max-w-2xl mx-auto pb-2">
                <ImageUploadField
                  value={logoFile}
                  onChange={setLogoFile}
                  existingUrl={existingLogoUrl}
                  aspect={1}
                  shape="square"
                  label={t("AddTiersLieux.fields.logo")}
                  hint={t("AddTiersLieux.fields.logoHint")}
                />

                {/* TODO(photos) — bloc upload photos désactivé tant que non géré côté backend.
                    Réactiver avec le state + les handlers commentés plus haut.
                <div className="space-y-3">
                  <div className="text-center">
                    <FormLabel className="text-base font-semibold">{t("AddTiersLieux.fields.photos")}</FormLabel>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("AddTiersLieux.fields.photosHint")} · {photoFiles.length} {photoFiles.length > 1 ? t("AddTiersLieux.fields.photoCountPlural") : t("AddTiersLieux.fields.photoCountSingular")}
                    </p>
                  </div>

                  {photoPreviews.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {photoPreviews.map((url, idx) => (
                        <div key={idx} className="relative group aspect-square">
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-border shadow-sm"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition rounded-lg" />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition"
                            aria-label={t("AddTiersLieux.buttons.removePhoto")}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition cursor-pointer"
                    onClick={() => photosInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.length) handlePhotosUpload(e.dataTransfer.files);
                    }}
                  >
                    {photosUploading ? (
                      <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {photoFiles.length > 0 ? t("AddTiersLieux.fields.photosAddMore") : t("AddTiersLieux.fields.photosDropHint")}
                        </p>
                        <Button type="button" variant="secondary" size="sm" className="mt-1">
                          {t("AddTiersLieux.fields.photosSelectButton")}
                        </Button>
                      </div>
                    )}
                  </div>
                  <input
                    ref={photosInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handlePhotosUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
                */}

                <div className="border-t pt-6">
                  <FormField
                    control={form.control}
                    name="videoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-base font-semibold">
                          <Video className="w-4 h-4" /> {t("AddTiersLieux.fields.videoUrl")}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder={t("AddTiersLieux.fields.videoUrlPlaceholder")} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="online" className="space-y-6 max-w-2xl mx-auto pb-2">
                <FormField
                  control={form.control}
                  name="websiteUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Globe className="w-4 h-4" /> {t("AddTiersLieux.fields.websiteUrl")}
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={t("AddTiersLieux.fields.websiteUrlPlaceholder")} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="border-t pt-6 space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                    <Share2 className="w-4 h-4" /> {t("AddTiersLieux.fields.socialNetworks")}
                  </h3>
                  {socialFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                      <FormField
                        control={form.control}
                        name={`socialLinks.${index}.platform`}
                        render={({ field: platformField }) => (
                          <FormItem className="w-1/3">
                            <Select onValueChange={platformField.onChange} value={platformField.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("AddTiersLieux.fields.socialPlatform")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SOCIAL_PLATFORMS.map((p) => (
                                  <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`socialLinks.${index}.url`}
                        render={({ field: urlField }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder={t("AddTiersLieux.fields.socialUrlPlaceholder")} {...urlField} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeSocial(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendSocial({ platform: "", url: "" })}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" /> {t("AddTiersLieux.fields.addSocial")}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-6 max-w-2xl mx-auto pb-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                    <Clock className="w-4 h-4" /> {t("AddTiersLieux.fields.openingHours")}
                  </h3>
                  {DAYS.map(({ key }) => {
                    const label = t(`AddTiersLieux.days.${key}`);
                    const enabled = form.watch(`hours.${key}.enabled`);
                    return (
                      <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => form.setValue(`hours.${key}.enabled`, e.target.checked)}
                          className="accent-primary"
                        />
                        <span className="font-medium w-24 shrink-0">{label}</span>
                        <Input
                          type="time"
                          value={form.watch(`hours.${key}.start`)}
                          onChange={(e) => form.setValue(`hours.${key}.start`, e.target.value)}
                          disabled={!enabled}
                          className="w-32"
                        />
                        <span className="text-muted-foreground">→</span>
                        <Input
                          type="time"
                          value={form.watch(`hours.${key}.end`)}
                          onChange={(e) => form.setValue(`hours.${key}.end`, e.target.value)}
                          disabled={!enabled}
                          className="w-32"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-6">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <FileText className="w-4 h-4" /> {t("AddTiersLieux.fields.longDescription")}
                        </FormLabel>
                        <FormControl>
                          <Textarea rows={10} placeholder={t("AddTiersLieux.fields.longDescriptionPlaceholder")} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30 flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="text-muted-foreground hover:text-foreground"
            >
              {t("AddTiersLieux.buttons.cancel")}
            </Button>
            <div className="flex gap-2 sm:ml-auto w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={goPrev}
                disabled={currentStep === 0 || isSubmitting}
                className="flex-1 sm:flex-initial min-w-[110px]"
              >
                {t("AddTiersLieux.buttons.previous")}
              </Button>
              {currentStep < STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial min-w-[110px] shadow-sm"
                >
                  {t("AddTiersLieux.buttons.next")}
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial min-w-[140px] shadow-sm bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t(submittingKey)}
                    </>
                  ) : (
                    <>
                      <Building2 className="mr-2 h-4 w-4" />
                      {t(submitKey)}
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
