import { useId, useState, type ReactNode, type SyntheticEvent } from "react";
// Import de TYPE seulement : la carte reste un composant de rendu, le glisser est branché par
// la colonne (`DraggableMemberCard`).
import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import { Ban, Building2, Check, Clock, GripVertical, ShieldCheck, Tags, UserMinus, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ActionMenu } from "@/modules/kanban/components/ui/ActionMenu";
import { MemberAvatar } from "@/modules/kanban/components/ui/MemberAvatar";
import { Pill } from "@/modules/kanban/components/ui/Pill";
import { stopTouchOnControls } from "@/modules/kanban/components/ui/touchControls";
import type { RoleMember } from "@/modules/kanban/types";
import { memberKey, type DropOutcome } from "./rolesBoard";

/**
 * Deux formes d'une même carte (DESIGN §6.6 de co-kanban) :
 *  - `member`, dans « Membres » : la fiche complète — portrait 32 px, nom, badges, la ligne de
 *    ses rôles — et la PRISE du glisser ;
 *  - `holder`, dans une colonne de rôle : la fiche courte — portrait 24 px, nom, badges — et
 *    « Retirer le rôle ». Jamais saisissable (D27 : on retire un rôle, on ne le glisse pas).
 */
export type MemberCardVariant = "member" | "holder";

export interface MemberCardProps {
  member: RoleMember;
  variant: MemberCardVariant;
  /** Colonne de rôle (variante `holder`) : le rôle que la carte porte ici. */
  role?: string;
  /** `canManageRoles` : prise, menu « Rôles… », bouton de retrait. */
  canManage?: boolean;
  /** Aperçu tenu par le `DragOverlay` : soulevé, et marqué de l'issue du lâcher (`outcome`). */
  lifted?: boolean;
  /** Avec `lifted` : ce que le lâcher produirait sur la colonne survolée. */
  outcome?: DropOutcome["kind"];
  /** Fantôme : la place que la carte prendrait si on la lâchait ici. */
  ghost?: boolean;
  /** Pendant un glisser, la carte est la SOURCE de la copie : elle reste, et le dit. */
  dragSource?: boolean;
  /** Pendant un glisser, le membre tenu porte DÉJÀ le rôle de cette colonne. */
  alreadyHeld?: boolean;
  onOpenRoles?: (member: RoleMember) => void;
  onRemoveRole?: (member: RoleMember, role: string) => void;
  /** Prise au POINTEUR (souris, doigt), posée par `useDraggable` dans la colonne. */
  dragRef?: (node: HTMLElement | null) => void;
  dragListeners?: DraggableSyntheticListeners;
  className?: string;
}

/*
 * Les commandes de la carte (menu, retrait) ne doivent pas amorcer un glisser : la fiche
 * entière est la prise, et un appui sur « ⋯ » la saisirait. Leurs événements de pointeur
 * s'arrêtent à leur conteneur ; au doigt, seulement quand il est vraiment dessus.
 */
function stopAtActions(event: SyntheticEvent) {
  event.stopPropagation();
}

/**
 * Drapeaux d'un membre, EN TOUTES LETTRES et avec un pictogramme : « Admin », « En attente »,
 * « Organisation ». La couleur n'est jamais seule.
 */
function MemberBadges({ member, alreadyHeld = false }: { member: RoleMember; alreadyHeld?: boolean }) {
  const { t } = useTranslation("modules/kanban");
  if (!member.isAdmin && !member.pending && member.type !== "organizations" && !alreadyHeld) return null;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {member.type === "organizations" ? (
        <Pill tone="neutral" icon={Building2}>
          {t("views.roles.organization")}
        </Pill>
      ) : null}
      {member.isAdmin ? (
        <Pill tone="info" icon={ShieldCheck}>
          {t("views.roles.admin")}
        </Pill>
      ) : null}
      {member.pending ? (
        <Pill tone="warn" icon={Clock}>
          {t("views.roles.pending")}
        </Pill>
      ) : null}
      {alreadyHeld ? (
        // Pendant le glisser seulement : la colonne refuse le dépôt, et la carte dit pourquoi.
        <Pill tone="brand" icon={Check}>
          {t("views.roles.alreadyHolds")}
        </Pill>
      ) : null}
    </span>
  );
}

