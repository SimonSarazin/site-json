import { Fragment, useState, type ReactNode } from "react";
import { FolderPlus, Link2, ListMinus, ListPlus, Loader2, MoreHorizontal, Pencil, Trash2, UserPen } from "lucide-react";
import type { Api } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { editorIdsOf, type EditorsQuestion } from "../../lib/communEditors";
import { useCommunSelectionAction, type CommunSelectionActionOptions } from "../../hooks/useCommunSelectionAction";
import { useCommunProjectActions, type CommunProjectActionsOptions } from "../../hooks/useCommunProjectActions";
import { useCommunDeleteAction, type CommunDeleteActionOptions } from "../../hooks/useCommunDeleteAction";
import { CommunEditorsDialog } from "./CommunEditorsDialog";
import { CommunProjectBadge, CommunProjectOpenButton } from "./CommunProjectStatus";
import { CommunSelectionBadge } from "./CommunSelectionBadge";
import { StatusPillSkeleton } from "./CommunSkeletons";

/**
 * La barre d'actions de la fiche d'un commun (arbitrage du 01/10) :
 *  - à gauche l'ÉTAT, pour tous — admin compris : une action ne remplace plus une pastille ;
 *  - à droite les actions, avec AU PLUS un bouton plein, la décision encore ouverte — la
 *    sélection dans l'annuaire —, en dernier avant « ⋯ » ;
 *  - dans « ⋯ » : le passage en projet (générer ou associer), le retrait de l'annuaire et, à
 *    l'écart, la suppression. Sous `sm`, « Éditeurs » y passe aussi.
 *
 * Les confirmations sont rendues HORS du menu : son contenu est démonté à la fermeture, et
 * emporterait un dialogue ouvert depuis l'une de ses entrées (même idiome qu'`EntityStatusButton`).
 * Chaque action garde son propre gate — des gates d'AFFICHAGE, le backend tranche.
 */
export interface CommunActionBarProps {
  api: Api | null;
  answerId: string | null;
  /** La réponse affichée : on y lit les contributeurs à l'édition. */
  answer: unknown;
  formId: string | null;
  /** « Modifier » — la page garde sa modale d'édition. */
  canEdit: boolean;
  onEdit: () => void;
  /** Gérer les contributeurs à l'édition : l'auteur et les admins (`perms.canManageEditors`). */
  canManageEditors: boolean;
  editorsQuestion: EditorsQuestion | null;
  selection: Omit<CommunSelectionActionOptions, "api" | "formId" | "answerId">;
  project: Omit<CommunProjectActionsOptions, "api" | "answerId" | "canLink"> & {
    /** Qui peut passer le commun en projet : son déposant et l'admin de l'appel. */
    canManage: boolean;
    /**
     * L'enveloppe n'a pas répondu : `projectId` est `undefined` SANS que cela signifie « pas de
     * projet ». Proposer alors « Générer », c'était offrir de CRÉER un projet sur un commun qui en a
     * peut-être déjà un.
     */
    isLoading: boolean;
    /** `targetResource?.projectId` — présence = projet déjà lié (généré ou associé). */
    projectId?: string | null;
    projectSlug?: string | null;
  };
  deletion: Omit<CommunDeleteActionOptions, "api" | "answerId">;
}

