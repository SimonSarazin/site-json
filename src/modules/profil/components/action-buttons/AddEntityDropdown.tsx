import { useState, useMemo } from "react";
import { Plus, Building2, Briefcase, Calendar, MapPin } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { useProfilePageIntent } from "../../hooks/useUrlIntent";
import { useSite } from "@/hooks/useSite";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AddConfig } from "../../schema";

import { DynamicModal } from "../add/ModalRegistry";
import { costumCreateKey, type AddEntityType, type CostumFormRef } from "../add/addModals";
import { useVisibilityList } from "@/lib/visibility";

type AddOpenState = AddEntityType | { kind: "custom"; modalKey: string } | null;

interface AddEntityDropdownProps {
  entity: EntityTypes;
  config?: AddConfig;
  label?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}

interface AddOption {
  type: AddEntityType;
  label: string;
  icon: typeof Building2;
  /** Modale ouverte par l'entrée : celle du type, ou le form COSTUM du site (cf. `costumCreateKey`). */
  modalKey: string;
}


/**
 * Dropdown pour créer des entités (organization, project, event, poi).
 *
 * Affiche uniquement les options autorisées selon :
 * 1. Le type d'entité courante (ex: sur une orga, on peut créer project/event/poi)
 * 2. Les permissions de l'utilisateur (admin, member, contributor, etc.)
 * 3. La configuration JSON (`addConfig` peut désactiver certains types)
 * 4. Les conditions `condition` (auth, routes, permissions) sur chaque item custom
 *
 * Si toutes les options sont filtrées (builtins + customs), le trigger lui-même
 * disparaît pour éviter d'ouvrir un menu vide.
 */
export function AddEntityDropdown({ entity, config, label, variant = "outline", size, className }: AddEntityDropdownProps) {
  const permissions = useProfilPermissions(entity);
  const t = useT("modules/profil");
  const { config: siteConfig } = useSite();
  const costumForms = (siteConfig as { costumForms?: Record<string, CostumFormRef> } | undefined)?.costumForms;
  const siteSlug = (useCocolight().entity as { slug?: string } | null)?.slug;

  // État du modal ouvert
  const [openModal, setOpenModal] = useState<AddOpenState>(null);

  // Items personnalisés issus de la config
  const customItems = useMemo(
    () => config?.custom ?? [],
    [config?.custom]
  );

  // Conditions de visibilité de chaque custom item, évaluées en une seule passe
  // (évite d'appeler un hook par item dans un .map() — rules of hooks).
  const customConditions = useMemo(
    () => customItems.map((item) => item.condition),
    [customItems]
  );
  const customVisibilities = useVisibilityList(customConditions);

  const visibleCustomItems = useMemo(
    () => customItems.filter((_, idx) => customVisibilities[idx]),
    [customItems, customVisibilities]
  );

  // Calcule les options "builtins" disponibles (orga/projet/event/poi). Les GARDES de permission sont
  // inchangées — seule la modale ouverte peut être celle du costum du site.
  const availableOptions = useMemo(() => {
    const options: AddOption[] = [];
    const modal = (type: AddEntityType) => costumCreateKey(type, costumForms, siteSlug) ?? `add-${type}`;

    if (config?.organization !== false && permissions.canAddOrganization) {
      options.push({ type: "organization", label: t("AddEntity.organization"), icon: Building2, modalKey: modal("organization") });
    }
    if (config?.project !== false && permissions.canAddProject) {
      options.push({ type: "project", label: t("AddEntity.project"), icon: Briefcase, modalKey: modal("project") });
    }
    if (config?.event !== false && permissions.canAddEvent) {
      options.push({ type: "event", label: t("AddEntity.event"), icon: Calendar, modalKey: modal("event") });
    }
    if (config?.poi !== false && permissions.canAddPoi) {
      options.push({ type: "poi", label: t("AddEntity.poi"), icon: MapPin, modalKey: modal("poi") });
    }

    return options;
  }, [permissions, config, t, costumForms, siteSlug]);

  // `?ajouter=<type>` dans l'URL de la fiche (lien posé par un site tiers, cf. doc/08) : la modale
  // de création de ce type s'ouvre directement — si et seulement si l'option figure dans le menu,
  // donc avec les MÊMES gardes de permission qu'un clic. Sans droit, rien ne s'ouvre. Ouverture
  // DÉRIVÉE (clic, sinon URL), jamais posée par un effet ; le paramètre part à la fermeture.
  const ajouter = useProfilePageIntent("ajouter", entity);
  const fromUrl = ajouter.value !== null ? availableOptions.find((o) => o.type === ajouter.value) ?? null : null;
  const currentModal: AddOpenState = openModal ?? fromUrl?.type ?? null;

  // Ne rien afficher si aucune option n'est visible (ni builtin, ni custom).
  if (availableOptions.length === 0 && visibleCustomItems.length === 0) {
    return null;
  }

  const handleCloseModal = () => {
    setOpenModal(null);
    if (fromUrl) ajouter.clear();
  };

  const isCustomOpen = (modalKey: string) =>
    typeof currentModal === "object" && currentModal !== null && currentModal.modalKey === modalKey;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className={className}>
            <Plus />
            <span className="hidden sm:inline">{label || t("AddEntity.create")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableOptions.map((option) => (
            <DropdownMenuItem
              key={option.type}
              onClick={() => setOpenModal(option.type)}
            >
              <option.icon />
              {option.label}
            </DropdownMenuItem>
          ))}
          {visibleCustomItems.map((item) => (
            <DropdownMenuItem
              key={item.modalKey}
              onClick={() => setOpenModal({ kind: "custom", modalKey: item.modalKey })}
            >
              <DynamicIcon name={(item.icon ?? "plus") as IconName} className="w-4 h-4" />
              {t(item.label)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modals builtins — via ModalRegistry (add-organization/project/event/poi = modals génériques formEngine). */}
      {typeof currentModal === "string" && (
        <DynamicModal
          modalName={availableOptions.find((o) => o.type === currentModal)?.modalKey ?? `add-${currentModal}`}
          open
          onOpenChange={(open) => !open && handleCloseModal()}
          parent={entity}
        />
      )}

      {/* Modals customs (seulement ceux dont la condition est satisfaite) */}
      {visibleCustomItems.map((item) => (
        <DynamicModal
          key={item.modalKey}
          modalName={item.modalKey}
          open={isCustomOpen(item.modalKey)}
          onOpenChange={(open) => !open && handleCloseModal()}
          parent={entity}
        />
      ))}
    </>
  );
}
