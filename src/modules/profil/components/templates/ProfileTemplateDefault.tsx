import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Mail, ChevronRight, Image as ImageIcon, Phone, Globe, Calendar, MapPin, Users, Briefcase, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/helpers/formatDate";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import "@/modules/profil/i18n";
// import { useCocolight } from "@/hooks/useCocolight";
// import { isUser, isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { LazyTabContent } from "@/components/LazyTabContent";
import { NewsTab } from "../tabs/NewsTab";

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
    organizer,
    name: entityName,
    bannerUrl,
    tags,
    badges,
    membersCount,
    projectsCount,
    openingHours,
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
                className="flex-shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.about")}
              </TabsTrigger>
              <TabsTrigger
                value="news"
                className="flex-shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.news")}
              </TabsTrigger>
              <TabsTrigger
                value="coworking"
                className="flex-shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.coworking")}
              </TabsTrigger>
              <TabsTrigger
                value="rooms"
                className="flex-shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.meetingRooms")}
              </TabsTrigger>
              <TabsTrigger
                value="infos"
                className="flex-shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.practicalInfo")}
              </TabsTrigger>
              <TabsTrigger
                value="communities"
                className="flex-shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.communities")}
              </TabsTrigger>
              <TabsTrigger
                value="observatory"
                className="flex-shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
              >
                {t("ProfileTemplateDefault.tabs.observatories")}
              </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="about">
              <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 sm:gap-8">
                <div className="order-2 lg:order-1 lg:col-span-2 min-w-0 overflow-hidden">
              {entity.serverData?.startDate && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <span className="inline-block w-2 h-2 bg-[#0092a2] rounded-full"></span>
                    {entity.serverData?.type && typeof entity.serverData.type === "string" && (
                      <span className="capitalize">{entity.serverData.type}</span>
                    )}
                  </div>
                  <div className="text-foreground">
                    <strong>{t("common.date")}:</strong> {formatDate(entity.serverData.startDate)}
                    {entity.serverData?.endDate && (
                      <> - {formatDate(entity.serverData.endDate)}</>
                    )}
                  </div>
                </div>
              )}

              {entity.serverData?.shortDescription && typeof entity.serverData.shortDescription === "string" && (
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    {entity.serverData.shortDescription}
                  </h3>
                </div>
              )}

              {entity.serverData?.description && typeof entity.serverData.description === "string" && (
                <div className="mb-8 sm:mb-12">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">{t("ProfileTemplateDefault.description")}</h2>
                  <div className="text-foreground leading-relaxed whitespace-pre-wrap bg-muted p-4 sm:p-6 rounded-lg border border-border wrap-break-word">
                    {entity.serverData.description}
                  </div>
                </div>
              )}

              {organizer && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-foreground mb-4">{t("common.organizedBy")}</h2>
                  <div className="flex items-center gap-4 bg-card p-5 rounded-lg border border-border shadow-sm hover:border-teal-400 transition-colors">
                    {organizer.profilThumbImageUrl && (
                      <img
                        src={organizer.profilThumbImageUrl}
                        alt={organizer.name || "Organisateur"}
                        className="w-16 h-16 rounded-lg object-cover border border-border"
                      />
                    )}
                    <div>
                      <h3 className="font-bold text-foreground">{organizer.name || "Sans nom"}</h3>
                      {organizer.slug && (
                        <Link
                          to={`/profil/${organizer.slug}`}
                          className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                        >
                          {t("common.viewProfile")} →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {badges.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <Award className="w-6 h-6 text-teal-600" />
                    {t("ProfileTemplateDefault.badges")}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {badges.map((badge, index) => (
                      <div key={index} className="bg-card border border-(--themecolor) rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow">
                        <Award className="w-4 h-4 text-teal-600" />
                        <span className="text-foreground font-medium">{badge.name || 'Badge'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-foreground mb-4">{t("ProfileTemplateDefault.tags")}</h2>
                  <div className="flex flex-wrap gap-2">
                    {tags.slice(0, 20).map((tag, index) => (
                      <span
                        key={index}
                        className="bg-card border border-border text-foreground px-3 py-1.5 rounded-full text-sm font-medium hover:border-teal-400 hover:bg-muted transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {openingHours && openingHours.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-foreground mb-4">{t("ProfileTemplateDefault.openingHours")}</h2>
                  <div className="bg-card p-5 rounded-lg border border-border shadow-sm">
                    {openingHours.map((schedule, index) => (
                      <div key={index} className="flex justify-between items-center py-3 border-b border-border last:border-b-0">
                        <span className="font-semibold text-foreground">
                          {schedule.dayOfWeek}
                        </span>
                        <div className="text-foreground font-medium">
                          {schedule.hours && schedule.hours.length > 0 && (
                            schedule.hours.map((hour, hIndex) => (
                              <span key={hIndex}>
                                {hour.opens} - {hour.closes}
                                {hIndex < schedule.hours.length - 1 && ', '}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="order-1 lg:order-2 lg:col-span-1">
              <div className="bg-card rounded-lg border border-border p-4 sm:p-6 lg:sticky lg:top-4 shadow-sm">
                <h3 className="text-xl font-bold text-foreground mb-6">{t("ProfileTemplateDefault.information")}</h3>

                {(membersCount !== null || projectsCount !== null) && (
                  <div className="space-y-4 mb-6 pb-6 border-b border-border">
                    {membersCount !== null && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-teal-600" />
                          <span className="text-foreground font-medium">{t("ProfileTemplateDefault.members")}</span>
                        </div>
                        <span className="font-bold text-foreground text-lg">{membersCount}</span>
                      </div>
                    )}
                    {projectsCount !== null && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-teal-600" />
                          <span className="text-foreground font-medium">{t("ProfileTemplateDefault.projects")}</span>
                        </div>
                        <span className="font-bold text-foreground text-lg">{projectsCount}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {entity.serverData?.username && typeof entity.serverData.username === "string" && (
                    <div className="flex items-center gap-3 bg-muted p-3 rounded-lg">
                      <span className="text-teal-600 font-semibold">@{entity.serverData.username}</span>
                    </div>
                  )}

                  {entity.serverData?.email && typeof entity.serverData.email === "string" && (
                    <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
                      <Mail className="w-5 h-5 text-teal-600 shrink-0" />
                      <span className="text-foreground break-all text-sm">{entity.serverData.email}</span>
                    </div>
                  )}

                  {entity.serverData?.mobile && typeof entity.serverData.mobile === "string" && (
                    <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
                      <Phone className="w-5 h-5 text-teal-600 shrink-0" />
                      <a href={`tel:${entity.serverData.mobile}`} className="text-foreground font-medium text-sm hover:text-teal-600">{entity.serverData.mobile}</a>
                    </div>
                  )}

                  {entity.serverData?.url && typeof entity.serverData.url === "string" && (
                    <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
                      <Globe className="w-5 h-5 text-teal-600 shrink-0" />
                      <a href={entity.serverData.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 break-all text-sm font-medium">
                        {entity.serverData.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}

                  {address?.postalCode && address.addressLocality && (
                    <div className="flex items-start gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
                      <MapPin className="w-5 h-5 text-teal-600 mt-1 shrink-0" />
                      <div className="text-sm">
                        {address.streetAddress && <div className="text-foreground font-medium">{address.streetAddress}</div>}
                        <div className="text-foreground">
                          {address.postalCode} {address.addressLocality}
                        </div>
                      </div>
                    </div>
                  )}

                  {entity.serverData?.openingDate && (
                    <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
                      <Calendar className="w-5 h-5 text-teal-600 shrink-0" />
                      <span className="text-foreground text-sm font-medium">{t("ProfileTemplateDefault.openSince")} {formatDate(entity.serverData.openingDate)}</span>
                    </div>
                  )}

                  {entity.serverData?.externalLinkRegistration && typeof entity.serverData.externalLinkRegistration === "string" && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <Button
                        className="w-full bg-[#0092a2] hover:bg-teal-600"
                        onClick={() => window.open(entity.serverData.externalLinkRegistration as string, "_blank")}
                      >
                        {t("ProfileTemplateDefault.register")}
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
                </div>
              </div>
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

            <TabsContent value="infos">
              <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <MapPin className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-foreground mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.practicalInfo") })}</p>
                  <p className="text-muted-foreground">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="communities">
              <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Users className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-foreground mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.communities") })}</p>
                  <p className="text-muted-foreground">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
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