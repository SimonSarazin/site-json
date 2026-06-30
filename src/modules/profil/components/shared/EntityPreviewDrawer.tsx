import { Suspense, useState } from "react";
import { lazy } from "vite-preload";
import CustomDrawer from "@/components/layout/CustomDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Mail, MapPin } from "lucide-react";
import type { EntityTypes, SearchEntity } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { getEntityIcon } from "@/lib/entityIcons";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { DynamicEditModal } from "../profile-edit/EditModalRegistry";

const ProfileMapWrapper = lazy(() => import("../sections/ProfileMapWrapper"));

interface EntityPreviewDrawerProps {
  entity: EntityTypes;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Aperçu « léger actionnable » d'une entité SANS slug (POI importés notamment),
 * affiché en drawer faute de page profil `/profil/:slug`.
 *
 * Vue id-based : elle offre les MÊMES fonctions clés que le profil slugué — Édition
 * (si `canEditProfile`, c.-à-d. auteur d'un POI / admin d'une org) via le MÊME
 * `DynamicEditModal`, et Email — plus infos + carte. Ne dépend ni du slug ni de
 * `ProfileEntityProvider`.
 */
export function EntityPreviewDrawer({ entity, open, onOpenChange }: EntityPreviewDrawerProps) {
  const t = useT("modules/profil");
  const { canEditProfile } = useProfilPermissions(entity);
  // `EntityTypes` est un sous-ensemble de `SearchEntity` au runtime (mêmes serverData/geo/address).
  const { geo, address } = useFormatProfileEntity(entity as unknown as SearchEntity);
  const [editOpen, setEditOpen] = useState(false);

  const sd = entity.serverData;
  const type = entity.getEntityType?.() || "";
  const name = (typeof sd?.name === "string" && sd.name) || t("common.untitled");
  const description =
    (typeof sd?.shortDescription === "string" && sd.shortDescription) ||
    (typeof sd?.description === "string" && sd.description) ||
    "";
  const imageUrl = typeof sd?.profilImageUrl === "string" ? sd.profilImageUrl : undefined;
  const email = typeof sd?.email === "string" ? sd.email : null;

  const typeLabel = (() => {
    switch (type) {
      case "organizations":
        return t("MembershipTab.organization");
      case "projects":
        return t("MembershipTab.project");
      case "poi":
        return t("MembershipTab.poi");
      case "events":
        return t("MembershipTab.event");
      default:
        return type;
    }
  })();

  const lat = geo?.latitude != null ? parseFloat(String(geo.latitude)) : NaN;
  const lng = geo?.longitude != null ? parseFloat(String(geo.longitude)) : NaN;
  const hasMap = !Number.isNaN(lat) && !Number.isNaN(lng);

  const locality = address?.addressLocality
    ? `${address.addressLocality}${address.postalCode ? `, ${address.postalCode}` : ""}`
    : null;

  return (
    <CustomDrawer
      isOpenDrawer={open}
      openAndCloseDrawer={() => onOpenChange(false)}
      direction="right"
      overflowType="overflow-y-auto"
    >
      <div className="p-4 space-y-4">
        {/* En-tête : image + nom + type + localité */}
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted shrink-0">
            {imageUrl ? (
              <OptimizedImage src={imageUrl} alt={name} width={64} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {getEntityIcon(type, { className: "w-6 h-6", withColor: true })}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{name}</h2>
            <Badge variant="secondary" className="text-xs mt-1">{typeLabel}</Badge>
            {locality && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="w-3 h-3" />
                <span>{locality}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions id-based : Édition (auteur/admin) + Email */}
        {(canEditProfile || email) && (
          <div className="flex flex-wrap gap-2">
            {canEditProfile && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Edit className="w-4 h-4 mr-1" />
                {t("ProfileTemplateDefault.editProfile")}
              </Button>
            )}
            {email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${email}`}>
                  <Mail className="w-4 h-4 mr-1" />
                  {t("ProfileTemplateDefault.sendEmail")}
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground whitespace-pre-line">{description}</p>
        )}

        {/* Carte (POI = lieu) */}
        {hasMap && (
          <Suspense fallback={<Skeleton className="w-full h-48 rounded-lg" />}>
            <ProfileMapWrapper lat={lat} lng={lng} height="200px" zoom={15} showMarker />
          </Suspense>
        )}
      </div>

      {/* Modal d'édition (le MÊME que le profil) — id-based, pas de slug requis */}
      {canEditProfile && (
        <DynamicEditModal open={editOpen} onOpenChange={setEditOpen} entity={entity} />
      )}
    </CustomDrawer>
  );
}

export default EntityPreviewDrawer;
