import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Edit, Mail, ChevronRight, ImageIcon } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../../hooks/useProfileEntity";
import { buildProfileTabUrl } from "../../../hooks/useNewsDetailUrlGenerator";
import { useSite } from "@/hooks/useSite";
import { Link } from "react-router";
import { useProfilPermissions } from "../../../hooks/useProfilPermissions";
import { DynamicEditModal } from "../../profile-edit/EditModalRegistry";
import { ProfileImageUpload } from "../../profile-edit/ProfileImageUpload";
import { EntityActionButtons } from "../../EntityActionButtons";
import { AddEntityDropdown } from "../../action-buttons/AddEntityDropdown";
import { isUser } from "@/lib/getTypedEntity";
import type { ProfileHeaderSection } from "../../../schema";
import { ButtonGroup } from "@/components/ui/button-group";
import { useInteropConfig } from "@/modules/interop";
import { lazy } from "vite-preload";

// CTA « Envoyer un message » (Discourse) promu en haut du profil, façon LinkedIn.
// Chargé en lazy et conditionné à `hasDiscourse` comme dans ProfileAbout.
const DiscourseMessageButton = lazy(
  () => import("@/modules/interop/components/DiscourseMessageButton"),
);

interface ProfileHeaderCompleteProps {
  section: ProfileHeaderSection;
}

export function ProfileHeaderComplete({ section }: ProfileHeaderCompleteProps) {
  const { entity } = useProfileEntity();
  const t = useT("modules/profil");
  const {
    imageUrl,
    logoUrl,
    logoThumbUrl,
    bannerUrl,
    name: entityName,
    address,
  } = useFormatProfileEntity(entity);
  const { canEditProfile } = useProfilPermissions(entity);
  const { config: siteConfig } = useSite();
  const { hasDiscourse } = useInteropConfig();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!entity) return null;

  const effectiveLogoUrl = imageError ? logoThumbUrl : logoUrl;

  // « Voir toutes les photos » : on n'affiche le bouton que si le type de profil a
  // un onglet `gallery` configuré (sinon le garde-fou de ProfileTemplateDynamic
  // redirigerait vers l'onglet par défaut). Le lien pointe vers cet onglet ; son
  // contenu (section `profile-gallery`) reste à implémenter.
  const galleryHref = buildProfileTabUrl(siteConfig, entity, (tab) => tab.id === "gallery");
  const showGalleryButton = !!galleryHref && section.showAllPhotosButton !== false;

  return (
    <>
      {/* Banner */}
      {section.showBanner !== false && (
        <div className="relative h-96 rounded-md border-border border group overflow-hidden bg-muted">
          {/* Image de bannière avec object-fit cover (meilleur LCP que background-image) */}
          {(bannerUrl || imageUrl) && (
            <OptimizedImage
              src={bannerUrl || imageUrl || ""}
              alt={`${entityName} banner`}
              width={1200}
              priority
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Bouton d'upload de bannière */}
          {canEditProfile && section.allowUpload !== false && entity && (
            <div className="absolute inset-0 z-10">
              <ProfileImageUpload
                entity={entity}
                type="banner"
                currentUrl={bannerUrl || imageUrl}
                className="w-full h-full"
                overlayOnly={true}
              />
            </div>
          )}

          {showGalleryButton && galleryHref && (
            <div className="absolute bottom-6 right-6 z-20">
              <Button asChild>
                <Link to={galleryHref}>
                  <ImageIcon className="w-4 h-4" />
                  {t("ProfileTemplateDefault.showAllPhotos")}
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Avatar + Name + Actions */}
      <div className="relative px-4 sm:px-6 pb-6">
        {/* Mobile : empilé + centré (avatar au-dessus, nom/actions dessous).
            ≥ sm : rangée avatar-gauche / nom-droite (layout desktop d'origine). */}
        <div className="flex flex-col items-center text-center -mt-16 gap-4 sm:flex-row sm:items-end sm:text-left sm:-mt-20 sm:gap-6">
          {/* Avatar */}
          {section.showAvatar !== false && (
            <div className="relative group z-20">
              <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full border-4 border-background bg-card shadow-xl overflow-hidden">
                {effectiveLogoUrl ? (
                  <OptimizedImage
                    src={effectiveLogoUrl}
                    alt={entityName}
                    width={160}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/80">
                    <div className="text-center p-2">
                      <div className="text-4xl mb-1">{entityName.charAt(0).toUpperCase()}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bouton d'upload d'avatar */}
              {canEditProfile && section.allowUpload !== false && entity && (
                <div className="absolute inset-0 rounded-full">
                  <ProfileImageUpload
                    entity={entity}
                    type="profile"
                    currentUrl={effectiveLogoUrl}
                    overlayOnly={true}
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>
          )}

          <div className="w-full flex-1 min-w-0 flex flex-col items-center gap-4 pb-2 sm:flex-row sm:justify-between sm:items-end">
            {/* Nom + Localisation */}
            <div className="min-w-0 max-w-full">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 break-words">{entityName}</h1>
              {section.showLocation !== false && address && (
                <p className="text-muted-foreground">
                  {address.addressLocality}
                  {address.postalCode && `, ${address.postalCode}`}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {section.showActions !== false && (
              <div className="flex gap-3 flex-wrap">
                {/* CTA principal « Envoyer un message » (Discourse), en tête de la
                    barre d'actions pour une visibilité façon LinkedIn/Messenger.
                    Suspense local : le chunk lazy ne refait pas suspendre tout le header. */}
                {hasDiscourse && (
                  <Suspense fallback={null}>
                    <DiscourseMessageButton />
                  </Suspense>
                )}

                <ButtonGroup>
                
                {/* Boutons d'action (Follow, Friend, Membership, etc.) */}
                <EntityActionButtons entity={entity} />

                {canEditProfile && (
                  <Button
                    variant="outline"
                    onClick={() => setEditModalOpen(true)}
                  >
                    <Edit />
                    <span className="hidden sm:inline">{t("ProfileTemplateDefault.editProfile")}</span>
                  </Button>
                )}


                {/* Dropdown pour créer des entités */}
                {section.showAddDropdown !== false && (
                  <AddEntityDropdown
                    entity={entity}
                    config={section.addConfig}
                    label={section.addDropdownLabel ? t(section.addDropdownLabel) : undefined}
                  />
                )}
                </ButtonGroup>

                {!isUser(entity) && (
                  <>
                    {section.showEmailButton !== false && entity.serverData?.email && typeof entity.serverData.email === "string" && (
                      <Button variant="outline" asChild>
                        <a href={`mailto:${entity.serverData.email}`}>
                          <Mail />
                          <span className="hidden sm:inline">{t("ProfileTemplateDefault.sendEmail")}</span>
                        </a>
                      </Button>
                    )}
                    {section.showReservationButton && (
                      <Button className="bg-primary hover:bg-primary/90">
                        <span className="hidden sm:inline">{t("ProfileTemplateDefault.reservationSpace")}</span>
                        <ChevronRight />
                      </Button>
                    )}
                  </>
                )}
                
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        {/* <div className="mt-6 border-t border-border"></div> */}
      </div>

      {/* Edit Modal */}
      {canEditProfile && entity && (
        <DynamicEditModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          entity={entity}
        />
      )}
    </>
  );
}

export default ProfileHeaderComplete;
