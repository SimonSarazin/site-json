import { Suspense, useCallback, useId, useMemo, useRef, useState, type RefObject } from "react";
import { Columns3, Eye, Lock, RefreshCw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBoardPrefs } from "@/modules/kanban/components/board/boardPrefs";
import { BoardPrefsProvider } from "@/modules/kanban/components/board/BoardPrefsProvider";
import { BoardColumnsSkeleton } from "@/modules/kanban/components/board/BoardColumnsSkeleton";
import type { ColumnVisibilityEntry } from "@/modules/kanban/components/board/ColumnVisibilityDialog";
import { pruneHiddenColumns } from "@/modules/kanban/components/board/hiddenColumns";
import { useAnnouncer } from "@/modules/kanban/components/board/useAnnouncer";
import { useFocusAfterChange } from "@/modules/kanban/components/board/useFocusAfterChange";
import { FailureNotice } from "@/modules/kanban/components/ui/FailureNotice";
// Chargée à la demande, à la première ouverture (`lazyDialogs`).
import { ColumnVisibilityDialog } from "@/modules/kanban/lazyDialogs";
import { useRoleMutations, useRoles } from "@/modules/kanban/hooks/useRoles";
import type { RoleListResult } from "@/modules/kanban/types";
import { RolesBoard } from "./RolesBoard";
import { rolesSummary } from "./rolesBoard";

export interface RolesViewProps {
  /** Le tableau relié à l'élément porteur (`useContextBoard`). */
  boardId: string;
  /** Titre de la page : il reprend le focus quand une colonne disparaît avec la commande qui l'avait. */
  titleRef: RefObject<HTMLHeadingElement | null>;
}

/**
 * Vue « Rôles » : le kanban des rôles de l'élément porteur — « Membres », puis une colonne par
 * rôle. Reprise de co-kanban (`pages/board/RolesView.tsx`).
 *
 * Elle porte le masquage local des colonnes de rôle (préférence du poste, D34), que co-kanban
 * logeait dans la mise en page de son tableau : ici, la vue est seule sur sa page.
 *
 * Pas de polling delta (`useBoardSync`) : il exigerait l'instantané complet du tableau
 * (`board/get`, toutes les actions) pour suivre les seuls rôles. La liste se relit au retour sur
 * l'onglet (TanStack) et après chaque écriture (`useRoleMutations`).
 */
export function RolesView({ boardId, titleRef }: RolesViewProps) {
  const { t } = useTranslation("modules/kanban");
  const rolesQuery = useRoles(boardId);
  const list = rolesQuery.data;
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  // `useMemo` : `BoardPrefsProvider` élague sa préférence quand cette liste change ; une liste
  // neuve à chaque rendu relancerait son effet à chaque frappe de la recherche.
  const roleNames = useMemo(() => list?.roles.map((role) => role.name), [list]);

  const entries: ColumnVisibilityEntry[] = (list?.roles ?? []).map((role) => ({
    id: role.name,
    label: role.name,
    detail: t("views.roles.holderCount", { count: role.memberIds.length }),
  }));

  return (
    // `onOpenColumnVisibility` sans `useCallback` : le fournisseur la lit par une ref.
    <BoardPrefsProvider boardId={boardId} scope="roles" columnIds={roleNames} onOpenColumnVisibility={() => setVisibilityOpen(true)}>
      <RolesViewContent boardId={boardId} list={list} rolesQuery={rolesQuery} titleRef={titleRef} />
      {/* `fallback={null}` : la boîte est un sur-écran, un squelette le temps du chargement ferait
          clignoter la page. */}
      {visibilityOpen ? (
        <Suspense fallback={null}>
          <ColumnVisibilityDialog open scope="roles" entries={entries} description={t("views.roles.columnsDescription")} onClose={() => setVisibilityOpen(false)} />
        </Suspense>
      ) : null}
    </BoardPrefsProvider>
  );
}

interface RolesViewContentProps {
  boardId: string;
  list: RoleListResult | undefined;
  rolesQuery: ReturnType<typeof useRoles>;
  titleRef: RefObject<HTMLHeadingElement | null>;
}

