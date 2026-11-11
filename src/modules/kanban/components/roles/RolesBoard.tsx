import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type MeasuringConfiguration,
  type Over,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useFocusAfterChange } from '@/modules/kanban/components/board/useFocusAfterChange';
import { kanbanErrorText } from '@/modules/kanban/lib/kanbanErrors';
import { findRoleMember } from '@/modules/kanban/lib/roles';
import type { RoleEntry, RoleListResult, RoleMember } from '@/modules/kanban/types';
import { MemberCard } from './MemberCard';
import { RoleAssignmentDialog } from './RoleAssignmentDialog';
import { RoleColumn } from './RoleColumn';
import { RoleComposer } from './RoleComposer';
import { RoleDeleteDialog } from './RoleDeleteDialog';
import { memberMenuIn, roleColumnMenuIn } from './rolesFocus';
import {
  buildRolesBoard,
  dragCancelMessage,
  dragEndMessage,
  dragOverMessage,
  dragStartMessage,
  ghostIndex,
  isMemberDragData,
  memberKey,
  resolveDrop,
  roleWriteRefusedMessage,
  visibleRoleColumns,
  type DropOutcome,
  type RolesMessage,
  type RoleWriteAction,
} from './rolesBoard';

export interface RolesBoardProps {
  /** La liste servie (`role/list`), cache optimiste compris : elle fait autorite. */
  list: RoleListResult;
  /** Texte du champ de recherche de la vue, applique tel quel (local, aucune requete). */
  query: string;
  /** `canManageRoles` (D27) : sans lui, ni glisser, ni menu de carte, ni retrait, ni composeur. */
  canManage: boolean;
  /**
   * Roles dont la colonne est MASQUEE sur ce poste (D34, preference locale de
   * la vue) : elle n'est pas rendue, donc jamais une cible de depot. Les roles
   * eux-memes restent dans `list` — la boite « Rôles… » les propose tous.
   */
  hiddenRoles: readonly string[];
  /** Menu « ⋯ » d'une colonne de role → « Masquer la colonne ». */
  onHideRole: (role: string) => void;
  /**
   * Ecritures d'un role sur un membre : la PROMESSE de la mutation
   * (`mutateAsync`), rejetee au refus. Le hook a deja repose le cache et
   * notifie la raison ; la vue s'en sert pour redire l'etat vrai dans ses
   * regions vivantes (ligne de statut de la boite « Rôles… », annonces).
   */
  onAssign: (member: RoleMember, role: string) => Promise<unknown>;
  onUnassign: (member: RoleMember, role: string) => Promise<unknown>;
  onCreateRole: (role: string) => void;
  onDeleteRole: (role: string) => void;
  /** Ecrit dans la region vivante de la vue (creation, suppression, retrait). */
  announce: (message: string) => void;
  /**
   * Ou rendre le focus quand la commande qui l'avait disparait avec sa carte
   * ou sa colonne et qu'aucune colonne ne peut le reprendre : le titre de la vue.
   */
  fallbackFocusRef: RefObject<HTMLElement | null>;
  className?: string;
}

/*
 * `Always` : une colonne change de hauteur quand le fantome y entre ; sans
 * re-mesure, les colonnes voisines garderaient leur ancien rectangle et le
 * depot suivant viserait a cote.
 */
const MEASURING: MeasuringConfiguration = {
  droppable: { strategy: MeasuringStrategy.Always },
};

/** Delai avant d'annoncer « N membres correspondent » : une frappe, pas une phrase par touche. */
const MATCH_ANNOUNCE_DELAY_MS = 600;

/**
 * Le kanban des roles (§12.4, D27-D30 ; DESIGN §6.6 de co-kanban) : « Membres », puis une
 * colonne par role, et « + Ajouter un rôle ».
 *
 * GLISSER = COPIE. Une carte de « Membres » lachee sur une colonne de role lui
 * ATTRIBUE ce role (`role/assign`) et reste dans « Membres » : un membre figure
 * dans autant de colonnes qu'il a de roles. Rien ne se glisse DEPUIS une
 * colonne de role (on y retire, par le bouton de la carte), et une colonne qui
 * porte deja le membre refuse le depot en le disant. Le pointeur seul saisit
 * (souris : 6 px de seuil ; doigt : appui long) ; le clavier et le tactile
 * passent par « Rôles… », la boite a cases de chaque carte membre.
 *
 * Pendant le glisser, l'apercu (`DragOverlay`) est la carte soulevee marquee
 * « attribuer », la source reste en place (bleue), et la colonne survolee
 * montre un FANTOME a la place qu'aura la carte. Aucune animation de depot :
 * l'apercu reviendrait vers la source, et dirait « rien ne s'est passe » d'une
 * attribution qui vient de reussir.
 */
