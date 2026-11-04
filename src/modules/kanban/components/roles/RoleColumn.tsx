import { useId, type ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Tag, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ColumnMenu } from '@/modules/kanban/components/board/ColumnMenu';
import { cn } from '@/lib/utils';
import type { RoleEntry, RoleMember } from '@/modules/kanban/types';
import { MemberCard } from './MemberCard';
import { memberDragId, memberKey, roleDropId, type MemberDragData, type MembersDropData, type RoleDropData } from './rolesBoard';

interface RoleColumnCommonProps {
  /** Cartes affichees (recherche appliquee), dans l'ordre des membres. */
  members: readonly RoleMember[];
  /** Effectif reel de la colonne, filtre ou non : la capsule de l'en-tete. */
  count: number;
  canManage: boolean;
  /** Une recherche est en cours : une colonne vide veut dire « rien ne correspond ». */
  filtering: boolean;
  /** Membre tenu pendant un glisser : marque sa carte source et les colonnes qui le portent deja. */
  activeMember: RoleMember | null;
}

/**
 * Deux colonnes, deux contrats (D27) : « Membres » est la SOURCE du glisser et
 * jamais une cible — ses cartes ouvrent « Rôles… » ; une colonne de role est
 * une cible et jamais une source — on y retire par la carte, on la supprime par
 * son menu. Les props sont DISCRIMINEES par `kind` : la source n'a pas a
 * fournir un gestionnaire de suppression de role qui n'aurait aucun sens pour elle.
 */
export type RoleColumnProps = RoleColumnCommonProps &
  (
    | {
        kind: 'members';
        /** Texte de la recherche, pour le dire quand « Membres » se vide. */
        query: string;
        onOpenRoles: (member: RoleMember) => void;
      }
    | {
        kind: 'role';
        role: RoleEntry;
        /** Depot ADMIS survole : index du fantome parmi les cartes affichees. */
        ghostAt: number | null;
        /** Depot REFUSE survole : le membre tenu porte deja ce role. */
        refusing: boolean;
        onRemoveRole: (member: RoleMember, role: string) => void;
        onDeleteRole: (role: RoleEntry) => void;
        /** Masque la colonne sur ce poste (D34) : offert a tous, lecture seule comprise — c'est une preference, pas une ecriture. */
        onHide: (role: RoleEntry) => void;
      }
  );

/* Zone de « Membres » : dite pour ce qu'elle est (`type: 'members'`), jamais un role au libelle vide. */
const MEMBERS_DROP_ID = 'members:column';
const MEMBERS_DROP_DATA: MembersDropData = { type: 'members' };

/**
 * Une colonne du kanban des roles (DESIGN §6.6 de co-kanban) : en-tete (pictogramme, titre,
 * capsule du compteur, menu « ⋯ » d'un role — le MEME menu que le Tableau, §6.3 :
 * « Masquer la colonne » pour tous, « Supprimer ce rôle » pour l'admin), pile
 * de cartes qui defile en interne des 768 px, et un vide qui dit ce qu'il faut
 * faire. « Membres » n'a pas de menu : la source ne se masque pas (D34).
 *
 * La colonne entiere est la zone de depot (`useDroppable` sur la section) :
 * une colonne vide, ou dont la pile est courte, doit accepter un membre lache
 * n'importe ou dans son cadre. Le hook est appele pour les deux sortes (regle
 * des hooks) ; « Membres » declare sa zone DESACTIVEE, et dnd-kit ne la
 * signale donc jamais comme cible.
 */