function RolesViewContent({ boardId, list, rolesQuery, titleRef }: RolesViewContentProps) {
  const { t } = useTranslation("modules/kanban");
  const { assign, unassign, create, remove } = useRoleMutations(boardId);
  const [query, setQuery] = useState("");
  const [announcement, announce] = useAnnouncer();
  const searchId = useId();

  /*
   * MASQUAGE LOCAL des colonnes de rôle (D34), élagué des rôles disparus : l'indicateur ne
   * compte que des colonnes qui existent. Un rôle masqué reste dans la boîte « Rôles… ».
   */
  const prefs = useBoardPrefs("roles");
  const hiddenRoles = list === undefined ? [] : pruneHiddenColumns(prefs.hiddenColumnIds, list.roles.map((role) => role.name));
  const hiddenCount = hiddenRoles.length;

  /*
   * Masquer une colonne fait disparaître son menu « ⋯ », focus compris : il passe alors à
   * l'indicateur « N colonnes masquées · Tout afficher » ; « Tout afficher » fait disparaître
   * l'indicateur, et le focus revient au bouton « Colonnes affichées ». Seulement si le focus
   * est perdu.
   */
  const noticeRef = useRef<HTMLButtonElement>(null);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);
  const findFocusAfterToggle = useCallback(() => noticeRef.current ?? columnsButtonRef.current, []);
  const armFocusAfterToggle = useFocusAfterChange(hiddenCount, findFocusAfterToggle);

  function hideRole(role: string) {
    armFocusAfterToggle();
    announce(t("columnVisibility.hiddenAnnouncement", { title: role }));
    prefs.toggleColumn(role);
  }

  function showAllRoles() {
    armFocusAfterToggle();
    announce(t("columnVisibility.shownAllAnnouncement"));
    prefs.showAllColumns();
  }

  const canManage = list?.canManageRoles === true;
  const summary = list === undefined ? null : rolesSummary(list);

  return (
    <div className="flex flex-col md:min-h-0 md:flex-1">
      <div className="shrink-0 pb-3">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <p className="min-w-0 flex-1 basis-72 text-sm text-muted-foreground">
            {summary !== null ? (
              <span className="tabular-nums">
                {t("views.roles.summary", {
                  members: t("views.roles.holderCount", { count: summary.memberCount }),
                  roles: t("views.roles.roleCount", { count: summary.roleCount }),
                })}
                {". "}
              </span>
            ) : null}
            {list === undefined ? null : canManage ? (
              t("views.roles.intro")
            ) : (
              // Lecture seule (D27) : la note porte un cadenas, pas seulement une couleur.
              <span className="inline-flex items-center gap-1.5">
                <Lock aria-hidden className="size-3 shrink-0" />
                {t("views.roles.readOnly")}
              </span>
            )}
          </p>
          {/* Recherche, puis les commandes du masquage local. Sous 640 px, la recherche prend la
              ligne et les commandes passent dessous. */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-80">
              <label htmlFor={searchId} className="sr-only">
                {t("views.roles.search")}
              </label>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={searchId}
                type="search"
                value={query}
                placeholder={t("views.roles.search")}
                autoComplete="off"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  // Échap vide la recherche sans quitter le champ ; vide, il laisse la touche
                  // remonter (fermer une couche au-dessus).
                  if (event.key === "Escape" && query !== "") {
                    event.preventDefault();
                    event.stopPropagation();
                    setQuery("");
                  }
                }}
              />
            </div>
            {list !== undefined && list.roles.length > 0 ? (
              <Button ref={columnsButtonRef} variant="outline" onClick={prefs.openColumnVisibility}>
                <Columns3 aria-hidden />
                {t("columnVisibility.menu")}
              </Button>
            ) : null}
            {hiddenCount > 0 ? (
              // Masquer une colonne ne doit pas la faire oublier : la vue dit combien elle en
              // cache et offre de tout réafficher.
              <button
                ref={noticeRef}
                type="button"
                onClick={showAllRoles}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--ck-border-strong)] px-3",
                  "text-sm text-muted-foreground pointer-coarse:min-h-11",
                  "transition-colors duration-[var(--ck-duration-out)] ease-in hover:bg-muted hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <Eye aria-hidden className="size-4 shrink-0" />
                {t("columnVisibility.hiddenCount", { count: hiddenCount })}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {rolesQuery.isError ? (
        <FailureNotice
          announce="alert"
          error={rolesQuery.error}
          action={
            <Button variant="outline" size="sm" onClick={() => void rolesQuery.refetch()}>
              <RefreshCw aria-hidden />
              {t("common.retry")}
            </Button>
          }
        />
      ) : list === undefined ? (
        <BoardColumnsSkeleton columns={3} className="pb-4" />
      ) : (
        <RolesBoard
          list={list}
          query={query}
          canManage={canManage}
          hiddenRoles={hiddenRoles}
          onHideRole={hideRole}
          // `mutateAsync` : la promesse dit le refus à la vue (ligne de statut de la boîte
          // « Rôles… », annonces) ; le hook a déjà reposé le cache et notifié.
          onAssign={(member, role) => assign.mutateAsync({ memberId: member.id, memberType: member.type, role })}
          onUnassign={(member, role) => unassign.mutateAsync({ memberId: member.id, memberType: member.type, role })}
          onCreateRole={(role) => create.mutate({ role })}
          onDeleteRole={(role) => remove.mutate({ role })}
          announce={announce}
          fallbackFocusRef={titleRef}
          className="min-h-0 flex-1 pt-1 pb-4"
        />
      )}

      {/* Région vivante de la vue, MONTÉE dès le premier rendu et vide. Le glisser a la sienne
          (dnd-kit). */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
