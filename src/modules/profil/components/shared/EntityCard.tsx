import { Building2, Briefcase, MapPin, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import { Link } from "react-router";
import type { EntityTypes } from "@communecter/cocolight-api-client";

export type EntityType = "organization" | "project" | "poi" | "event";

interface EntityCardProps {
  entity: EntityTypes;
  type: EntityType;
  showRole?: boolean;
  lastItemRef?: (node: HTMLDivElement | null) => void;
}

export function EntityCard({
  entity,
  type,
  showRole = false,
  lastItemRef,
}: EntityCardProps) {
  const t = useT("modules/profil");

  const getIcon = () => {
    switch (type) {
      case "organization":
        return <Building2 className="w-5 h-5 text-teal-600" />;
      case "project":
        return <Briefcase className="w-5 h-5 text-blue-600" />;
      case "poi":
        return <MapPin className="w-5 h-5 text-green-600" />;
      case "event":
        return <Calendar className="w-5 h-5 text-orange-600" />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case "organization":
        return t("MembershipTab.organization");
      case "project":
        return t("MembershipTab.project");
      case "poi":
        return t("MembershipTab.poi");
      case "event":
        return t("MembershipTab.event");
    }
  };

  return (
    <div
      ref={lastItemRef}
      className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        {/* Image/Logo */}
        <div className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted flex-shrink-0">
          {entity.serverData?.profilImageUrl ? (
            <img
              src={entity.serverData.profilImageUrl}
              alt={entity.serverData?.name || ""}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {getIcon()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-foreground truncate">
                  {entity.serverData?.name || t("common.untitled")}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {getTypeLabel()}
                </Badge>
              </div>

              {entity.serverData?.shortDescription && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {entity.serverData.shortDescription}
                </p>
              )}

              {/* Localisation */}
              {entity.serverData?.address?.addressLocality && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <MapPin className="w-3 h-3" />
                  <span>
                    {entity.serverData.address.addressLocality}
                    {entity.serverData.address.postalCode &&
                      `, ${entity.serverData.address.postalCode}`}
                  </span>
                </div>
              )}

              {/* Date pour les événements */}
              {type === "event" && entity.serverData?.startDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {new Date(entity.serverData.startDate).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Rôle de l'utilisateur (optionnel) */}
              {showRole && (
                <div className="flex items-center gap-2 text-xs">
                  {/* Admin badge - seulement pour organizations, projects, events */}
                  {type !== "poi" && entity.isAdmin?.() && (
                    <Badge
                      variant="outline"
                      className="text-teal-600 border-teal-600"
                    >
                      {t("MembershipTab.admin")}
                    </Badge>
                  )}

                  {/* Badges spécifiques selon le type d'entité */}
                  {type === "organization" && entity.isMember?.() && (
                    <Badge variant="outline">{t("MembershipTab.member")}</Badge>
                  )}
                  {type === "project" && entity.isContributor?.() && (
                    <Badge variant="outline">
                      {t("MembershipTab.contributor")}
                    </Badge>
                  )}
                  {type === "event" && entity.isAttendee?.() && (
                    <Badge variant="outline">
                      {t("MembershipTab.participant")}
                    </Badge>
                  )}
                  {type === "poi" && entity.isAuthor?.() && (
                    <Badge variant="outline">{t("MembershipTab.author")}</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/profil/${entity.slug}`}>
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">
                    {t("common.viewProfile")}
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper pour obtenir l'icône par type (utilisable dans EntityEmptyState)
export function getEntityIcon(type: EntityType, className = "w-12 h-12") {
  switch (type) {
    case "organization":
      return <Building2 className={`${className} mx-auto`} />;
    case "project":
      return <Briefcase className={`${className} mx-auto`} />;
    case "poi":
      return <MapPin className={`${className} mx-auto`} />;
    case "event":
      return <Calendar className={`${className} mx-auto`} />;
  }
}
