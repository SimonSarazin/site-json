import type { SearchEntity } from "@/modules/search/schema";
import { Link } from "react-router";
import { Mail, ChevronRight, Image as ImageIcon, Phone, Globe, Calendar, MapPin, Users, Briefcase, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBaseUrl } from "@/lib/constant/common";

interface ProfileTemplateDefaultProps {
  entity: SearchEntity;
  entityType?: string;
  config?: {
    showBackButton?: boolean;
    showShareButton?: boolean;
    showAddress?: boolean;
    showMap?: boolean;
    markdownEnabled?: boolean;
  };
}

export default function ProfileTemplateDefault({
  entity,
  entityType: _entityType,
}: ProfileTemplateDefaultProps) {

  const hasProperty = <K extends string>(
    obj: any,
    key: K
  ): obj is Record<K, unknown> => {
    return key in obj;
  };

  const getLogoUrl = () => {

    if (hasProperty(entity, "profilThumbImageUrl") && hasProperty(entity, "profilImageUrl") && entity.profilImageUrl) {
      return `${entity.profilImageUrl}`;
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getAddress = () => {
    if (hasProperty(entity, "address") && entity.address && typeof entity.address === "object") {
      const addr = entity.address as any;
      return {
        streetAddress: addr.streetAddress,
        postalCode: addr.postalCode,
        addressLocality: addr.addressLocality
      };
    }
    return null;
  };

  const getOrganizer = () => {
    if (hasProperty(entity, "organizer") && entity.organizer && typeof entity.organizer === "object") {
      const organizerId = Object.keys(entity.organizer)[0];
      return (entity.organizer as any)[organizerId];
    }
    return null;
  };

  const getName = () => {
    return hasProperty(entity, "name") && typeof entity.name === "string" ? entity.name : "Sans nom";
  };

  const getBannerUrl = () => {
    if (hasProperty(entity, "profilBannerUrl") && entity.profilBannerUrl) {
      return `${entity.profilBannerUrl}`;
    }
    if (hasProperty(entity, "profilRealBannerUrl") && entity.profilRealBannerUrl) {
      return `${entity.profilRealBannerUrl}`;
    }
    return null;
  };

  const getTags = (): string[] => {
    if (hasProperty(entity, "tags") && Array.isArray(entity.tags)) {
      return entity.tags.filter((tag): tag is string => typeof tag === "string");
    }
    return [];
  };

  const getBadges = () => {
    if (hasProperty(entity, "badges") && entity.badges && typeof entity.badges === "object") {
      return Object.values(entity.badges).filter((badge: any) =>
        badge && typeof badge === "object" && badge.show !== "false"
      );
    }
    return [];
  };

  const getMembers = () => {
    if (hasProperty(entity, "links") && entity.links && typeof entity.links === "object") {
      const links = entity.links as any;
      if (links.members && typeof links.members === "object") {
        return Object.keys(links.members).length;
      }
    }
    return null;
  };

  const getProjects = () => {
    if (hasProperty(entity, "links") && entity.links && typeof entity.links === "object") {
      const links = entity.links as any;
      if (links.projects && typeof links.projects === "object") {
        return Object.keys(links.projects).length;
      }
    }
    return null;
  };

  const getOpeningHours = () => {
    if (hasProperty(entity, "openingHours") && Array.isArray(entity.openingHours)) {
      return entity.openingHours;
    }
    return null;
  };

  const imageUrl = getLogoUrl();
  const logoUrl = getLogoUrl();
  const bannerUrl = getBannerUrl();
  const address = getAddress();
  const organizer = getOrganizer();
  const entityName = getName();
  const tags = getTags();
  const badges = getBadges();
  const membersCount = getMembers();
  const projectsCount = getProjects();
  const openingHours = getOpeningHours();
  console.log(imageUrl)

  return (
    <div className="bg-white -m-4 md:-m-8">
      <div className="w-full mx-auto bg-white shadow-sm">
        <div className="relative h-96 bg-cover bg-center rounded-md border-gray-200 border" style={{ backgroundImage: bannerUrl ? `url('${bannerUrl}')` : `url('${imageUrl}')` }}>
          <div className="absolute bottom-6 right-6 z-20">
            <button className="bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-md border border-gray-200">
              <ImageIcon className="w-4 h-4" />
              Afficher toutes les photos
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
                    {hasProperty(entity, "email") && typeof entity.email === "string" && entity.email && (
                      <button
                        onClick={() => window.location.href = `mailto:${entity.email}`}
                        className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 bg-white text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-sm"
                      >
                        <Mail className="w-4 h-4" />
                        Envoyer un email
                      </button>
                    )}
                    <button
                      className="px-5 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 flex items-center gap-2 shadow-sm"
                    >
                      Espace Réservation
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
                À propos
              </TabsTrigger>
              <TabsTrigger
                value="news"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                Actualités
              </TabsTrigger>
              <TabsTrigger
                value="coworking"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                Coworking
              </TabsTrigger>
              <TabsTrigger
                value="rooms"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                Salles de réunions
              </TabsTrigger>
              <TabsTrigger
                value="infos"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                Infos pratiques
              </TabsTrigger>
              <TabsTrigger
                value="communities"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                Communautés
              </TabsTrigger>
              <TabsTrigger
                value="observatory"
                className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900"
              >
                Observatoires
              </TabsTrigger>
            </TabsList>

            <TabsContent value="about">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
              {hasProperty(entity, "startDate") && typeof entity.startDate === "string" && entity.startDate && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <span className="inline-block w-2 h-2 bg-teal-500 rounded-full"></span>
                    {hasProperty(entity, "type") && typeof entity.type === "string" && entity.type && (
                      <span className="capitalize">{entity.type}</span>
                    )}
                  </div>
                  <div className="text-gray-900">
                    <strong>Date:</strong> {formatDate(entity.startDate)}
                    {hasProperty(entity, "endDate") && typeof entity.endDate === "string" && entity.endDate && (
                      <> - {formatDate(entity.endDate)}</>
                    )}
                  </div>
                </div>
              )}

              {hasProperty(entity, "shortDescription") && typeof entity.shortDescription === "string" && entity.shortDescription && (
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {entity.shortDescription}
                  </h3>
                </div>
              )}

              {hasProperty(entity, "description") && typeof entity.description === "string" && entity.description && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Description</h2>
                  <div className="text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 p-6 rounded-lg border border-gray-200">
                    {entity.description}
                  </div>
                </div>
              )}

              {organizer && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Organisé par</h2>
                  <div className="flex items-center gap-4 bg-white p-5 rounded-lg border border-gray-300 shadow-sm hover:border-teal-400 transition-colors">
                    {organizer.profilThumbImageUrl && (
                      <img
                        src={`${getBaseUrl()}${organizer.profilThumbImageUrl}`}
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
                          Voir le profil →
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
                    Badges
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {badges.map((badge: any, index) => (
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Tags</h2>
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Horaires d'ouverture</h2>
                  <div className="bg-white p-5 rounded-lg border border-gray-300 shadow-sm">
                    {openingHours.map((schedule: any, index) => (
                      <div key={index} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                        <span className="font-semibold text-gray-800">
                          {schedule.dayOfWeek}
                        </span>
                        <div className="text-gray-900 font-medium">
                          {schedule.hours && schedule.hours.length > 0 && (
                            schedule.hours.map((hour: any, hIndex: number) => (
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
                <h3 className="text-xl font-bold text-gray-900 mb-6">Informations</h3>

                {(membersCount !== null || projectsCount !== null) && (
                  <div className="space-y-4 mb-6 pb-6 border-b border-gray-300">
                    {membersCount !== null && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-teal-600" />
                          <span className="text-gray-700 font-medium">Membres</span>
                        </div>
                        <span className="font-bold text-gray-900 text-lg">{membersCount}</span>
                      </div>
                    )}
                    {projectsCount !== null && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-teal-600" />
                          <span className="text-gray-700 font-medium">Projets</span>
                        </div>
                        <span className="font-bold text-gray-900 text-lg">{projectsCount}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {hasProperty(entity, "username") && typeof entity.username === "string" && entity.username && (
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                      <span className="text-teal-600 font-semibold">@{entity.username}</span>
                    </div>
                  )}

                  {hasProperty(entity, "email") && typeof entity.email === "string" && entity.email && (
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <Mail className="w-5 h-5 text-teal-600 shrink-0" />
                      <span className="text-gray-800 break-all text-sm">{entity.email}</span>
                    </div>
                  )}

                  {hasProperty(entity, "mobile") && typeof entity.mobile === "string" && entity.mobile && (
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <Phone className="w-5 h-5 text-teal-600 shrink-0" />
                      <a href={`tel:${entity.mobile}`} className="text-gray-800 font-medium text-sm hover:text-teal-600">{entity.mobile}</a>
                    </div>
                  )}

                  {hasProperty(entity, "url") && typeof entity.url === "string" && entity.url && (
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <Globe className="w-5 h-5 text-teal-600 shrink-0" />
                      <a href={entity.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 break-all text-sm font-medium">
                        {entity.url.replace(/^https?:\/\//, '')}
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

                  {hasProperty(entity, "openingDate") && typeof entity.openingDate === "string" && entity.openingDate && (
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <Calendar className="w-5 h-5 text-teal-600 shrink-0" />
                      <span className="text-gray-800 text-sm font-medium">Ouvert depuis {entity.openingDate}</span>
                    </div>
                  )}

                  {hasProperty(entity, "externalLinkRegistration") && typeof entity.externalLinkRegistration === "string" && entity.externalLinkRegistration && (
                    <div className="mt-6 pt-6 border-t border-gray-300">
                      <Button
                        className="w-full bg-teal-500 hover:bg-teal-600"
                        onClick={() => window.open(entity.externalLinkRegistration as string, "_blank")}
                      >
                        Inscription
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
                  <p className="text-xl font-semibold text-gray-700 mb-2">Section Actualités</p>
                  <p className="text-gray-500">En construction</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="coworking">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Briefcase className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">Section Coworking</p>
                  <p className="text-gray-500">En construction</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rooms">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Users className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">Section Salles de réunions</p>
                  <p className="text-gray-500">En construction</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="infos">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <MapPin className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">Section Infos pratiques</p>
                  <p className="text-gray-500">En construction</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="communities">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Users className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">Section Communautés</p>
                  <p className="text-gray-500">En construction</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="observatory">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <Globe className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">Section Observatoires</p>
                  <p className="text-gray-500">En construction</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}