import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form } from "@/components/ui/form";
import { useT } from "@/hooks/useT";
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { useToast } from "@/hooks/use-toast";

import { InfoTab } from "./tabs/InfoTab";
import { ContactTab } from "./tabs/ContactTab";
import { SocialTab } from "./tabs/SocialTab";
import { LocationTab } from "./tabs/LocationTab";
import { ScheduleTab } from "./tabs/ScheduleTab";

const profileSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  shortDescription: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  type: z.string().optional(),
  avancement: z.string().optional(),
  tags: z.string().optional(),

  email: z.string().email().optional().or(z.literal("")),
  url: z.string().url().optional().or(z.literal("")),
  fixe: z.string().optional(),
  mobile: z.string().optional(),
  facebook: z.string().url().optional().or(z.literal("")),
  instagram: z.string().url().optional().or(z.literal("")),
  twitter: z.string().url().optional().or(z.literal("")),
  github: z.string().url().optional().or(z.literal("")),
  gitlab: z.string().url().optional().or(z.literal("")),
  telegram: z.string().url().optional().or(z.literal("")),
  signal: z.string().optional(),
  mastodon: z.string().url().optional().or(z.literal("")),
  diaspora: z.string().url().optional().or(z.literal("")),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

const TAB_FIELDS = {
  info: ['name', 'shortDescription', 'description', 'type', 'avancement', 'tags'],
  contact: ['email', 'url', 'fixe', 'mobile'],
  social: ['facebook', 'instagram', 'twitter', 'github', 'gitlab', 'telegram', 'signal', 'mastodon', 'diaspora'],
  location: [] as string[],
  schedule: [] as string[],
} as const;

type TabName = keyof typeof TAB_FIELDS;

function hasTabErrors(tabName: TabName, errors: Record<string, unknown>): boolean {
  return TAB_FIELDS[tabName].some(field => !!errors[field]);
}

interface SocialNetwork {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  github?: string;
  gitlab?: string;
  telegram?: string;
  signal?: string;
  mastodon?: string;
  diaspora?: string;
}

interface AddressData {
  "@type"?: "PostalAddress";
  addressCountry?: string;
  addressLocality?: string;
  localityId?: string;
  codeInsee?: string;
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
  postalCode?: string;
  streetAddress?: string;
  geo?: {
    "@type"?: string;
    latitude: string | number;
    longitude: string | number;
  };
  geoPosition?: {
    type: string;
    coordinates: [number, number];
  };
}

interface OpeningHourEntry {
  dayOfWeek: string;
  hours?: Array<{ opens: string; closes: string }>;
}

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  initialData: {
    name?: string;
    shortDescription?: string;
    description?: string;
    email?: string;
    url?: string;
    fixe?: string;
    mobile?: string;
    birthDate?: string | Date;
    type?: string;
    avancement?: string;
    tags?: string[];
    socialNetwork?: SocialNetwork;
    address?: AddressData | null;
    geo?: { latitude: string | number; longitude: string | number } | null;
    openingHours?: OpeningHourEntry[];
  };
}