export function RoleColumn(props: RoleColumnProps) {
  const { members, count, canManage, filtering, activeMember } = props;
  const { t } = useTranslation('modules/kanban');
  const headingId = useId();
  const role = props.kind === 'role' ? props.role : null;
  const title = role === null ? t('views.roles.membersColumn') : role.name;

  const dropData: RoleDropData | MembersDropData = role === null ? MEMBERS_DROP_DATA : { type: 'role', role: role.name };
  const { setNodeRef } = useDroppable({
    id: role === null ? MEMBERS_DROP_ID : roleDropId(role.name),
    data: dropData,
    disabled: role === null || !canManage,
  });

  const ghostAt = props.kind === 'role' ? props.ghostAt : null;
  const accepting = ghostAt !== null && activeMember !== null;
  const refusing = props.kind === 'role' && props.refusing;
  const Icon = role === null ? Users : Tag;
  const isHeld = (member: RoleMember) => activeMember !== null && activeMember.id === member.id && activeMember.type === member.type;

  const cards: ReactNode[] = members.map((member) => (
    <li key={memberKey(member)} className="list-none">
      {props.kind === 'members' ? (
        <DraggableMemberCard member={member} canManage={canManage} dragSource={isHeld(member)} onOpenRoles={props.onOpenRoles} />
      ) : (
        <MemberCard
          member={member}
          variant="holder"
          role={props.role.name}
          canManage={canManage}
          alreadyHeld={props.refusing && isHeld(member)}
          onRemoveRole={props.onRemoveRole}
        />
      )}
    </li>
  ));
  if (ghostAt !== null && activeMember !== null) {
    // Le fantome prend la place qu'aurait la carte une fois le role attribue
    // (ordre des membres, D28) : ce que l'on voit au survol est ce que l'on aura.
    cards.splice(ghostAt, 0, <li key="ghost" className="list-none"><MemberCard member={activeMember} variant="holder" ghost /></li>);
  }

  const emptyText =
    props.kind === 'members'
      ? filtering
        ? t('views.roles.noMatch', { query: props.query.trim() })
        : t('views.roles.noMembers')
      : filtering
        ? t('views.roles.noMatchInColumn')
        : canManage
          ? t('views.roles.dropHint')
          : t('views.roles.noHolders');

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-role-column={role?.name}
      className={cn(
        // Remplissage TRANSLUCIDE comme les colonnes du tableau (DESIGN §6.3) :
        // la lueur du haut de page transparait. `relative` : bloc conteneur des
        // textes `sr-only`, qui restent dans la colonne.
        'relative flex min-h-32 w-full flex-col rounded-2xl border bg-[var(--ck-column-fill)]',
        'transition-[background-color,border-color] duration-[var(--ck-duration-out)] ease-in',
        // La cible admise se voit : sans retour visuel, on lache a l'aveugle. En
        // couleurs forcees, la teinte disparait : le filet passe a la couleur systeme.
        accepting ? 'border-primary bg-primary/10 forced-colors:border-[Highlight]' : refusing ? 'border-dashed border-[var(--ck-border-strong)]' : 'border-border',
      )}
    >
      <header className="flex h-[var(--ck-column-header)] shrink-0 items-center gap-2 pr-2 pl-[var(--ck-column-padding)]">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <h3 id={headingId} className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {title}
        </h3>
        {/* Compteur en capsule, encre du site sur la teinte de sa couleur primaire : les
            porteurs REELS, filtre ou non. */}
        <span className="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-semibold text-foreground tabular-nums">
          <span aria-hidden="true">{count}</span>
          <span className="sr-only">{t('views.roles.holderCount', { count })}</span>
        </span>
        {props.kind === 'role' ? (
          <ColumnMenu
            columnTitle={props.role.name}
            label={t('views.roles.columnMenu', { role: props.role.name })}
            onHide={() => props.onHide(props.role)}
            // La suppression est un geste de la VUE (`role/delete`), reserve a l'admin.
            extraItems={
              canManage
                ? [{ key: 'delete', icon: Trash2, label: t('views.roles.deleteRole'), danger: true, onSelect: () => props.onDeleteRole(props.role) }]
                : undefined
            }
          />
        ) : null}
      </header>

      <ul
        aria-label={props.kind === 'members' ? t('views.roles.membersList') : t('views.roles.holdersList', { role: props.role.name })}
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-[var(--ck-card-gap)] px-[var(--ck-column-padding)] pt-1 pb-3',
          // Defilement interne DES 768 PX seulement : en dessous, la page defile
          // (pile verticale). Le haut garde 4 px pour l'anneau de focus.
          // `overscroll-contain` protege molette et tactile du chainage vers la
          // rangee ; au clavier, c'est la rangee elle-meme qui est focalisable (`RolesBoard`).
          'md:overflow-y-auto md:overscroll-contain [scrollbar-color:var(--ck-scrollbar)_transparent] [scrollbar-width:thin]',
        )}
      >
        {cards.length === 0 ? (
          <li className="list-none">
            {/* Un vide sans issue est un cul-de-sac : la colonne dit s'il n'y a
                personne, si rien ne passe la recherche, ou ou deposer. */}
            <p className="rounded-xl border border-dashed border-[var(--ck-border-strong)] px-3 py-6 text-center text-xs text-muted-foreground">
              {emptyText}
              {props.kind === 'members' && !filtering ? <span className="mt-1 block">{t('views.roles.noMembersHint')}</span> : null}
            </p>
          </li>
        ) : (
          cards
        )}
      </ul>
    </section>
  );
}

/**
 * Carte de « Membres » branchee sur dnd-kit — au POINTEUR seulement. Les
 * `attributes` de `useDraggable` (`role="button"`, `tabIndex`, instructions)
 * ne sont volontairement pas poses : la carte n'est pas saisissable au
 * clavier, qui passe par « Rôles… » (DESIGN §6.6). Un faux bouton annonce
 * « deplacable » sans rien faire a Entree aurait trompe le lecteur d'ecran.
 */
function DraggableMemberCard({
  member,
  canManage,
  dragSource,
  onOpenRoles,
}: {
  member: RoleMember;
  canManage: boolean;
  dragSource: boolean;
  onOpenRoles: (member: RoleMember) => void;
}) {
  const data: MemberDragData = { type: 'member', memberId: member.id, memberType: member.type };
  const { setNodeRef, listeners } = useDraggable({ id: memberDragId(member), data, disabled: !canManage });
  return (
    <MemberCard
      member={member}
      variant="member"
      canManage={canManage}
      dragSource={dragSource}
      dragRef={setNodeRef}
      dragListeners={listeners}
      onOpenRoles={onOpenRoles}
    />
  );
}