export function MemberCard({
  member,
  variant,
  role,
  canManage = false,
  lifted = false,
  outcome = "none",
  ghost = false,
  dragSource = false,
  alreadyHeld = false,
  onOpenRoles,
  onRemoveRole,
  dragRef,
  dragListeners,
  className,
}: MemberCardProps) {
  const { t } = useTranslation("modules/kanban");
  const nameId = useId();
  const draggable = variant === "member" && canManage && !ghost && !lifted;
  // La ligne des rôles portés : c'est elle qui change quand un dépôt réussit, puisque la carte
  // reste dans « Membres » (glisser = copie, D27).
  const rolesLine = variant === "member" && member.roles.length > 0 ? member.roles.join(" · ") : null;

  let actions: ReactNode = null;
  if (canManage && !ghost && !lifted) {
    if (variant === "member" && onOpenRoles) {
      actions = (
        <ActionMenu
          label={t("views.roles.memberMenu", { name: member.name })}
          triggerSize="sm"
          sections={[{ key: "roles", items: [{ key: "roles", icon: Tags, label: t("views.roles.rolesMenu"), onSelect: () => onOpenRoles(member) }] }]}
        />
      );
    } else if (variant === "holder" && role !== undefined && onRemoveRole) {
      actions = <RemoveRoleButton member={member} role={role} onRemove={onRemoveRole} />;
    }
  }

  return (
    <article
      ref={dragRef}
      {...(draggable ? dragListeners : undefined)}
      aria-labelledby={nameId}
      aria-hidden={ghost || undefined}
      // Repère du retour de focus après la boîte « Rôles… » (`memberMenuIn`) : la carte de
      // « Membres » seulement, la seule qui porte ce menu.
      data-member-card={variant === "member" && !ghost && !lifted ? memberKey(member) : undefined}
      className={cn(
        "relative flex items-start gap-2.5 rounded-xl border bg-card text-card-foreground",
        variant === "member" ? "p-[var(--ck-card-padding)]" : "px-[var(--ck-card-padding)] py-2",
        "transition-[border-color,box-shadow,opacity] duration-[var(--ck-duration-out)] ease-in",
        // La fiche entière s'attrape ; `touch-manipulation` retire le délai du double-tap sans
        // bloquer le défilement du doigt (appui long, cf. `RolesBoard`). Ni sélection ni
        // « callout » : l'appui long est aussi leur geste.
        draggable ? "cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] active:cursor-grabbing" : null,
        // Source d'une copie en cours : elle reste en place et prend la couleur de la cible.
        dragSource ? "border-primary" : "border-border",
        // Aperçu soulevé : hors de la pile, agrandi, ombre haute.
        lifted && "scale-[1.02] border-primary shadow-[var(--ck-shadow-drag)]",
        // Fantôme : pointillé sur teinte, en retrait — un emplacement, pas une carte.
        ghost && "pointer-events-none border-dashed border-primary bg-primary/10 opacity-80",
        className,
      )}
    >
      {draggable ? (
        // Poignée DÉCORATIVE : la fiche entière est la prise, et le clavier passe par « Rôles… ».
        <GripVertical aria-hidden className="mt-2 size-4 shrink-0 text-muted-foreground" />
      ) : null}

      <MemberAvatar name={member.name} src={member.image} size={variant === "member" ? "md" : "sm"} />

      <div className="min-w-0 flex-1 self-center">
        <p id={nameId} className={cn("truncate text-sm text-foreground", variant === "member" ? "font-semibold" : "font-medium")}>
          {member.name}
        </p>
        <MemberBadges member={member} alreadyHeld={alreadyHeld} />
        {rolesLine !== null ? (
          <p className="mt-1 truncate text-xs text-muted-foreground" title={rolesLine}>
            {rolesLine}
          </p>
        ) : null}
      </div>

      {lifted ? (
        /*
         * L'aperçu dit l'ISSUE du lâcher : « Attribuer » tant qu'une colonne peut recevoir,
         * « Déjà ce rôle » dès que la colonne survolée refuse. Décoratif : la région vivante de
         * dnd-kit porte déjà ces mots.
         */
        <span aria-hidden className="shrink-0 self-center">
          {outcome === "alreadyHeld" ? (
            <Pill tone="neutral" icon={Ban}>
              {t("views.roles.alreadyHolds")}
            </Pill>
          ) : (
            <Pill tone="brand" icon={UserPlus}>
              {t("views.roles.assign")}
            </Pill>
          )}
        </span>
      ) : null}

      {actions ? (
        <div className="-mt-1 -mr-1 shrink-0 self-start" onMouseDown={stopAtActions} onTouchStart={stopTouchOnControls} onPointerDown={stopAtActions}>
          {actions}
        </div>
      ) : null}
    </article>
  );
}

/**
 * « Retirer le rôle » depuis une colonne de rôle, avec confirmation en popover : le retrait est
 * une écriture sur Communecter, un appui malheureux ne doit pas suffire.
 */
function RemoveRoleButton({ member, role, onRemove }: { member: RoleMember; role: string; onRemove: (member: RoleMember, role: string) => void }) {
  const { t } = useTranslation("modules/kanban");
  const [open, setOpen] = useState(false);
  const label = t("views.roles.removeRoleLabel", { role, name: member.name });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground pointer-coarse:size-11">
          <UserMinus aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={label} className="w-72">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{t("views.roles.removeRoleConfirm", { role, name: member.name })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                // Le popover rend d'abord le focus à son bouton ; la carte part ensuite
                // (optimiste), et la colonne reprend le focus (`RolesBoard`).
                setOpen(false);
                onRemove(member, role);
              }}
            >
              <UserMinus aria-hidden />
              {t("views.roles.removeRole")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
