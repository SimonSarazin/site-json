import { useState, useMemo } from "react";
import { Plus, Building2, Briefcase, Calendar, MapPin } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AddConfig } from "../../schema";
import { AddOrganizationModal } from "../add/AddOrganizationModal";
import { AddProjectModal } from "../add/AddProjectModal";
import { AddEventModal } from "../add/AddEventModal";
import { AddPoiModal } from "../add/AddPoiModal";

type AddEntityType = "organization" | "project" | "event" | "poi";

interface AddEntityDropdownProps {
  entity: EntityTypes;
  config?: AddConfig;
  label?: string;
}

interface AddOption {
  type: AddEntityType;
  label: string;
  icon: typeof Building2;
}

/**
 * Dropdown pour créer des entités (organization, project, event, poi)
 *
 * Affiche uniquement les options autorisées selon :
 * 1. Le type d'entité courante (ex: sur une orga, on peut créer project/event/poi)
 * 2. Les permissions de l'utilisateur (admin, member, contributor, etc.)
 * 3. La configuration JSON (addConfig peut désactiver certains types)
 */
export function AddEntityDropdown({ entity, config, label }: AddEntityDropdownProps) {
  const permissions = useUserPermissions(entity);
  const t = useT("modules/profil");

  // État du modal ouvert
  const [openModal, setOpenModal] = useState<AddEntityType | null>(null);

  // Calcule les options disponibles
  const availableOptions = useMemo(() => {
    const options: AddOption[] = [];

    // Organization
    if (config?.organization !== false && permissions.canAddOrganization) {
      options.push({
        type: "organization",
        label: t("AddEntity.organization"),
        icon: Building2,
      });
    }

    // Project
    if (config?.project !== false && permissions.canAddProject) {
      options.push({
        type: "project",
        label: t("AddEntity.project"),
        icon: Briefcase,
      });
    }

    // Event
    if (config?.event !== false && permissions.canAddEvent) {
      options.push({
        type: "event",
        label: t("AddEntity.event"),
        icon: Calendar,
      });
    }

    // POI
    if (config?.poi !== false && permissions.canAddPoi) {
      options.push({
        type: "poi",
        label: t("AddEntity.poi"),
        icon: MapPin,
      });
    }

    return options;
  }, [permissions, config, t]);

  // Ne rien afficher si aucune option disponible
  if (availableOptions.length === 0) {
    return null;
  }

  const handleOpenModal = (type: AddEntityType) => {
    setOpenModal(type);
  };

  const handleCloseModal = () => {
    setOpenModal(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            {label || t("AddEntity.create")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableOptions.map((option) => (
            <DropdownMenuItem
              key={option.type}
              onClick={() => handleOpenModal(option.type)}
            >
              <option.icon className="w-4 h-4 mr-2" />
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modals */}
      <AddOrganizationModal
        open={openModal === "organization"}
        onOpenChange={(open) => !open && handleCloseModal()}
      />
      <AddProjectModal
        open={openModal === "project"}
        onOpenChange={(open) => !open && handleCloseModal()}
        parent={entity}
      />
      <AddEventModal
        open={openModal === "event"}
        onOpenChange={(open) => !open && handleCloseModal()}
        parent={entity}
      />
      <AddPoiModal
        open={openModal === "poi"}
        onOpenChange={(open) => !open && handleCloseModal()}
        parent={entity}
      />
    </>
  );
}