export function CommunActionBar({
  api,
  answerId,
  answer,
  formId,
  canEdit,
  onEdit,
  canManageEditors,
  editorsQuestion,
  selection: selectionOptions,
  project,
  deletion: deletionOptions,
}: CommunActionBarProps) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const [editorsOpen, setEditorsOpen] = useState(false);

  const projectId = project.isLoading ? null : (project.projectId ?? null);
  const peutPasserEnProjet = !project.isLoading && !projectId && project.canManage;

  const selection = useCommunSelectionAction({ api, formId, answerId, ...selectionOptions });
  const projet = useCommunProjectActions({
    api,
    canLink: peutPasserEnProjet,
    answerId,
    parentId: project.parentId,
    parentType: project.parentType,
    userId: project.userId,
    contextEntity: project.contextEntity,
    onLinked: project.onLinked,
  });
  const suppression = useCommunDeleteAction({ api, answerId, ...deletionOptions });

  const peutRetirer = selection.canWrite && selection.isSelected;
  const nbEditeurs = editorIdsOf(answer).length;
  // Une action lancée depuis « ⋯ » se suit sur son déclencheur : le menu, lui, est déjà refermé.
  const menuOccupe = projet.isPending || suppression.isPending || (peutRetirer && selection.isPending);

  // Le compteur seul, collé au libellé, se lirait « Éditeurs1 » : le nom accessible le met en clair.
  const libelleEditeurs = String(t("detail.editors.cta"));
  const nomEditeurs = nbEditeurs > 0 ? `${libelleEditeurs} (${nbEditeurs})` : libelleEditeurs;
  const compteur = nbEditeurs > 0 && (
    <span
      aria-hidden="true"
      className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
    >
      {nbEditeurs}
    </span>
  );

  // Les groupes de « ⋯ », séparés entre eux. « Éditeurs » est à part : il n'y figure que sous `sm`.
  const groupes: Array<{ cle: string; contenu: ReactNode }> = [];
  if (peutPasserEnProjet) {
    groupes.push({
      cle: "projet",
      contenu: (
        <>
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            {String(t("detail.project.menuLabel"))}
          </DropdownMenuLabel>
          <DropdownMenuItem className="items-start" onClick={projet.requestGenerate}>
            <FolderPlus className="mt-0.5" />
            <span className="grid gap-0.5">
              <span>{String(t("detail.project.generateCta"))}</span>
              <span className="text-xs text-muted-foreground">{String(t("detail.project.generateHint"))}</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="items-start"
            onClick={projet.requestAssociate}
            disabled={!projet.canAssociate}
          >
            <Link2 className="mt-0.5" />
            <span className="grid gap-0.5">
              <span>{String(t("detail.project.associateCta"))}</span>
              <span className="text-xs text-muted-foreground">{String(t("detail.project.associateHint"))}</span>
            </span>
          </DropdownMenuItem>
        </>
      ),
    });
  }
  if (peutRetirer) {
    groupes.push({
      cle: "retirer",
      contenu: (
        <DropdownMenuItem onClick={selection.request}>
          <ListMinus />
          {String(t("detail.selection.deselectCta"))}
        </DropdownMenuItem>
      ),
    });
  }
  if (suppression.canDelete) {
    groupes.push({
      cle: "supprimer",
      contenu: (
        <DropdownMenuItem variant="destructive" onClick={suppression.request}>
          <Trash2 />
          {String(t("delete.cta"))}
        </DropdownMenuItem>
      ),
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2" data-commun-action-bar="">
        <div className="flex flex-wrap items-center gap-2" data-commun-status="">
          <CommunSelectionBadge isSelected={selectionOptions.isSelected} />
          {project.isLoading ? <StatusPillSkeleton /> : !projectId ? <CommunProjectBadge /> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" className="gap-2" onClick={onEdit}>
              <Pencil className="size-3.5" />
              {String(t("detail.edit.cta"))}
            </Button>
          )}

          {canManageEditors && (
            <Button
              variant="outline"
              size="sm"
              className="hidden gap-2 sm:inline-flex"
              title={String(t("detail.editors.ctaHint"))}
              aria-label={nomEditeurs}
              onClick={() => setEditorsOpen(true)}
            >
              <UserPen className="size-3.5" />
              {libelleEditeurs}
              {compteur}
            </Button>
          )}

          {projectId && (
            <CommunProjectOpenButton key={projectId} api={api} projectId={projectId} projectSlug={project.projectSlug} />
          )}

          {selection.canWrite && !selection.isSelected && (
            <Button size="sm" className="gap-2" onClick={selection.request} disabled={selection.isPending}>
              {selection.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ListPlus className="size-3.5" />
              )}
              {String(t("detail.selection.selectCta"))}
            </Button>
          )}

          {(groupes.length > 0 || canManageEditors) && (
            // Non modal : la recherche de projets, montée à l'ouverture pendant que le menu se ferme,
            // héritait sinon du `pointer-events: none` posé sur `<body>` par le menu modal, et le
            // restaurait à sa fermeture — page figée, mesuré au navigateur le 01/10.
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild disabled={menuOccupe}>
                <Button
                  variant="outline"
                  size="icon-sm"
                  // Sans entrée au-delà de `sm`, « ⋯ » n'a rien à offrir sur un écran large.
                  className={groupes.length === 0 ? "sm:hidden" : undefined}
                  aria-label={String(t("detail.actions.more"))}
                  disabled={menuOccupe}
                >
                  {menuOccupe ? <Loader2 className="size-3.5 animate-spin" /> : <MoreHorizontal className="size-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {canManageEditors && (
                  <div className="sm:hidden">
                    {/* Le `title` du bouton ne se survole pas sur mobile : l'explication s'écrit. */}
                    <DropdownMenuItem className="items-start" onClick={() => setEditorsOpen(true)}>
                      <UserPen className="mt-0.5" />
                      <span className="grid gap-0.5">
                        <span className="flex items-center gap-2">
                          <span className="sr-only">{nomEditeurs}</span>
                          <span aria-hidden="true">{libelleEditeurs}</span>
                          {compteur}
                        </span>
                        <span className="text-xs text-muted-foreground">{String(t("detail.editors.ctaHint"))}</span>
                      </span>
                    </DropdownMenuItem>
                    {groupes.length > 0 && <DropdownMenuSeparator />}
                  </div>
                )}
                {groupes.map(({ cle, contenu }, index) => (
                  <Fragment key={cle}>
                    {index > 0 && <DropdownMenuSeparator />}
                    {contenu}
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {selection.dialog}
      {projet.dialog}
      {suppression.dialog}
      {editorsOpen && (
        <CommunEditorsDialog
          api={api}
          answerId={answerId}
          answer={answer}
          question={editorsQuestion}
          formId={formId}
          onClose={() => setEditorsOpen(false)}
        />
      )}
    </>
  );
}
