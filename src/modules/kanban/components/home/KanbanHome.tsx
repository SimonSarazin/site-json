import type { ComponentType } from "react";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { KanbanAccessNotice } from "@/modules/kanban/components/KanbanAccessNotice";
import { useContextBoard } from "@/modules/kanban/hooks/useContextBoard";
import { useCurrentUserId, useKanbanHydrated } from "@/modules/kanban/hooks/useKanbanSession";
import { useRoles } from "@/modules/kanban/hooks/useRoles";
import { kanbanAccessState, type KanbanAccessState } from "@/modules/kanban/lib/accessState";
import type { KanbanBoardTypeId } from "@/modules/kanban/schema";
import type { BoardCreateResult } from "@/modules/kanban/types";
import { BoardFlow, BoardFlowSkeleton } from "./BoardFlow";
import { BoardTile, BoardTileFooter } from "./BoardTile";
import { visibleBoardTypes } from "./boardTypes";
import { RolesOverview, RolesOverviewSkeleton } from "./RolesOverview";

/**
 * Écran `/kanban` : les kanbans de l'élément qui porte le site.
 *
 * Les tuiles viennent du registre (`boardTypes.ts`) et se rendent dès le serveur : elles ne
 * dépendent pas de la session. Seuls l'état d'accès et les chiffres arrivent après hydratation :
 * `board/create` (idempotent) décide de l'accès et sa réponse suffit à dessiner le flux du
 * tableau des actions ; les rôles viennent de `role/list`.
 */
export function KanbanHome() {
  const t = useT("modules/kanban");
  const { config } = useSite();
  const hydrated = useKanbanHydrated();
  const userId = useCurrentUserId();
  const board = useContextBoard();
  const { parent, parentName, query } = board;
  const state = kanbanAccessState({ hydrated, userId, parent, error: query.error, loaded: query.data !== undefined });
  const types = visibleBoardTypes(config.kanban, parent?.parentType ?? "projects");
  const name = parentName ?? String(t("home.thisCollective"));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <header className="max-w-2xl space-y-2">
        {parentName && (
          <p className="text-sm font-medium text-muted-foreground">
            {parent ? `${String(t(`home.parentType.${parent.parentType}`))} · ${parentName}` : parentName}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{String(t("home.title"))}</h1>
        <p className="text-base text-muted-foreground">{String(t("home.lead", undefined, { name }))}</p>
      </header>

      <KanbanAccessNotice board={board} className="mt-8" />

      {state !== "unavailable" && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {types.map((type) => {
            const Footer = TILE_FOOTERS[type.id];
            return (
              <li key={type.id}>
                <BoardTile type={type} enabled={state !== "notMember"} footer={<Footer state={state} data={query.data} />} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Ce que reçoit le pied de chaque tuile. Tant que la session n'est pas connue ou que les chiffres
 * chargent, le pied est réservé par un squelette : la tuile garde sa hauteur. Refusé ou en
 * échec, il n'y a rien à compter.
 */
interface TileFooterProps {
  state: KanbanAccessState;
  /** Réponse de `board/create` : l'identifiant du tableau et ses chiffres. */
  data: BoardCreateResult | undefined;
}

/** Pied de la tuile des actions : le flux du tableau, connu par `board/create`. */
function ActionsTileFooter({ state, data }: TileFooterProps) {
  if (state === "open" && data) {
    return (
      <BoardTileFooter>
        <BoardFlow data={data} />
      </BoardTileFooter>
    );
  }
  return state === "pending" ? (
    <BoardTileFooter>
      <BoardFlowSkeleton />
    </BoardTileFooter>
  ) : null;
}

/**
 * Pied de la tuile des rôles. `role/list` passe par le MÊME cache que la vue « Rôles »
 * (`useRoles`) : ouverte depuis la tuile, elle s'affiche sans attendre le réseau.
 */
function RolesTileFooter({ state, data }: TileFooterProps) {
  const roles = useRoles(data?.board._id ?? "", { enabled: state === "open" });
  if (state === "open" && roles.data) {
    return (
      <BoardTileFooter>
        <RolesOverview list={roles.data} />
      </BoardTileFooter>
    );
  }
  return state === "pending" || (state === "open" && roles.isPending) ? (
    <BoardTileFooter>
      <RolesOverviewSkeleton />
    </BoardTileFooter>
  ) : null;
}

/** Un pied par type du registre : le `Record` oblige à en donner un à tout nouveau kanban. */
const TILE_FOOTERS: Record<KanbanBoardTypeId, ComponentType<TileFooterProps>> = {
  actions: ActionsTileFooter,
  roles: RolesTileFooter,
};
