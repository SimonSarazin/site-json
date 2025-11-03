import type { SearchEntity } from "@/modules/search/schema";
import { Link } from "react-router";
import { Mail, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBaseUrl } from "@/lib/constant/common";

interface ProfileTemplateDefaultProps {
  entity: SearchEntity;
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
}: ProfileTemplateDefaultProps) {


  const hasProperty = <K extends string>(
    obj: any,
    key: K
  ): obj is Record<K, unknown> => {
    return key in obj;
  };

  const getLogoUrl = () => {
    const baseUrl = getBaseUrl();

    if (hasProperty(entity, "profilThumbImageUrl") && hasProperty(entity, "profilImageUrl") && entity.profilImageUrl) {
      return `${baseUrl}${entity.profilImageUrl}`;
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

  const imageUrl = getLogoUrl();
  const logoUrl = getLogoUrl();
  const address = getAddress();
  const organizer = getOrganizer();
  const entityName = getName();

  return (
    <div className="bg-gray-100 -m-4 md:-m-8">
      <div className="w-full mx-auto bg-white shadow-lg">
        <div className="relative h-96 bg-cover bg-center rounded-md" style={{ backgroundImage: `url('${imageUrl}')` }}>
          <div className="absolute bottom-6 right-6 z-20">
            <button className="bg-white text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center gap-2 shadow-md">
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

              <div className="flex gap-3 flex-wrap">
                {hasProperty(entity, "email") && typeof entity.email === "string" && entity.email && (
                  <button
                    onClick={() => window.location.href = `mailto:${entity.email}`}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Envoyer un email
                  </button>
                )}
                <button
                  className="px-5 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 flex items-center gap-2"
                >
                  Espace Réservation
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200"></div>

          <nav className="flex gap-8 mt-4 border-b border-gray-200">
            <a href="#" className="pb-3 border-b-2 border-teal-500 text-teal-600 font-medium">À propos</a>
            <a href="#" className="pb-3 text-gray-600 hover:text-gray-900">Actualités</a>
            <a href="#" className="pb-3 text-gray-600 hover:text-gray-900">Coworking</a>
            <a href="#" className="pb-3 text-gray-600 hover:text-gray-900">Salle de reunions</a>
            <a href="#" className="pb-3 text-gray-600 hover:text-gray-900">Infos pratiques</a>
            <a href="#" className="pb-3 text-gray-600 hover:text-gray-900">Communautes</a>
            <a href="#" className="pb-3 text-gray-600 hover:text-gray-900">Observatoires</a>
          </nav>
        </div>

        <div className="px-8 py-8">
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
                  <h3 className="text-2xl font-bold text-teal-600 mb-4">
                    {entity.shortDescription}
                  </h3>
                </div>
              )}

              {hasProperty(entity, "description") && typeof entity.description === "string" && entity.description && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">À propos</h2>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {entity.description}
                  </div>
                </div>
              )}

              {organizer && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Organisé par</h2>
                  <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    {organizer.profilThumbImageUrl && (
                      <img
                        src={`${getBaseUrl()}${organizer.profilThumbImageUrl}`}
                        alt={organizer.name || "Organisateur"}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900">{organizer.name || "Sans nom"}</h3>
                      {organizer.slug && (
                        <Link
                          to={`/@${organizer.slug}`}
                          className="text-teal-600 hover:text-teal-700 text-sm"
                        >
                          Voir le profil →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 sticky top-4">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Réserver en ligne</h3>

                <div className="space-y-4 mb-6 pb-6 border-b border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Membres</span>
                    <span className="font-bold text-gray-900">24</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Événements</span>
                    <span className="font-bold text-gray-900">12</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Projets</span>
                    <span className="font-bold text-gray-900">8</span>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  {hasProperty(entity, "email") && typeof entity.email === "string" && entity.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-600 shrink-0" />
                      <span className="text-gray-900 break-all">{entity.email}</span>
                    </div>
                  )}

                  {hasProperty(entity, "url") && typeof entity.url === "string" && entity.url && (
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                      </svg>
                      <a href={entity.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 break-all">
                        {entity.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}

                  {address && (
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-gray-600 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      </svg>
                      <div>
                        {address.streetAddress && <div className="text-gray-900">{address.streetAddress}</div>}
                        <div className="text-gray-900">
                          {address.postalCode} {address.addressLocality}
                        </div>
                      </div>
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
        </div>
      </div>
    </div>
  );
}