export function RolesBoard({
  list,
  query,
  canManage,
  hiddenRoles,
  onHideRole,
  onAssign,
  onUnassign,
  onCreateRole,
  onDeleteRole,
  announce,
  fallbackFocusRef,
  className,
}: RolesBoardProps) {
  const { t } = useTranslation('modules/kanban');

  /*
   * Recalcule quand la liste ou la recherche change, pas a chaque survol du
   * glisser (qui rerend le tableau a chaque changement de colonne survolee).
   */
  const model = useMemo(() => buildRolesBoard(list, query), [list, query]);
  // Les colonnes RENDUES : le modele garde toutes les colonnes (la confirmation
  // de suppression y lit les porteurs), seul l'affichage retire les masquees.
  const shownColumns = useMemo(() => visibleRoleColumns(model.columns, hiddenRoles), [model.columns, hiddenRoles]);
  const memberOrder = useMemo(() => list.members.map((member) => member.id), [list.members]);

  const [activeMember, setActiveMember] = useState<RoleMember | null>(null);
  const [over, setOver] = useState<{ role: string; outcome: DropOutcome } | null>(null);
  const [rolesDialogFor, setRolesDialogFor] = useState<string | null>(null);
  const [deleteDialogRole, setDeleteDialogRole] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  /* Le membre de la boite « Rôles… », RELU dans la liste a chaque rendu : ses cases suivent le cache optimiste. */
  const dialogMember = rolesDialogFor === null ? null : (list.members.find((member) => memberKey(member) === rolesDialogFor) ?? null);
  const deleteColumn = deleteDialogRole === null ? null : (model.columns.find((column) => column.role.name === deleteDialogRole) ?? null);

  /*
   * FOCUS APRES UN RETRAIT ou une suppression : la commande qui l'avait (bouton
   * de retrait, menu de colonne) disparait avec sa carte ou sa colonne, un rendu
   * plus tard (optimiste). Il revient alors au menu de la colonne concernee,
   * sinon — colonne disparue : role supprime, ou dernier porteur d'un role non
   * declare — au titre de la vue.
   */
  const rootRef = useRef<HTMLUListElement>(null);
  const pendingRoleRef = useRef<string | null>(null);
  const findFocusTarget = useCallback(
    () =>
      (pendingRoleRef.current === null ? null : roleColumnMenuIn(rootRef.current, pendingRoleRef.current)) ??
      fallbackFocusRef.current,
    [fallbackFocusRef],
  );
  const armFocus = useFocusAfterChange(list, findFocusTarget);

  /* Le composeur remplace son bouton : a la fermeture, le bouton remonte et reprend le focus. */
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const restoreAddFocusRef = useRef(false);
  useEffect(() => {
    if (composerOpen || !restoreAddFocusRef.current) return;
    restoreAddFocusRef.current = false;
    addButtonRef.current?.focus();
  }, [composerOpen]);

  function closeComposer() {
    restoreAddFocusRef.current = true;
    setComposerOpen(false);
  }

  /*
   * Un refus du serveur, apres l'annonce OPTIMISTE du geste : le cache est
   * repose (la carte revient ou repart), et la region de la vue redit l'etat
   * vrai avec la raison — la notification, elle, est hors de la vue.
   */
  function announceRefusal(action: RoleWriteAction, member: RoleMember, role: string, error: unknown) {
    const message = roleWriteRefusedMessage(action, member.name, role, kanbanErrorText(t, error));
    announce(t(message.key, message.values));
  }

  function removeRole(member: RoleMember, role: string) {
    pendingRoleRef.current = role;
    armFocus();
    onUnassign(member, role).catch((error: unknown) => announceRefusal('unassign', member, role, error));
    announce(t('views.roles.removed', { role, name: member.name }));
  }

  function confirmDeleteRole(role: string) {
    pendingRoleRef.current = null;
    armFocus();
    setDeleteDialogRole(null);
    onDeleteRole(role);
    announce(t('views.roles.deleted', { role }));
  }

  function createRole(role: string) {
    onCreateRole(role);
    announce(t('views.roles.created', { role }));
  }

  /*
   * SOURIS ET TACTILE SONT SEPARES, comme sur le tableau : un `PointerSensor`
   * unique imposerait `touch-action: none` a toute la carte et supprimerait le
   * defilement au doigt. Le tactile saisit par un APPUI LONG ; un glissement du
   * doigt reste un defilement. Pas de `KeyboardSensor` : le clavier passe par
   * « Rôles… » (cf. `DraggableMemberCard`).
   */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  /*
   * ANNONCES DU LECTEUR D'ECRAN : la decision (`resolveDrop`) et le choix du
   * message sont purs ; ici ne restent que la lecture du dernier rendu
   * (`liveRef`) et la traduction. Le lacher lit l'issue DECIDEE par
   * `handleDragEnd` : une fois l'attribution ecrite dans le cache, la liste
   * dirait « deja porte » d'un role qui vient d'etre attribue.
   */
  const liveRef = useRef(list);
  useEffect(() => {
    liveRef.current = list;
  });
  const endOutcomeRef = useRef<DropOutcome | null>(null);

  const announcements = useMemo<Announcements>(() => {
    const nameOf = (active: Active): string => {
      const data = active.data.current;
      if (!isMemberDragData(data)) return '';
      return findRoleMember(liveRef.current, data.memberId, data.memberType)?.name ?? data.memberId;
    };
    const outcomeOf = (active: Active, target: Over | null): DropOutcome => {
      const data = active.data.current;
      return isMemberDragData(data) ? resolveDrop(target?.data.current, liveRef.current.roles, data.memberId) : { kind: 'none' };
    };
    const say = (message: RolesMessage | undefined) => (message === undefined ? undefined : t(message.key, message.values));
    return {
      onDragStart: ({ active }) => say(dragStartMessage(nameOf(active))),
      onDragOver: ({ active, over: target }) => say(dragOverMessage(nameOf(active), outcomeOf(active, target))),
      onDragEnd: ({ active, over: target }) => {
        const outcome = endOutcomeRef.current ?? outcomeOf(active, target);
        endOutcomeRef.current = null;
        return say(dragEndMessage(nameOf(active), outcome));
      },
      onDragCancel: ({ active }) => say(dragCancelMessage(nameOf(active))),
    };
  }, [t]);

  /*
   * Pas de `screenReaderInstructions` : dnd-kit ne les expose que par
   * l'`aria-describedby` des `attributes` d'un `useDraggable`, que les cartes ne
   * posent pas (cf. `DraggableMemberCard`) — un texte que personne n'entend
   * serait une cle morte. L'alternative clavier est le menu « ⋯ » de la carte.
   */
  const accessibility = useMemo(() => ({ announcements }), [announcements]);

  function handleDragStart({ active }: DragStartEvent) {
    const data = active.data.current;
    if (!isMemberDragData(data)) return;
    setActiveMember(findRoleMember(list, data.memberId, data.memberType) ?? null);
  }

  function handleDragOver({ active, over: target }: DragOverEvent) {
    const data = active.data.current;
    if (!isMemberDragData(data)) return;
    const outcome = resolveDrop(target?.data.current, list.roles, data.memberId);
    setOver(outcome.kind === 'none' ? null : { role: outcome.role, outcome });
  }

  function handleDragEnd({ active, over: target }: DragEndEvent) {
    /*
     * Garde en profondeur (D27) : sans `canManageRoles`, aucune carte n'a de
     * prise et aucune colonne n'est une cible — mais une ECRITURE ne doit
     * dependre d'aucun capteur. Un lacher qui arriverait quand meme est traite
     * comme une annulation.
     */
    if (!canManage) {
      handleDragCancel();
      return;
    }
    const data = active.data.current;
    if (isMemberDragData(data)) {
      const outcome = resolveDrop(target?.data.current, list.roles, data.memberId);
      endOutcomeRef.current = outcome;
      const member = findRoleMember(list, data.memberId, data.memberType);
      // Deja porte, ou lache hors d'une colonne : rien ne part (D27) — l'annonce le dit.
      if (member !== undefined && outcome.kind === 'assign') {
        const role = outcome.role;
        onAssign(member, role).catch((error: unknown) => announceRefusal('assign', member, role, error));
      }
    }
    setActiveMember(null);
    setOver(null);
  }

  function handleDragCancel() {
    setActiveMember(null);
    setOver(null);
  }

  /* « N membres correspondent » : annonce apres la pause de frappe, jamais au chargement. */
  const announcedMatches = useDebounce(model.filtering ? model.matchCount : null, MATCH_ANNOUNCE_DELAY_MS);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        measuring={MEASURING}
        accessibility={accessibility}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* `tabIndex` rend la rangee atteignable au clavier — sans quoi, en
            lecture seule, les colonnes au-dela de l'ecran seraient inaccessibles
            sans souris (WCAG 2.1.1) : aucune commande n'y arrete la tabulation, et
            `overscroll-contain` des piles (a garder : il protege molette et
            tactile) empeche les fleches de chainer depuis la liste des membres.
            Meme parti que la Table et la Chronologie ; l'anneau est celui de
            `:focus-visible`. */}
        <ul
          ref={rootRef}
          aria-label={t('views.roles.columns')}
          tabIndex={0}
          className={cn(
            // Pile verticale sous 768 px (la page defile) ; rangee de colonnes
            // bornees a la hauteur de l'ecran au-dela, a barre fine VISIBLE.
            // `relative` : bloc conteneur des textes `sr-only` des colonnes.
            'ck-scroll-x relative flex flex-col gap-4 md:h-full md:flex-row md:items-start md:gap-[var(--ck-column-gutter)]',
            'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <li className="flex w-full shrink-0 list-none md:max-h-full md:w-80">
            <RoleColumn
              kind="members"
              members={model.members}
              count={model.memberCount}
              canManage={canManage}
              filtering={model.filtering}
              query={query}
              activeMember={activeMember}
              onOpenRoles={(member) => setRolesDialogFor(memberKey(member))}
            />
          </li>

          {shownColumns.map((column) => {
            const hovered = over !== null && over.role === column.role.name;
            const accepting = hovered && over.outcome.kind === 'assign' && activeMember !== null;
            return (
              <li key={column.role.name} className="flex w-full shrink-0 list-none md:max-h-full md:w-[var(--ck-column-width)]">
                <RoleColumn
                  kind="role"
                  role={column.role}
                  members={column.holders}
                  count={column.holderCount}
                  canManage={canManage}
                  filtering={model.filtering}
                  activeMember={activeMember}
                  ghostAt={accepting ? ghostIndex(column.holders.map((holder) => holder.id), memberOrder, activeMember.id) : null}
                  refusing={hovered && over.outcome.kind === 'alreadyHeld'}
                  onRemoveRole={removeRole}
                  onDeleteRole={(role: RoleEntry) => setDeleteDialogRole(role.name)}
                  onHide={(role: RoleEntry) => onHideRole(role.name)}
                />
              </li>
            );
          })}

          {canManage ? (
            <li className="w-full shrink-0 list-none md:w-[var(--ck-column-width)]">
              {composerOpen ? (
                <RoleComposer existing={list.roles.map((role) => role.name)} onCreate={createRole} onClose={closeComposer} />
              ) : (
                /* « + Ajouter un rôle » en pointille, comme « Ajouter une colonne » :
                   le pointille dit « emplacement », son contour tient 3:1. */
                <button
                  ref={addButtonRef}
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className={cn(
                    'inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--ck-border-strong)]',
                    'bg-[var(--ck-column-fill)] px-4 text-sm text-foreground md:w-auto',
                    'transition-colors duration-[var(--ck-duration-out)] ease-in hover:bg-muted',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <Plus aria-hidden="true" className="size-4 shrink-0" />
                  {t('views.roles.addRole')}
                </button>
              )}
            </li>
          ) : null}
        </ul>

        <DragOverlay dropAnimation={null}>
          {activeMember ? (
            <MemberCard
              member={activeMember}
              variant="member"
              lifted
              // L'apercu dit l'ISSUE du lacher (« Attribuer » / « Déjà ce rôle ») :
              // la pastille de la carte porteuse, elle, est souvent sous l'apercu.
              outcome={over?.outcome.kind ?? 'none'}
              className={cn(
                'w-[calc(20rem-2*var(--ck-column-padding))]',
                over?.outcome.kind === 'alreadyHeld' ? 'cursor-not-allowed' : 'cursor-grabbing',
              )}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Region vivante de la recherche, MONTEE des le premier rendu et vide. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcedMatches === null ? '' : t('views.roles.matchCount', { count: announcedMatches })}
      </p>

      {dialogMember !== null ? (
        <RoleAssignmentDialog
          open
          member={dialogMember}
          roles={list.roles}
          onAssign={(role) => onAssign(dialogMember, role)}
          onUnassign={(role) => onUnassign(dialogMember, role)}
          onClose={() => setRolesDialogFor(null)}
          returnFocus={() => memberMenuIn(rootRef.current, memberKey(dialogMember))}
        />
      ) : null}

      {deleteColumn !== null ? (
        <RoleDeleteDialog
          open
          role={deleteColumn.role.name}
          holderCount={deleteColumn.holderCount}
          onConfirm={() => confirmDeleteRole(deleteColumn.role.name)}
          onClose={() => setDeleteDialogRole(null)}
        />
      ) : null}
    </>
  );
}
