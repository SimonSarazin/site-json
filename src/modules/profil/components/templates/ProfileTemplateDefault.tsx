import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Mail, ChevronRight, Image as ImageIcon, Globe, Users, Briefcase } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import "@/modules/profil/i18n";
import { LazyTabContent } from "@/components/LazyTabContent";
import { NewsTab } from "../tabs/NewsTab";
import { ProjectsTab } from "../tabs/ProjectsTab";
import { CommunitiesTab } from "../tabs/CommunitiesTab";
import { AboutTab } from "../tabs/AboutTab";
import { ProfileBannerCarriedBy } from "../banner/ProfileBannerCarriedBy";

export default function ProfileTemplateDefault() {
  const { entity, entityType: _entityType } = useProfileEntity();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // const { me } = useCocolight();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

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

  const effectiveLogoUrl = imageError ? logoThumbUrl : logoUrl;

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
      <div className="w-full mx-auto bg-background shadow-sm">
        <div className="relative h-96 bg-cover bg-center rounded-md border-border border" style={{ backgroundImage: bannerUrl ? `url('${bannerUrl}')` : `url('${imageUrl}')` }}>
          <ProfileBannerCarriedBy
            parent={entity?.serverData?.parent as Record<string, { id?: string; _id?: { $id?: string }; name?: string; type?: string; collection?: string; profilThumbImageUrl?: string }> | undefined}
          />

          <div className="absolute bottom-6 right-6 z-20">
            <button className="bg-card text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-md border border-border">
              <ImageIcon className="w-4 h-4" />
              {t("ProfileTemplateDefault.showAllPhotos")}
            </button>
          </div>
        </div>

        <div className="relative px-8 pb-6">
          <div className="flex items-end gap-6 -mt-20">
            <div className="relative">
              <div className="w-40 h-40 rounded-full border-4 border-background bg-card shadow-xl overflow-hidden">
                {effectiveLogoUrl ? (
                  <img
                    src={effectiveLogoUrl}
                    alt={entityName}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center from-yellow-100 to-yellow-50">
                    <div className="text-center p-2">
                      <div className="text-4xl mb-1">✒️</div>
                      <div className="text-xs font-bold text-foreground leading-tight">
                        {entityName.split(" ").slice(0, 2).join(" ")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

              {
                _entityType != "citoyens" && (
                  <div className="flex gap-3 flex-wrap">
                    {entity.serverData?.email && typeof entity.serverData.email === "string" && (
                      <button
                        onClick={() => window.location.href = `mailto:${entity.serverData.email}`}
                        className="px-5 py-2.5 border border-border rounded-lg text-foreground bg-card text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-sm"
                      >
                        <Mail className="w-4 h-4" />
                        {t("ProfileTemplateDefault.sendEmail")}
                      </button>
                    )}
                    <button
                      className="px-5 py-2.5 bg-[#0092a2] text-white rounded-lg text-sm font-medium hover:bg-teal-600 flex items-center gap-2 shadow-sm"
                    >
                      {t("ProfileTemplateDefault.reservationSpace")}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              }
            </div>
          </div>

          <div className="mt-6 border-t border-border"></div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 overflow-x-auto scrollbar-hide">
              <TabsList className="w-max min-w-full mb-6 sm:mb-8 bg-background border flex rounded-lg">
              <TabsTrigger
                value="about"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.about")}
              </TabsTrigger>
              <TabsTrigger
                value="news"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.news")}
              </TabsTrigger>
              <TabsTrigger
                value="coworking"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.coworking")}
              </TabsTrigger>
              <TabsTrigger
                value="rooms"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.meetingRooms")}
              </TabsTrigger>
              <TabsTrigger
                value="projects"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.projects")}
              </TabsTrigger>
              <TabsTrigger
                value="communities"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.communities")}
              </TabsTrigger>
              <TabsTrigger
                value="observatory"
                className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.observatories")}
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

            <TabsContent value="coworking">
              <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Briefcase className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-foreground mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.coworking") })}</p>
                  <p className="text-muted-foreground">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rooms">
              <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Users className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-foreground mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.meetingRooms") })}</p>
                  <p className="text-muted-foreground">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
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

            <TabsContent value="observatory">
              <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Globe className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-foreground mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.observatories") })}</p>
                  <p className="text-muted-foreground">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}