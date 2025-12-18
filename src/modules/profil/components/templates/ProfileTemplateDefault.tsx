import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Image as ImageIcon, Camera, Pencil, User, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfileMutations } from "../../hooks/useProfileMutations";
import "@/modules/profil/i18n";
import { LazyTabContent } from "@/components/LazyTabContent";
import { NewsTab } from "../tabs/NewsTab";
import { ProjectsTab } from "../tabs/ProjectsTab";
import { CommunitiesTab } from "../tabs/CommunitiesTab";
import { AboutTab } from "../tabs/AboutTab";
import { ProfileBannerCarriedBy } from "../banner/ProfileBannerCarriedBy";
import { EditProfileImageModal } from "../banner/EditProfileImageModal";
import { EditBannerImageModal } from "../banner/EditBannerImageModal";
import { EditProfileModal } from "../tabs/about/edit/EditProfileModal";
import { ProfileActions } from "../actions/ProfileActions";
import { EntityStatusButton } from "../actions/EntityStatusButton";

export default function ProfileTemplateDefault() {
  const { entity, entityType: _entityType } = useProfileEntity();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { canEdit } = useProfileMutations();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  const [isEditProfileImageOpen, setIsEditProfileImageOpen] = useState(false);
  const [isEditBannerOpen, setIsEditBannerOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Déterminer le tab actif depuis l'URL
  // Exemples: /profil/slug → "about", /profil/slug/news → "news"
  const pathSegments = location.pathname.split('/').filter(Boolean);
  // pathSegments: ["profil", "slug", "news"] ou ["profil", "slug"]
  const currentTab = pathSegments.length > 2 ? pathSegments[2] : 'about';

  // Navigation vers un nouveau tab
  const handleTabChange = (newTab: string) => {
    if (newTab === 'about') {
      navigate(`/profil/${slug}`);
    } else {
      navigate(`/profil/${slug}/${newTab}`);
    }
  };

  const {
    logoUrl,
    logoThumbUrl,
    address,
    name: entityName,
    bannerUrl,
  } = useFormatProfileEntity(entity);
  const imageUrl = logoUrl;

  const [imageError, setImageError] = useState(false);
  const [bannerError, setBannerError] = useState(false);

  const getDefaultImage = () => {
    switch (_entityType) {
      case "citoyens":
        return "/images/citoyens.png";
      case "organizations":
        return "/images/organizations.png";
      case "projects":
        return "/images/project.png";
      default:
        return "/images/defaultImage.png";
    }
  };

  const defaultImage = getDefaultImage();

  const effectiveLogoUrl = imageError
    ? defaultImage
    : (logoUrl || logoThumbUrl || defaultImage);

  const effectiveBannerUrl = bannerError
    ? defaultImage
    : (bannerUrl || imageUrl || defaultImage);

  // console.log('entityType', _entityType);
  // console.log('isConnected', me?.isConnected);

  // if(me?.isConnected) {
  //   if (isOrganization(entity)) {
  //     console.log('organizations isAuthor', entity.isAuthor());
  //     console.log('organizations isAdmin', entity.isAdmin());
  //     console.log('organizations isAuthorOrAdmin', entity.isAuthorOrAdmin());
  //     console.log('organizations isMember', entity.isMember());
  //   }

  //   if (isProject(entity)) {
  //     console.log('projects isAuthor', entity.isAuthor());
  //     console.log('projects isAdmin', entity.isAdmin());
  //     console.log('projects isAuthorOrAdmin', entity.isAuthorOrAdmin());
  //     console.log('projects isContributor', entity.isContributor());
  //   }

  //   if (isEvent(entity)) {
  //     console.log('events isAttendee', entity.isAttendee());
  //   }

  //   if (isUser(entity) && me && me?.slug !== entity.slug) {
  //     console.log('citoyens isFollower', entity.isFollower());
  //     console.log('citoyens isFollowing', entity.isFollowing());
  //     console.log('citoyens isFriend', entity.isFriend());
  //   }
  // }

  return (
    <div className="bg-foreground -m-4 md:-m-8">
      <div className="w-full mx-auto bg-background">
        <div className="relative h-96 rounded-md border-border border group/banner overflow-hidden">
          <img
            src={effectiveBannerUrl}
            alt={entityName}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setBannerError(true)}
          />
          <ProfileBannerCarriedBy
            parent={entity?.serverData?.parent as Record<string, { id?: string; _id?: { $id?: string }; name?: string; type?: string; collection?: string; profilThumbImageUrl?: string }> | undefined}
          />

          {canEdit && (
            <button
              onClick={() => setIsEditBannerOpen(true)}
              className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-black/70 text-white p-2.5 rounded-full opacity-0 group-hover/banner:opacity-100 transition-all duration-200 backdrop-blur-sm"
              aria-label={String(t("EditImage.editBannerImage"))}
            >
              <Camera className="w-5 h-5" />
            </button>
          )}

          <div className="absolute bottom-6 right-6 z-20">
            <button className="bg-card text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-md border border-border">
              <ImageIcon className="w-4 h-4" />
              {t("ProfileTemplateDefault.showAllPhotos")}
            </button>
          </div>
        </div>

        <div className="relative px-8 pb-6">
          <div className="flex items-end gap-6 -mt-20">
            <div className="relative group/avatar">
              <div className="w-40 h-40 rounded-full border-4 border-background bg-card shadow-xl overflow-hidden">
                {imageError || !effectiveLogoUrl ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <User className="w-20 h-20 text-muted-foreground" />
                  </div>
                ) : (
                  <img
                    src={effectiveLogoUrl}
                    alt={entityName}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                )}
              </div>

              {canEdit && (
                <button
                  onClick={() => setIsEditProfileImageOpen(true)}
                  className="absolute bottom-2 right-2 z-20 bg-primary hover:bg-primary/90 text-primary-foreground p-2 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-all duration-200 shadow-lg"
                  aria-label={String(t("EditImage.editProfileImage"))}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1 flex justify-between items-end pb-2 flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-1">{entityName}</h1>
                {address && (
                  <p className="text-muted-foreground">
                    {address.addressLocality}
                    {address.postalCode && `, ${address.postalCode}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditProfileOpen(true)}
                    className="gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("ProfileTemplateDefault.editProfile")}</span>
                  </Button>
                )}

                <EntityStatusButton />

                <ProfileActions
                  email={entity?.serverData?.email as string | undefined}
                  phone={(entity?.serverData?.fixe || entity?.serverData?.mobile) as string | undefined}
                  url={entity?.serverData?.url as string | undefined}
                />
              </div>
            </div>
          </div>

        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 overflow-x-auto scrollbar-hide">
              <TabsList className="w-max min-w-full mb-6 sm:mb-8 bg-background border flex rounded-lg">
              <TabsTrigger
                value="about"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.about")}
              </TabsTrigger>
              <TabsTrigger
                value="news"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.news")}
              </TabsTrigger>
              <TabsTrigger
                value="projects"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.projects")}
              </TabsTrigger>
              <TabsTrigger
                value="communities"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.communities")}
              </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="about">
              <LazyTabContent value="about">
                <AboutTab />
              </LazyTabContent>
            </TabsContent>

            <TabsContent value="news">
              <LazyTabContent value="news">
                <NewsTab />
              </LazyTabContent>
            </TabsContent>

            <TabsContent value="projects">
              <LazyTabContent value="projects">
                <ProjectsTab />
              </LazyTabContent>
            </TabsContent>

            <TabsContent value="communities">
              <LazyTabContent value="communities">
                <CommunitiesTab />
              </LazyTabContent>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Image Modals */}
      <EditProfileImageModal
        open={isEditProfileImageOpen}
        onOpenChange={setIsEditProfileImageOpen}
        currentImage={effectiveLogoUrl || undefined}
      />

      <EditBannerImageModal
        open={isEditBannerOpen}
        onOpenChange={setIsEditBannerOpen}
        currentImage={bannerUrl || undefined}
      />

      <EditProfileModal
        open={isEditProfileOpen}
        onOpenChange={setIsEditProfileOpen}
        entityType={_entityType || "organizations"}
        initialData={{
          name: entity?.serverData?.name as string | undefined,
          shortDescription: entity?.serverData?.shortDescription as string | undefined,
          description: entity?.serverData?.description as string | undefined,
          email: entity?.serverData?.email as string | undefined,
          url: entity?.serverData?.url as string | undefined,
          fixe: entity?.serverData?.fixe as string | undefined,
          mobile: entity?.serverData?.mobile as string | undefined,
          type: entity?.serverData?.type as string | undefined,
          avancement: entity?.serverData?.avancement as string | undefined,
          tags: entity?.serverData?.tags as string[] | undefined,
          socialNetwork: entity?.serverData?.socialNetwork as {
            facebook?: string;
            instagram?: string;
            twitter?: string;
            github?: string;
            gitlab?: string;
            telegram?: string;
            signal?: string;
            mastodon?: string;
            diaspora?: string;
          } | undefined,
          address: entity?.serverData?.address as {
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
            geo?: { latitude: string | number; longitude: string | number };
            geoPosition?: { type: string; coordinates: [number, number] };
          } | null | undefined,
          geo: entity?.serverData?.geo as { latitude: string | number; longitude: string | number } | null | undefined,
          openingHours: entity?.serverData?.openingHours as Array<{
            dayOfWeek: string;
            hours?: Array<{ opens: string; closes: string }>;
          }> | undefined,
        }}
      />
    </div>
  );
}