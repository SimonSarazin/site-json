import { Link } from "react-router";
import { Mail, ChevronRight, Image as ImageIcon, Phone, Globe, Calendar, MapPin, Users, Briefcase, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/helpers/formatDate";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import "@/modules/profil/i18n";

export default function ProfileTemplateDefault() {
  const { entity, entityType: _entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  const {
    logoUrl,
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

  return (
    <div className="bg-white -m-4 md:-m-8">
      <div className="w-full mx-auto bg-white shadow-sm">
        <div className="relative h-96 bg-cover bg-center rounded-md border-gray-200 border" style={{ backgroundImage: bannerUrl ? `url('${bannerUrl}')` : `url('${imageUrl}')` }}>
          <div className="absolute bottom-6 right-6 z-20">
            <button className="bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-md border border-gray-200">
              <ImageIcon className="w-4 h-4" />
              {t("ProfileTemplateDefault.showAllPhotos")}
            </button>
          </div>
        </div>

        <div className="relative px-8 pb-6">
          <div className="flex items-end gap-6 -mt-20">
            <div className="relative">
              <div className="w-40 h-40 rounded-full border-4 border-white bg-white shadow-xl overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt={entityName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center from-yellow-100 to-yellow-50">
                    <div className="text-center p-2">
                      <div className="text-4xl mb-1">✒️</div>
                      <div className="text-xs font-bold text-gray-700 leading-tight">
                        {entityName.split(" ").slice(0, 2).join(" ")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex justify-between items-end pb-2 flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">{entityName}</h1>
                {address && (
                  <p className="text-gray-600">
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
                        className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 bg-white text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-sm"
                      >
                        <Mail className="w-4 h-4" />
                        {t("ProfileTemplateDefault.sendEmail")}
                      </button>
                    )}
                    <button
                      className="px-5 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 flex items-center gap-2 shadow-sm"
                    >
                      {t("ProfileTemplateDefault.reservationSpace")}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              }
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200"></div>
        </div>

        <div className="px-8 py-8">
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="grid w-full grid-cols-7 mb-8 bg-gray-100 p-1 rounded-lg">
              <TabsTrigger
                value="about"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                {t("ProfileTemplateDefault.tabs.about")}
              </TabsTrigger>
              <TabsTrigger
                value="news"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                {t("ProfileTemplateDefault.tabs.news")}
              </TabsTrigger>
              <TabsTrigger
                value="coworking"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                {t("ProfileTemplateDefault.tabs.coworking")}
              </TabsTrigger>
              <TabsTrigger
                value="rooms"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                {t("ProfileTemplateDefault.tabs.meetingRooms")}
              </TabsTrigger>
              <TabsTrigger
                value="infos"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                {t("ProfileTemplateDefault.tabs.practicalInfo")}
              </TabsTrigger>
              <TabsTrigger
                value="communities"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                {t("ProfileTemplateDefault.tabs.communities")}
              </TabsTrigger>
              <TabsTrigger
                value="observatory"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                {t("ProfileTemplateDefault.tabs.observatories")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="about">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
              {entity.serverData?.startDate && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <span className="inline-block w-2 h-2 bg-teal-500 rounded-full"></span>
                    {entity.serverData?.type && typeof entity.serverData.type === "string" && (
                      <span className="capitalize">{entity.serverData.type}</span>
                    )}
                  </div>
                  <div className="text-gray-900">
                    <strong>{t("common.date")}:</strong> {formatDate(entity.serverData.startDate)}
                    {entity.serverData?.endDate && (
                      <> - {formatDate(entity.serverData.endDate)}</>
                    )}
                  </div>
                </div>
              )}

              {entity.serverData?.shortDescription && typeof entity.serverData.shortDescription === "string" && (
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {entity.serverData.shortDescription}
                  </h3>
                </div>
              )}

              {entity.serverData?.description && typeof entity.serverData.description === "string" && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("ProfileTemplateDefault.description")}</h2>
                  <div className="text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 p-6 rounded-lg border border-gray-200">
                    {entity.serverData.description}
                  </div>
                </div>
              )}

              {organizer && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("common.organizedBy")}</h2>
                  <div className="flex items-center gap-4 bg-white p-5 rounded-lg border border-gray-300 shadow-sm hover:border-teal-400 transition-colors">
                    {organizer.profilThumbImageUrl && (
                      <img
                        src={organizer.profilThumbImageUrl}
                        alt={organizer.name || "Organisateur"}
                        className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                      />
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900">{organizer.name || "Sans nom"}</h3>
                      {organizer.slug && (
                        <Link
                          to={`/@${organizer.slug}`}
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Award className="w-6 h-6 text-teal-600" />
                    {t("ProfileTemplateDefault.badges")}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {badges.map((badge, index) => (
                      <div key={index} className="bg-white border border-teal-300 rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow">
                        <Award className="w-4 h-4 text-teal-600" />
                        <span className="text-gray-900 font-medium">{badge.name || 'Badge'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("ProfileTemplateDefault.tags")}</h2>
                  <div className="flex flex-wrap gap-2">
                    {tags.slice(0, 20).map((tag, index) => (
                      <span
                        key={index}
                        className="bg-white border border-gray-300 text-gray-800 px-3 py-1.5 rounded-full text-sm font-medium hover:border-teal-400 hover:bg-gray-50 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {openingHours && openingHours.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("ProfileTemplateDefault.openingHours")}</h2>
                  <div className="bg-white p-5 rounded-lg border border-gray-300 shadow-sm">
                    {openingHours.map((schedule, index) => (
                      <div key={index} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                        <span className="font-semibold text-gray-800">
                          {schedule.dayOfWeek}
                        </span>
                        <div className="text-gray-900 font-medium">
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

            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-300 p-6 sticky top-4 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-6">{t("ProfileTemplateDefault.information")}</h3>

                {(membersCount !== null || projectsCount !== null) && (
                  <div className="space-y-4 mb-6 pb-6 border-b border-gray-300">
                    {membersCount !== null && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-teal-600" />
                          <span className="text-gray-700 font-medium">{t("ProfileTemplateDefault.members")}</span>
                        </div>
                        <span className="font-bold text-gray-900 text-lg">{membersCount}</span>
                      </div>
                    )}
                    {projectsCount !== null && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-teal-600" />
                          <span className="text-gray-700 font-medium">{t("ProfileTemplateDefault.projects")}</span>
                        </div>
                        <span className="font-bold text-gray-900 text-lg">{projectsCount}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {entity.serverData?.username && typeof entity.serverData.username === "string" && (
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                      <span className="text-teal-600 font-semibold">@{entity.serverData.username}</span>
                    </div>
                  )}

                  {entity.serverData?.email && typeof entity.serverData.email === "string" && (
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <Mail className="w-5 h-5 text-teal-600 shrink-0" />
                      <span className="text-gray-800 break-all text-sm">{entity.serverData.email}</span>
                    </div>
                  )}

                  {entity.serverData?.mobile && typeof entity.serverData.mobile === "string" && (
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <Phone className="w-5 h-5 text-teal-600 shrink-0" />
                      <a href={`tel:${entity.serverData.mobile}`} className="text-gray-800 font-medium text-sm hover:text-teal-600">{entity.serverData.mobile}</a>
                    </div>
                  )}

                  {entity.serverData?.url && typeof entity.serverData.url === "string" && (
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <Globe className="w-5 h-5 text-teal-600 shrink-0" />
                      <a href={entity.serverData.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 break-all text-sm font-medium">
                        {entity.serverData.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}

                  {address?.postalCode && address.addressLocality && (
                    <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <MapPin className="w-5 h-5 text-teal-600 mt-1 shrink-0" />
                      <div className="text-sm">
                        {address.streetAddress && <div className="text-gray-800 font-medium">{address.streetAddress}</div>}
                        <div className="text-gray-700">
                          {address.postalCode} {address.addressLocality}
                        </div>
                      </div>
                    </div>
                  )}

                  {entity.serverData?.openingDate && (
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <Calendar className="w-5 h-5 text-teal-600 shrink-0" />
                      <span className="text-gray-800 text-sm font-medium">{t("ProfileTemplateDefault.openSince")} {formatDate(entity.serverData.openingDate)}</span>
                    </div>
                  )}

                  {entity.serverData?.externalLinkRegistration && typeof entity.serverData.externalLinkRegistration === "string" && (
                    <div className="mt-6 pt-6 border-t border-gray-300">
                      <Button
                        className="w-full bg-teal-500 hover:bg-teal-600"
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
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Calendar className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.news") })}</p>
                  <p className="text-gray-500">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="coworking">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Briefcase className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.coworking") })}</p>
                  <p className="text-gray-500">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rooms">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Users className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.meetingRooms") })}</p>
                  <p className="text-gray-500">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="infos">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <MapPin className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.practicalInfo") })}</p>
                  <p className="text-gray-500">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="communities">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Users className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.communities") })}</p>
                  <p className="text-gray-500">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="observatory">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Globe className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">{t("ProfileTemplateDefault.sectionLabel", undefined, { name: t("ProfileTemplateDefault.tabs.observatories") })}</p>
                  <p className="text-gray-500">{t("ProfileTemplateDefault.comingSoon")}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}