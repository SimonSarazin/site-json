import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/hooks/useT";
import { getProfileSchema, type ProfileFormData } from "../../schemaForm";
import { Loader2, AlertCircle } from "lucide-react";
import type { FieldErrors } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditBasicInfoTab } from "./EditBasicInfoTab";
import { EditContactTab } from "./EditContactTab";
import { EditLocationTab } from "./EditLocationTab";
import { EditSocialTab } from "./EditSocialTab";
import { EditScheduleTab } from "./EditScheduleTab";
import { EditEventDatesTab } from "./EditEventDatesTab";
import { useProfileFormData } from "../../hooks/useProfileFormData";
import { useUpdateProfile } from "../../hooks/useProfileMutations";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { DAYS } from "@/constants/DAYS";
import { formatISO } from "date-fns";

// Mapping des champs par onglet pour détecter les erreurs
const TAB_FIELDS = {
  basic: ['name', 'slug', 'birthDate', 'type', 'parent', 'organizer', 'shortDescription', 'description', 'tags'],
  contact: ['email', 'mobile', 'fixe', 'url'],
  location: ['addressCountry', 'addressLocality', 'postalCode', 'streetAddress', 'localityId', 'codeInsee'],
  social: ['github', 'gitlab', 'facebook', 'twitter', 'instagram', 'diaspora', 'mastodon', 'telegram', 'signal'],
  schedule: ['openingHours'],
  eventDates: ['startDate', 'endDate', 'openingHours', 'recurrency'],
} as const;

type TabName = keyof typeof TAB_FIELDS;

/**
 * Vérifie si un onglet contient des erreurs de validation
 */
function hasTabErrors(tabName: TabName, errors: FieldErrors<ProfileFormData>): boolean {
  return TAB_FIELDS[tabName].some(field => !!errors[field as keyof ProfileFormData]);
}

