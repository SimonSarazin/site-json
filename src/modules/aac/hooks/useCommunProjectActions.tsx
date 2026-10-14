import { useState, type ReactNode } from "react";
import type { Api, Organization, Project } from "@communecter/cocolight-api-client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FinderSearchModal } from "@/modules/coform/components/FinderSearchModal";
import type { FinderConfig, FinderElement } from "@/modules/coform/types";
import { useT } from "@/hooks/useT";
import { useGenerateAacProject } from "./useGenerateAacProject";
import { useAssociateExistingAacProject } from "./useAssociateExistingAacProject";

/**
 * Passer un commun en projet : générer un projet neuf, ou associer un projet existant. Les deux
 * voies répondent à la même question — quel projet suit ce commun ? — et la barre de la fiche les
 * présente ensemble, dans « ⋯ » (`CommunActionBar`). Ce hook porte leurs écritures, leurs
 * dialogues et leur état ; le déclencheur reste à la barre.
 *
 * Génération IRRÉVERSIBLE, jamais gatée sur le statut du commun (cf. doc/34-module-aac.md §1) :
 * mesuré le 01/10/2026, 2 des 3 communs CAE dotés d'un projet ne sont pas sélectionnés.
 */
export interface CommunProjectActionsOptions {
  api: Api | null;
  /**
   * Le commun peut ENCORE passer en projet : droit acquis, enveloppe résolue, aucun projet lié.
   * Faux, aucun dialogue n'existe — la portée de l'ancien retour anticipé du contrôle : une
   * confirmation ou une recherche déjà ouverte ne survit ni à l'arrivée d'un projet (relecture au
   * retour sur l'onglet, co-admin), ni à une enveloppe repassée en vol. Sinon « Associer » écraserait
   * le lien existant : `assertProjectAssociable` ne contrôle que le côté projet.
   */
  canLink: boolean;
  answerId: string | null;
  /** `directory.contextId` — costum.contextId legacy. */
  parentId: string | null;
  /** `directory.context?.type` — costum.contextType legacy. */
  parentType?: string | null;
  /** Utilisateur courant — requis pour le backfill dépense lors d'une association. */
  userId: string | null;
  /**
   * Hôte du costum (`useCocolight().entity`) — pour la double vérif « projet déjà rattaché à un
   * autre commun » à l'association (`coformAnswersSearch` scopé costum).
   */
  contextEntity?: Organization | Project | null;
  /** Le commun a désormais un projet, généré ou associé. */
  onLinked?: () => void;
}

export interface CommunProjectActions {
  /** Sans utilisateur courant, pas de filtre sûr : le finder listerait n'importe quel projet. */
  canAssociate: boolean;
  isPending: boolean;
  requestGenerate: () => void;
  requestAssociate: () => void;
  /** Confirmation et recherche, à rendre HORS du menu : son contenu est démonté à la fermeture. */
  dialog: ReactNode;
}

const PROJECT_FINDER_CONFIG_BASE: Omit<
  FinderConfig,
  "elementLabel" | "buttonLabel" | "placeholderSearchField" | "filters"
> = {
  type: "projects",
  excludeFilters: [],
  notSourceKey: true,
  myContacts: false,
  initCurrentUser: false,
  field: "project",
  multiple: false,
  addNew: false,
  invite: false,
  linkToAnswer: false,
  singleAnswerPerElement: false,
  msgSingleAnswerPerElement: "",
  redirectSingleAnswerPerElement: "Accueil",
  editElement: false,
  addToLinks: { value: false, links: "" },
};

export function useCommunProjectActions({
  api,
  canLink,
  answerId,
  parentId,
  parentType,
  userId,
  contextEntity,
  onLinked,
}: CommunProjectActionsOptions): CommunProjectActions {
  const t = useT("modules/aac");
  const [mode, setMode] = useState<"generate" | "associate" | null>(null);
  // Plus de passage possible : on oublie le dialogue demandé, PENDANT le rendu (un effet le
  // laisserait affiché une frame) — sinon il se rouvrirait seul si la condition redevenait vraie.
  if (!canLink && mode !== null) setMode(null);

  const generate = useGenerateAacProject({ api, answerId, parentId, parentType: parentType ?? null });
  const associate = useAssociateExistingAacProject({ api, answerId, userId, context: contextEntity ?? null });

  const canAssociate = Boolean(userId);

  const confirmerGeneration = () => {
    generate.mutate(undefined, {
      onSuccess: () => {
        setMode(null);
        onLinked?.();
      },
    });
  };

  const associer = (elements: FinderElement[]) => {
    const picked = elements[0];
    if (!picked) return;
    associate.mutate(
      { projectId: picked.id },
      {
        onSuccess: () => {
          setMode(null);
          onLinked?.();
        },
      }
    );
  };

  // Les projets dont l'utilisateur courant est admin, et eux seuls.
  const finderConfig: FinderConfig = {
    ...PROJECT_FINDER_CONFIG_BASE,
    filters: userId
      ? [
          { attributeName: `links.contributors.${userId}.type`, valueName: "citoyens" },
          { attributeName: `links.contributors.${userId}.isAdmin`, valueName: "true" },
        ]
      : [],
    elementLabel: String(t("detail.project.associate.finderLabel")),
    buttonLabel: String(t("detail.project.associate.finderButton")),
    placeholderSearchField: String(t("detail.project.associate.finderPlaceholder")),
  };

  return {
    canAssociate,
    isPending: generate.isPending || associate.isPending,
    requestGenerate: () => {
      if (canLink) setMode("generate");
    },
    requestAssociate: () => {
      if (canLink && canAssociate) setMode("associate");
    },
    dialog: canLink ? (
      <>
        <ConfirmDialog
          open={mode === "generate"}
          onOpenChange={(ouvert) => setMode(ouvert ? "generate" : null)}
          onConfirm={confirmerGeneration}
          title={String(t("detail.project.confirmGenerate.title"))}
          description={String(t("detail.project.confirmGenerate.description"))}
          confirmLabel={String(t("detail.project.confirmGenerate.confirm"))}
          cancelLabel={String(t("detail.project.confirmGenerate.cancel"))}
          isDestructive
          isPending={generate.isPending}
        />

        {mode === "associate" && (
          <FinderSearchModal
            config={finderConfig}
            selectedElements={{}}
            onClose={() => setMode(null)}
            onValidate={associer}
          />
        )}
      </>
    ) : null,
  };
}
