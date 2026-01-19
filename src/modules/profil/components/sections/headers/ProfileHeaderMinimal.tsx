import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../../hooks/useProfileEntity";
import { useProfilPermissions } from "../../../hooks/useProfilPermissions";
import { EditProfileModal } from "../../profile-edit/EditProfileModal";
import { EntityActionButtons } from "../../EntityActionButtons";
import { AddEntityDropdown } from "../../action-buttons/AddEntityDropdown";
import type { ProfileHeaderSection } from "../../../schema";

interface ProfileHeaderMinimalProps {
  section: ProfileHeaderSection;
}

/**
 * Variant Minimal - Design très épuré avec juste le nom et la description
 */
export function ProfileHeaderMinimal({ section }: ProfileHeaderMinimalProps) {
  const { entity } = useProfileEntity();
  const t = useT("modules/profil");
  const { name: entityName, shortDescription, address } = useFormatProfileEntity(entity);
  const { canEditProfile } = useProfilPermissions(entity);
  const [editModalOpen, setEditModalOpen] = useState(false);

  return (
    <>
      <div className="py-6 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
              {entityName}
            </h1>
            {shortDescription && (
              <p className="mt-1 text-muted-foreground">
                {shortDescription}
              </p>
            )}
            {section.showLocation !== false && address && (
              <p className="mt-1 text-sm text-muted-foreground">
                {address.addressLocality}
                {address.postalCode && ` (${address.postalCode})`}
              </p>
            )}

            {/* Action Buttons */}
            {section.showActions !== false && entity && (
              <div className="flex gap-3 flex-wrap mt-4">
                <EntityActionButtons entity={entity} />

                {section.showAddDropdown !== false && (
                  <AddEntityDropdown
                    entity={entity}
                    config={section.addConfig}
                    label={section.addDropdownLabel ? t(section.addDropdownLabel) : undefined}
                  />
                )}
              </div>
            )}
          </div>

          {canEditProfile && entity && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditModalOpen(true)}
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">{t("ProfileTemplateDefault.editProfile")}</span>
            </Button>
          )}
        </div>

        {/* Subtle separator */}
        <div className="mt-4 border-b border-border/50"></div>
      </div>

      {canEditProfile && entity && (
        <EditProfileModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          entity={entity}
        />
      )}
    </>
  );
}