export function EditProfileModal({
  open,
  onOpenChange,
  entityType,
  initialData,
}: EditProfileModalProps) {
  const t = useT("modules/profil");
  const { toast } = useToast();
  const { updateDescription, updateInfo, updateSocial, updateLocality, updateOpeningHours } = useProfileMutations();
  const [activeTab, setActiveTab] = useState<TabName>("info");
  const [addressData, setAddressData] = useState<AddressData | null>(initialData.address || null);
  const [openingHoursData, setOpeningHoursData] = useState<OpeningHourEntry[]>(initialData.openingHours || []);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData.name || "",
      shortDescription: initialData.shortDescription || "",
      description: initialData.description || "",
      type: initialData.type || "",
      avancement: initialData.avancement || "",
      tags: initialData.tags?.join(", ") || "",
      email: initialData.email || "",
      url: initialData.url || "",
      fixe: initialData.fixe || "",
      mobile: initialData.mobile || "",
      facebook: initialData.socialNetwork?.facebook || "",
      instagram: initialData.socialNetwork?.instagram || "",
      twitter: initialData.socialNetwork?.twitter || "",
      github: initialData.socialNetwork?.github || "",
      gitlab: initialData.socialNetwork?.gitlab || "",
      telegram: initialData.socialNetwork?.telegram || "",
      signal: initialData.socialNetwork?.signal || "",
      mastodon: initialData.socialNetwork?.mastodon || "",
      diaspora: initialData.socialNetwork?.diaspora || "",
    },
  });

  const isPending = updateDescription.isPending || updateInfo.isPending || updateSocial.isPending || updateLocality.isPending || updateOpeningHours.isPending;

  const onSubmit = async (data: ProfileFormData) => {
    try {
      const promises: Promise<unknown>[] = [];

      const descriptionChanges: Record<string, string | null> = {};
      if (data.shortDescription !== (initialData.shortDescription || "")) {
        descriptionChanges.shortDescription = data.shortDescription || null;
      }
      if (data.description !== (initialData.description || "")) {
        descriptionChanges.description = data.description || null;
      }
      if (Object.keys(descriptionChanges).length > 0) {
        promises.push(updateDescription.mutateAsync(descriptionChanges));
      }

      const infoChanges: Record<string, string | string[] | null> = {};
      if (data.name !== initialData.name) infoChanges.name = data.name;
      if (data.email !== (initialData.email || "")) infoChanges.email = data.email || null;
      if (data.url !== (initialData.url || "")) infoChanges.url = data.url || null;
      if (data.fixe !== (initialData.fixe || "")) infoChanges.fixe = data.fixe || null;
      if (data.mobile !== (initialData.mobile || "")) infoChanges.mobile = data.mobile || null;
      if (data.type !== (initialData.type || "")) infoChanges.type = data.type || null;
      if (data.avancement !== (initialData.avancement || "")) infoChanges.avancement = data.avancement || null;

      const tagsArray = data.tags ? data.tags.split(",").map(tag => tag.trim()).filter(Boolean) : [];
      const initialTagsString = initialData.tags?.join(", ") || "";
      if (data.tags !== initialTagsString) {
        infoChanges.tags = tagsArray.length > 0 ? tagsArray : null;
      }

      if (Object.keys(infoChanges).length > 0) {
        promises.push(updateInfo.mutateAsync(infoChanges));
      }

      const socialChanges: Record<string, string | null> = {};
      const socialFields = ['facebook', 'instagram', 'twitter', 'github', 'gitlab', 'telegram', 'signal', 'mastodon', 'diaspora'] as const;
      socialFields.forEach(field => {
        const newValue = data[field] || "";
        const oldValue = initialData.socialNetwork?.[field] || "";
        if (newValue !== oldValue) {
          socialChanges[field] = newValue || null;
        }
      });
      if (Object.keys(socialChanges).length > 0) {
        promises.push(updateSocial.mutateAsync(socialChanges));
      }

      if (addressData !== initialData.address) {
        if (!addressData) {
          promises.push(updateLocality.mutateAsync({ address: "" }));
        } else if (addressData.addressLocality && addressData.localityId) {
          const { geo: addrGeo, geoPosition: addrGeoPos, ...addressWithoutGeo } = addressData;

          const finalAddress = {
            "@type": "PostalAddress" as const,
            addressCountry: addressWithoutGeo.addressCountry || "",
            addressLocality: addressWithoutGeo.addressLocality as string,
            localityId: addressWithoutGeo.localityId as string,
            codeInsee: addressWithoutGeo.codeInsee || addressWithoutGeo.localityId as string,
            level1: addressWithoutGeo.level1 || "",
            level1Name: addressWithoutGeo.level1Name || "",
            ...(addressWithoutGeo.level3 ? { level3: addressWithoutGeo.level3 } : {}),
            ...(addressWithoutGeo.level3Name ? { level3Name: addressWithoutGeo.level3Name } : {}),
            ...(addressWithoutGeo.level4 ? { level4: addressWithoutGeo.level4 } : {}),
            ...(addressWithoutGeo.level4Name ? { level4Name: addressWithoutGeo.level4Name } : {}),
            ...(addressWithoutGeo.postalCode ? { postalCode: addressWithoutGeo.postalCode } : {}),
            ...(addressWithoutGeo.streetAddress ? { streetAddress: addressWithoutGeo.streetAddress } : {}),
          };

          const geoData = addrGeo ? {
            "@type": "GeoCoordinates" as const,
            latitude: addrGeo.latitude,
            longitude: addrGeo.longitude,
          } : undefined;

          const geoPositionData = addrGeoPos ? {
            type: "Point" as const,
            coordinates: addrGeoPos.coordinates,
            float: true as const,
          } : undefined;

          promises.push(updateLocality.mutateAsync({
            address: finalAddress,
            geo: geoData,
            geoPosition: geoPositionData,
          }));
        }
      }

      if (JSON.stringify(openingHoursData) !== JSON.stringify(initialData.openingHours || [])) {
        promises.push(updateOpeningHours.mutateAsync(openingHoursData));
      }

      if (promises.length === 0) {
        onOpenChange(false);
        return;
      }

      await Promise.all(promises);

      toast({
        title: String(t("EditAbout.success")),
        description: String(t("EditAbout.profileUpdated")),
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: String(t("EditAbout.error")),
        description: String(t("EditAbout.updateFailed")),
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!isPending) {
      form.reset();
      setActiveTab("info");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            {String(t("EditAbout.editProfile"))}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabName)} className="gap-2 w-full flex-1 flex flex-col min-h-0">
              <div className="overflow-x-auto scrollbar-hide -mx-6 px-6 shrink-0">
                <TabsList className="w-max min-w-full flex">
                  <TabsTrigger value="info" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {String(t("EditAbout.tabs.info"))}
                    {hasTabErrors('info', form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="contact" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {String(t("EditAbout.tabs.contact"))}
                    {hasTabErrors('contact', form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </TabsTrigger>
                  {entityType !== "poi" && (
                    <TabsTrigger value="social" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                      {String(t("EditAbout.tabs.social"))}
                      {hasTabErrors('social', form.formState.errors) && (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="location" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {String(t("EditAbout.tabs.location"))}
                  </TabsTrigger>
                  {entityType !== "poi" && entityType !== "citoyens" && (
                    <TabsTrigger value="schedule" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                      {String(t("EditAbout.tabs.schedule"))}
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto pr-2">
                <TabsContent value="info" className="mt-0">
                  <InfoTab form={form} entityType={entityType} />
                </TabsContent>

                <TabsContent value="contact" className="mt-0">
                  <ContactTab form={form} entityType={entityType} />
                </TabsContent>

                <TabsContent value="social" className="mt-0">
                  <SocialTab form={form} />
                </TabsContent>

                <TabsContent value="location" className="mt-0">
                  <LocationTab
                    addressData={addressData}
                    setAddressData={setAddressData}
                    initialGeo={initialData.geo}
                  />
                </TabsContent>

                <TabsContent value="schedule" className="mt-0">
                  <ScheduleTab
                    openingHours={openingHoursData}
                    setOpeningHours={setOpeningHoursData}
                  />
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="mt-6 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                {String(t("EditAbout.cancel"))}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {String(t("EditAbout.saving"))}
                  </>
                ) : (
                  String(t("EditAbout.save"))
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
