import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useT } from "@/hooks/useT";
import { Loader2 } from "lucide-react";
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
import { useProfileFormData } from "../../hooks/useProfileFormData";
import { useUpdateProfile } from "../../hooks/useProfileMutations";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isOrganization, isUser as isUserGuard } from "@/lib/getTypedEntity";

interface EditProfileModalProps {
  entity: EntityTypes;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Schéma de validation pour User
const userProfileSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  username: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  email: z.union([z.string().email("Email invalide"), z.literal("")]).optional(),
  mobile: z.string().optional(),
  url: z.union([z.string().url("URL invalide"), z.literal("")]).optional(),
  // Adresse complète
  addressCountry: z.string().optional(),
  streetAddress: z.string().optional(),
  postalCode: z.string().optional(),
  addressLocality: z.string().optional(),
  localityId: z.string().optional(),
  level1: z.string().optional(),
  level1Name: z.string().optional(),
  level2: z.string().optional(),
  level2Name: z.string().optional(),
  level3: z.string().optional(),
  level3Name: z.string().optional(),
  level4: z.string().optional(),
  level4Name: z.string().optional(),
  codeInsee: z.string().optional(),
  // Réseaux sociaux
  github: z.string().optional(),
  gitlab: z.string().optional(),
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  instagram: z.string().optional(),
  diaspora: z.string().optional(),
  mastodon: z.string().optional(),
  telegram: z.string().optional(),
  signal: z.string().optional(),
  // Organisation spécifique
  openingHours: z.array(z.object({
    dayOfWeek: z.string(),
    hours: z.array(z.object({
      opens: z.string(),
      closes: z.string(),
    })),
  })).optional(),
  // Tags
  tags: z.array(z.string()).optional(),
});

type UserProfileFormData = z.infer<typeof userProfileSchema>;

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

  const isUser = isUserGuard(entity);
  const isOrg = isOrganization(entity);

  const form = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: defaultValues || undefined,
  });

  // Réinitialiser le formulaire quand l'entité change ou quand le modal s'ouvre
  useEffect(() => {
    if (defaultValues && open) {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.slug, open, defaultValues]);

  const onSubmit = async (data: UserProfileFormData) => {
    try {
      // Préparer les données à envoyer
      const updateData: Record<string, any> = {
        name: data.name,
      };

      // Champs toujours optionnels (peuvent être supprimés avec une chaîne vide)
      updateData.shortDescription = data.shortDescription || "";
      updateData.description = data.description || "";
      updateData.url = data.url || "";

      // Email: REQUIS pour User, optionnel pour Organization
      if (isUser) {
        // User: email obligatoire, ne pas envoyer si vide (validation côté client)
        if (data.email) updateData.email = data.email;
        // Mobile: uniquement pour les utilisateurs
        updateData.mobile = data.mobile || "";
      } else {
        // Organization: email optionnel, peut être supprimé
        updateData.email = data.email || "";
      }

      // Adresse complète
      // L'API requiert soit un objet PostalAddress complet avec @type et tous les champs requis,
      // soit une chaîne vide ""
      if (data.addressCountry && data.addressLocality && data.localityId) {
        // L'utilisateur a sélectionné une ville, créer un objet PostalAddress valide
        const address: Record<string, any> = {
          "@type": "PostalAddress",
          // Champs requis (doivent être des strings)
          addressCountry: data.addressCountry,
          addressLocality: data.addressLocality,
          localityId: data.localityId,
          level1: data.level1 || "",
          level1Name: data.level1Name || "",
          codeInsee: data.codeInsee || "",
        };

        // Champs optionnels
        if (data.level2) address.level2 = data.level2;
        if (data.level2Name) address.level2Name = data.level2Name;
        if (data.level3) address.level3 = data.level3;
        if (data.level3Name) address.level3Name = data.level3Name;
        if (data.level4) address.level4 = data.level4;
        if (data.level4Name) address.level4Name = data.level4Name;
        if (data.postalCode) address.postalCode = data.postalCode;
        if (data.streetAddress) address.streetAddress = data.streetAddress;

        updateData.address = address;
      } else {
        // Pas d'adresse ou adresse incomplète, envoyer une chaîne vide
        updateData.address = "";
      }

      // User spécifique
      if (isUser) {
        // Réseaux sociaux - tous optionnels, peuvent être supprimés avec une chaîne vide
        // Envoyer directement à la racine (pour entity.data/draft)
        updateData.github = data.github || "";
        updateData.gitlab = data.gitlab || "";
        updateData.facebook = data.facebook || "";
        updateData.twitter = data.twitter || "";
        updateData.instagram = data.instagram || "";
        updateData.diaspora = data.diaspora || "";
        updateData.mastodon = data.mastodon || "";
        updateData.telegram = data.telegram || "";
        updateData.signal = data.signal || "";
      }

      // Organisation spécifique
      if (isOrg) {
        // Horaires d'ouverture
        if (data.openingHours && data.openingHours.length > 0) {
          updateData.openingHours = data.openingHours;
        } else {
          updateData.openingHours = "";
        }
      }

      // Tags (pour tous les types d'entités)
      // L'API attend "" pour effacer tous les tags, ou un tableau de strings
      if (data.tags && data.tags.length > 0) {
        updateData.tags = data.tags;
      } else {
        updateData.tags = "";
      }

      console.log("updateData avant envoi:", updateData);
      await updateMutation.mutateAsync(updateData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      // Afficher les détails de l'erreur de validation
      if (error && typeof error === 'object') {
        console.error("Error details:", {
          message: (error as any).message,
          validationErrors: (error as any).validationErrors,
          details: (error as any).details,
          response: (error as any).response,
          data: (error as any).data,
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
              <TabsList className={`grid w-full ${isUser || isOrg ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <TabsTrigger value="basic">{t("ProfileEdit.tabs.basic")}</TabsTrigger>
                <TabsTrigger value="contact">{t("ProfileEdit.tabs.contact")}</TabsTrigger>
                <TabsTrigger value="location">{t("ProfileEdit.tabs.location.label")}</TabsTrigger>
                {isUser && (
                  <TabsTrigger value="social">{t("ProfileEdit.tabs.social")}</TabsTrigger>
                )}
                {isOrg && (
                  <TabsTrigger value="schedule">{t("ProfileEdit.tabs.schedule.label")}</TabsTrigger>
                )}
              </TabsList>

              <div className="mt-6">
                <TabsContent value="basic">
                  <EditBasicInfoTab form={form} entityType={entityType || ""} />
                </TabsContent>

                <TabsContent value="contact">
                  <EditContactTab form={form} />
                </TabsContent>

                <TabsContent value="location">
                  <EditLocationTab form={form} />
                </TabsContent>

                {isUser && (
                  <TabsContent value="social">
                    <EditSocialTab form={form} />
                  </TabsContent>
                )}

                {isOrg && (
                  <TabsContent value="schedule">
                    <EditScheduleTab form={form} />
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