interface EditProfileModalProps {
  entity: EntityTypes;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal pour éditer un profil
 *
 * Features:
 * - Tabs conditionnels selon entityType
 * - Upload d'images (profil + bannière)
 * - Validation Zod
 * - Optimistic updates
 * - Toast notifications
 *
 * @param entity - L'entité à éditer
 * @param open - État d'ouverture du modal
 * @param onOpenChange - Callback pour changer l'état d'ouverture
 */
export function EditProfileModal({
  entity,
  open,
  onOpenChange,
}: EditProfileModalProps) {
  const t = useT("modules/profil");
  const { defaultValues, entityType } = useProfileFormData(entity);
  const updateMutation = useUpdateProfile(entity);

  const schema = getProfileSchema(entityType || "citoyens");

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || undefined,
  });

  // Réinitialiser le formulaire quand l'entité change ou quand le modal s'ouvre
  useEffect(() => {
    if (defaultValues && open) {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.slug, open, defaultValues]);

  const onSubmit = async (formData: ProfileFormData) => {
    const data = formData as Record<string, unknown>;

    try {
      const updateData: Record<string, unknown> = {
        name: data.name,
        slug: data.slug,
      };

      // Helper pour construire l'adresse
      const buildAddress = (): Record<string, unknown> | "" => {
        if (data.addressCountry && data.addressLocality && data.localityId) {
          const address: Record<string, unknown> = {
            "@type": "PostalAddress",
            addressCountry: data.addressCountry,
            addressLocality: data.addressLocality,
            localityId: data.localityId,
            level1: data.level1 || "",
            level1Name: data.level1Name || "",
            codeInsee: data.codeInsee || "",
          };
          if (data.level2) address.level2 = data.level2;
          if (data.level2Name) address.level2Name = data.level2Name;
          if (data.level3) address.level3 = data.level3;
          if (data.level3Name) address.level3Name = data.level3Name;
          if (data.level4) address.level4 = data.level4;
          if (data.level4Name) address.level4Name = data.level4Name;
          if (data.postalCode) address.postalCode = data.postalCode;
          if (data.streetAddress) address.streetAddress = data.streetAddress;
          return address;
        }
        return "";
      };

      // Helper pour les tags
      const buildTags = () =>
        Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : "";

      // Helper pour les réseaux sociaux
      const buildSocial = () => ({
        github: data.github || "",
        gitlab: data.gitlab || "",
        facebook: data.facebook || "",
        twitter: data.twitter || "",
        instagram: data.instagram || "",
        diaspora: data.diaspora || "",
        mastodon: data.mastodon || "",
        telegram: data.telegram || "",
        signal: data.signal || "",
      });

      // Helper pour les horaires d'ouverture
      // Toujours 7 entrées organisées par jour (Mo, Tu, We, Th, Fr, Sa, Su)
      const buildOpeningHours = () => {
        const arr = Array.isArray(data.openingHours) ? data.openingHours : [];
        return DAYS.map((day) => {
          const match = arr.find(
            (o): o is { dayOfWeek: string; hours: { opens: string; closes: string }[] } =>
              typeof o === "object" && o !== null && o.dayOfWeek === day
          );
          return match || "";
        });
      };

      switch (entityType) {
        case "citoyens":
          Object.assign(updateData, {
            shortDescription: data.shortDescription || "",
            description: data.description || "",
            url: data.url || "",
            email: data.email || "",
            mobile: data.mobile || "",
            fixe: data.fixe || "",
            birthDate: data.birthDate || "",
            tags: buildTags(),
            address: buildAddress(),
            ...buildSocial(),
          });
          break;

        case "organizations":
          Object.assign(updateData, {
            shortDescription: data.shortDescription || "",
            description: data.description || "",
            url: data.url || "",
            email: data.email || "",
            tags: buildTags(),
            address: buildAddress(),
            openingHours: buildOpeningHours(),
          });
          Object.assign(updateData, buildSocial());
          if (data.type) updateData.type = data.type;
          break;

        case "projects":
          Object.assign(updateData, {
            shortDescription: data.shortDescription || "",
            description: data.description || "",
            url: data.url || "",
            email: data.email || "",
            tags: buildTags(),
            address: buildAddress(),
          });
          Object.assign(updateData, buildSocial());
          if (data.avancement) updateData.avancement = data.avancement;
          if (data.parent) updateData.parent = data.parent;
          break;

        case "events":
          Object.assign(updateData, {
            shortDescription: data.shortDescription || "",
            url: data.url || "",
            email: data.email || "",
            recurrency: data.recurrency || false,
            tags: buildTags(),
            address: buildAddress(),
            openingHours: buildOpeningHours(),
          });
          if (data.type) updateData.type = data.type;
          if (typeof data.startDate === "string") {
            updateData.startDate = formatISO(new Date(data.startDate));
          }
          if (typeof data.endDate === "string") {
            updateData.endDate = formatISO(new Date(data.endDate));
          }
          updateData.timeZone = data.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          updateData.parent = data.parent || "";
          if (data.organizer) updateData.organizer = data.organizer;
          break;

        case "poi":
          Object.assign(updateData, {
            shortDescription: data.shortDescription || "",
            description: data.description || "",
            url: data.url || "",
            email: data.email || "",
            tags: buildTags(),
            address: buildAddress(),
            // PAS de social pour POI
          });
          if (data.type) updateData.type = data.type;
          break;
      }
      if (import.meta.env.DEV) {
        console.log("updateData avant envoi:", updateData);
      }

      await updateMutation.mutateAsync(updateData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error && typeof error === "object") {
        console.error("Error details:", {
          message: (error as Record<string, unknown>).message,
          validationErrors: (error as Record<string, unknown>).validationErrors,
          details: (error as Record<string, unknown>).details,
          response: (error as Record<string, unknown>).response,
          data: (error as Record<string, unknown>).data,
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("ProfileEdit.title")}</DialogTitle>
        </DialogHeader>

        {/* Formulaire avec tabs */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className={`grid w-full ${entityType === "citoyens" || entityType === "organizations" || entityType === "events" ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <TabsTrigger value="basic" className="gap-1">
                  {t("ProfileEdit.tabs.basic")}
                  {hasTabErrors('basic', form.formState.errors) && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="contact" className="gap-1">
                  {t("ProfileEdit.tabs.contact")}
                  {hasTabErrors('contact', form.formState.errors) && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="location" className="gap-1">
                  {t("ProfileEdit.tabs.location.label")}
                  {hasTabErrors('location', form.formState.errors) && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </TabsTrigger>
                {entityType === "citoyens" && (
                  <TabsTrigger value="social" className="gap-1">
                    {t("ProfileEdit.tabs.social")}
                    {hasTabErrors('social', form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </TabsTrigger>
                )}
                {entityType === "organizations" && (
                  <TabsTrigger value="schedule" className="gap-1">
                    {t("ProfileEdit.tabs.schedule.label")}
                    {hasTabErrors('schedule', form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </TabsTrigger>
                )}
                {entityType === "events" && (
                  <TabsTrigger value="eventDates" className="gap-1">
                    {t("ProfileEdit.tabs.eventDates.label")}
                    {hasTabErrors('eventDates', form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              <div className="mt-6">
                <TabsContent value="basic">
                  <EditBasicInfoTab form={form} entityType={entityType || ""} />
                </TabsContent>

                <TabsContent value="contact">
                  <EditContactTab form={form} entityType={entityType || ""} />
                </TabsContent>

                <TabsContent value="location">
                  <EditLocationTab form={form} />
                </TabsContent>

                {entityType === "citoyens" && (
                  <TabsContent value="social">
                    <EditSocialTab form={form} />
                  </TabsContent>
                )}

                {entityType === "organizations" && (
                  <TabsContent value="schedule">
                    <EditScheduleTab form={form} />
                  </TabsContent>
                )}

                {entityType === "events" && (
                  <TabsContent value="eventDates">
                    <EditEventDatesTab form={form} />
                  </TabsContent>
                )}
              </div>
            </Tabs>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                {t("ProfileEdit.cancel")}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("ProfileEdit.saving")}
                  </>
                ) : (
                  t("ProfileEdit.save")
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
