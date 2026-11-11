import { useId, useState } from "react";
import { Search, TriangleAlert, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChoiceRow } from "@/modules/kanban/components/ui/ChoiceRow";
import { MemberAvatar } from "@/modules/kanban/components/ui/MemberAvatar";
import { linkParentType } from "@/modules/kanban/lib/boardSource";
import { memberDisplayName, memberRoleLabelKey } from "@/modules/kanban/lib/memberName";
import type { BoardSource, Member, ParentType } from "@/modules/kanban/types";
import { orphanAssignees } from "./cardForm";

/** Au-delà de ce seuil, chercher devient plus rapide que parcourir. */
const FILTER_THRESHOLD = 6;

export interface AssigneePickerProps {
  /** Membres du tableau : RG-19, on n'assigne personne d'autre. */
  members: readonly Member[];
  value: readonly string[];
  onChange: (userIds: string[]) => void;
  source: BoardSource;
  /** Type de l'élément d'un tableau relié (`board.parentType`). */
  parentType: ParentType | null;
  disabled?: boolean;
  /** Message déjà traduit, affiché sous le groupe. */
  error?: string;
  className?: string;
}

/** Assignés de la fiche de carte, repris de co-kanban (`AssigneePicker`). */
export function AssigneePicker({ members, value, onChange, source, parentType, disabled = false, error, className }: AssigneePickerProps) {
  const { t } = useTranslation("modules/kanban");
  const [query, setQuery] = useState("");
  const filterId = useId();
  const errorId = useId();

  /*
   * Assignés ORPHELINS : sur la carte, mais plus parmi les membres — une action Communecter garde
   * souvent un participant parti ou en attente (le serveur le tolère tant qu'on ne l'AJOUTE pas).
   * Listés, cochés, pour qu'on puisse les retirer. Figés à l'ouverture : décocher puis recocher un
   * orphelin le remet tel quel (ce n'est pas un ajout, ni pour le front ni pour le serveur).
   */
  const [orphanIds] = useState(() => orphanAssignees(value, members));

  const selected = new Set(value);
  const normalized = query.trim().toLocaleLowerCase();
  const visible = normalized ? members.filter((member) => memberDisplayName(member.profile, member.userId).toLocaleLowerCase().includes(normalized)) : members;
  // « N sur M membres » ne compte que des membres : un orphelin coché faisait lire « 3 sur 2 ».
  const selectedMembers = members.filter((member) => selected.has(member.userId)).length;
  const linkType = linkParentType({ source, parentType });
  const orphanHint = t(linkType === null ? "assignees.orphanHint.kanban" : `assignees.orphanHint.communecter.${linkType}`);
  const unknownName = t("members.unknown");

  function toggle(userId: string) {
    onChange(selected.has(userId) ? value.filter((id) => id !== userId) : [...value, userId]);
  }

  return (
    <fieldset className={cn("min-w-0", className)} disabled={disabled}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <legend className="text-sm font-medium text-foreground">{t("assignees.label")}</legend>
        <span className="text-xs text-muted-foreground tabular-nums">{t("assignees.count", { count: selectedMembers, total: members.length })}</span>
      </div>

      {members.length > FILTER_THRESHOLD ? (
        <div className="relative mt-2">
          <label className="sr-only" htmlFor={filterId}>
            {t("assignees.filter")}
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id={filterId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("assignees.filterPlaceholder")} className="pl-9 pointer-coarse:h-11" />
        </div>
      ) : null}

      {members.length === 0 && orphanIds.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("assignees.noMember")}</p>
      ) : (
        <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
          {/* Les orphelins d'abord : c'est eux qu'on vient retirer. */}
          {orphanIds.map((userId) => (
            <li key={userId}>
              <ChoiceRow
                checked={selected.has(userId)}
                onChange={() => toggle(userId)}
                aria-describedby={error ? errorId : undefined}
                // Teinte d'ALERTE quand il est coché : un assigné qui n'est plus membre.
                className={selected.has(userId) ? "bg-warning/25" : undefined}
                leading={
                  /* Ni portrait ni initiales : le profil n'est plus connu, des initiales mentiraient. */
                  <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserX className="size-3.5" />
                  </span>
                }
              >
                <span className="block truncate">{unknownName}</span>
                <span className="block text-xs text-muted-foreground">{orphanHint}</span>
              </ChoiceRow>
            </li>
          ))}
          {visible.map((member) => {
            const name = memberDisplayName(member.profile, unknownName);
            return (
              <li key={member.userId}>
                <ChoiceRow
                  checked={selected.has(member.userId)}
                  onChange={() => toggle(member.userId)}
                  aria-describedby={error ? errorId : undefined}
                  leading={<MemberAvatar name={name} src={member.profile?.profilThumbImageUrl} size="sm" />}
                  trailing={t(memberRoleLabelKey(member.role, linkType))}
                >
                  <span className="block truncate">{name}</span>
                </ChoiceRow>
              </li>
            );
          })}
          {members.length > 0 && visible.length === 0 ? <li className="px-2 py-1.5 text-xs text-muted-foreground">{t("assignees.noMatch")}</li> : null}
        </ul>
      )}

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
