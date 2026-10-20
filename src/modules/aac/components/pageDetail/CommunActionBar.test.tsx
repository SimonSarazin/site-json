// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/**
 * La barre d'actions de la fiche d'un commun (arbitrage du 01/10) :
 *  - l'ÉTAT se lit à gauche, pour TOUS — admin compris (avant, son bouton remplaçait la pastille) ;
 *  - AU PLUS un bouton plein : « Ajouter à l'annuaire », la décision encore ouverte ;
 *  - le passage en projet, le retrait de l'annuaire et la suppression sont dans « ⋯ » ;
 *  - tant que l'enveloppe n'a pas répondu, AUCUNE action de projet : lire `projectId` undefined
 *    comme « pas de projet » ferait générer un second projet, irréversible ; et un dialogue de projet
 *    déjà ouvert disparaît si un projet arrive entre-temps (« Associer » écraserait le lien) ;
 *  - on n'écrit JAMAIS la sélection sans savoir sous quelle clé (contexte, étape, réponse) ;
 *  - les dialogues vivent HORS du menu, dont le contenu est démonté à la fermeture.
 *
 * Seules les frontières sont simulées : les mutations (réseau), la recherche et l'aperçu (leurs
 * propres dépendances), et le menu déroulant Radix — remplacé par un menu À ÉTAT qui, comme lui,
 * démonte son contenu à la fermeture ; ses portails et événements pointeur, eux, sont vérifiés au
 * navigateur.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), base);
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

vi.mock("@/components/ui/dropdown-menu", async () => {
  const React = await import("react");
  const Menu = React.createContext({ open: false, setOpen: (_open: boolean) => {} });
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => {
      const [open, setOpen] = React.useState(false);
      return <Menu.Provider value={{ open, setOpen }}>{children}</Menu.Provider>;
    },
    DropdownMenuTrigger: ({ children }: { children: ReactElement<{ onClick?: () => void }> }) => {
      const { open, setOpen } = React.useContext(Menu);
      return React.cloneElement(children, { onClick: () => setOpen(!open) });
    },
    DropdownMenuContent: ({ children }: { children: ReactNode }) =>
      React.useContext(Menu).open ? <div role="menu">{children}</div> : null,
    DropdownMenuItem: (props: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: string }) => {
      const { setOpen } = React.useContext(Menu);
      return (
        <button
          type="button"
          role="menuitem"
          data-variant={props.variant ?? "default"}
          disabled={props.disabled}
          onClick={() => {
            props.onClick?.();
            setOpen(false);
          }}
        >
          {props.children}
        </button>
      );
    },
    DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
  };
});

const saveMutate = vi.fn();
let savePending = false;
vi.mock("@/modules/coform/actions/mutations/selection", () => ({
  useSaveChooseProposal: () => ({ mutate: saveMutate, isPending: savePending }),
}));
const generateMutate = vi.fn();
let generatePending = false;
vi.mock("../../hooks/useGenerateAacProject", () => ({
  useGenerateAacProject: () => ({ mutate: generateMutate, isPending: generatePending }),
}));
const associateMutate = vi.fn();
let associatePending = false;
vi.mock("../../hooks/useAssociateExistingAacProject", () => ({
  useAssociateExistingAacProject: () => ({ mutate: associateMutate, isPending: associatePending }),
}));
const deleteMutate = vi.fn();
let deletePending = false;
vi.mock("../../hooks/useDeleteCommun", () => ({
  useDeleteCommun: () => ({ mutate: deleteMutate, isPending: deletePending }),
}));

vi.mock("@/modules/coform/components/FinderSearchModal", () => ({
  FinderSearchModal: (props: {
    config: { filters: Array<{ attributeName: string; valueName: string }> };
    onValidate: (elements: Array<{ id: string; name: string; type: string }>) => void;
  }) => (
    <div data-testid="finder-search-modal" data-filters={JSON.stringify(props.config.filters)}>
      <button type="button" onClick={() => props.onValidate([{ id: "existing-proj-1", name: "Projet existant", type: "projects" }])}>
        pick-existing-project
      </button>
    </div>
  ),
}));
vi.mock("@/modules/profil/components/shared/EntityPreviewDrawer", () => ({ EntityPreviewDrawer: () => null }));
// Le dialogue des éditeurs et celui de la suppression ont leurs propres tests.
vi.mock("./CommunEditorsDialog", () => ({ CommunEditorsDialog: () => <div data-testid="editors-dialog" /> }));
vi.mock("./CommunDeleteDialog", () => ({
  CommunDeleteDialog: (props: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    props.open ? (
      <div data-testid="delete-dialog">
        <button type="button" onClick={() => props.onOpenChange(false)}>
          fermer-suppression
        </button>
      </div>
    ) : null,
}));

const { CommunActionBar } = await import("./CommunActionBar");

type Props = Parameters<typeof CommunActionBar>[0];

const CONTEXTE = "677e7e13bd08b2478f5f5314";
const EDITEUR = "57618d6640bb4ece776308aa";

function base(): Props {
  return {
    api: { project: vi.fn().mockResolvedValue({ id: "proj-1" }) } as unknown as Props["api"],
    answerId: "answer-1",
    answer: { links: { canEdit: { [EDITEUR]: { name: "Éd", type: "citoyens" } } } },
    formId: "6438366673d20a0de1533c77",
    canEdit: true,
    onEdit: vi.fn(),
    canManageEditors: true,
    editorsQuestion: null,
    selection: {
      isAdmin: true,
      isSelected: false,
      contextId: CONTEXTE,
      contextType: "organizations",
      contextName: "Fédération des CAE",
      subFormId: "aapStep2",
      onDone: vi.fn(),
    },
    project: {
      canManage: true,
      isLoading: false,
      projectId: null,
      projectSlug: null,
      parentId: CONTEXTE,
      parentType: "organizations",
      userId: "user-1",
      contextEntity: null,
      onLinked: vi.fn(),
    },
    deletion: { canDelete: true, communTitle: "Un commun", resource: null, isResourceLoading: false, onDeleted: vi.fn() },
  };
}

/** Les rôles, tels que la page les traduit en droits. */
const ROLES = {
  admin: (p: Props): Props => p,
  auteur: (p: Props): Props => ({ ...p, selection: { ...p.selection, isAdmin: false } }),
  editeur: (p: Props): Props => ({
    ...p,
    canManageEditors: false,
    selection: { ...p.selection, isAdmin: false },
    project: { ...p.project, canManage: false },
    deletion: { ...p.deletion, canDelete: false },
  }),
  visiteur: (p: Props): Props => ({
    ...p,
    canEdit: false,
    canManageEditors: false,
    selection: { ...p.selection, isAdmin: false },
    project: { ...p.project, canManage: false },
    deletion: { ...p.deletion, canDelete: false },
  }),
};

function poser(role: keyof typeof ROLES = "admin", over: (p: Props) => Props = (p) => p) {
  const props = over(ROLES[role](base()));
  return { props, ...render(<CommunActionBar {...props} />) };
}

const plusDActions = () => screen.queryByRole("button", { name: "detail.actions.more" });
/** Ouvre « ⋯ » s'il est fermé ; sans menu, ne fait rien (les entrées restent alors introuvables). */
const ouvrirMenu = () => {
  const bouton = plusDActions();
  if (bouton && !screen.queryByRole("menu")) fireEvent.click(bouton);
};
const entree = (nom: RegExp) => {
  ouvrirMenu();
  return screen.queryByRole("menuitem", { name: nom });
};
/** Les boutons pleins de la barre — toute variante à aplat, pas seulement `default`. */
const pleins = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-commun-action-bar] button")).filter((b) =>
    /(^|\s)bg-(primary|destructive|secondary)(\s|$)/.test(b.className)
  );

beforeEach(() => {
  saveMutate.mockClear();
  generateMutate.mockClear();
  associateMutate.mockClear();
  deleteMutate.mockClear();
  savePending = false;
  generatePending = false;
  associatePending = false;
  deletePending = false;
});

describe("CommunActionBar — l'état se lit, pour tous", () => {
  it("l'admin voit « En attente » et « Phase proposition », à côté de ses actions", () => {
    poser("admin");
    expect(screen.getByText("detail.selection.pending")).toBeInTheDocument();
    expect(screen.getByText("detail.project.proposalPhaseBadge")).toBeInTheDocument();
  });

  it("le visiteur voit le même état, sans aucune action", () => {
    const { container } = poser("visiteur", (p) => ({ ...p, selection: { ...p.selection, isSelected: true } }));
    expect(screen.getByText("detail.selection.selected")).toBeInTheDocument();
    expect(screen.getByText("detail.project.proposalPhaseBadge")).toBeInTheDocument();
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("statut de sélection indécidable : aucune pastille plutôt qu'une affirmation sans fondement", () => {
    poser("visiteur", (p) => ({ ...p, selection: { ...p.selection, isSelected: null } }));
    expect(screen.queryByText("detail.selection.pending")).toBeNull();
    expect(screen.queryByText("detail.selection.selected")).toBeNull();
  });

  it("enveloppe en vol : ni phase, ni « Ouvrir le projet », ni passage en projet — un squelette", () => {
    const { container } = poser("admin", (p) => ({ ...p, project: { ...p.project, isLoading: true, projectId: undefined } }));
    expect(screen.queryByText("detail.project.proposalPhaseBadge")).toBeNull();
    expect(screen.queryByRole("button", { name: /detail\.project\.openCta/ })).toBeNull();
    expect(entree(/detail\.project\.generateCta/)).toBeNull();
    expect(entree(/detail\.project\.associateCta/)).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
});

describe("CommunActionBar — un seul bouton plein, la décision ouverte", () => {
  it("admin, commun en attente : « Ajouter à l'annuaire » est l'unique aplat, juste avant « ⋯ »", () => {
    const { container } = poser("admin");
    const aplats = pleins(container);
    expect(aplats).toHaveLength(1);
    expect(aplats[0]).toHaveTextContent("detail.selection.selectCta");
    const boutons = Array.from(container.querySelectorAll("[data-commun-action-bar] button"));
    expect(boutons.indexOf(aplats[0])).toBe(boutons.indexOf(plusDActions() as HTMLElement) - 1);
  });

  it("commun sélectionné : plus aucun aplat, et le retrait passe dans « ⋯ »", () => {
    const { container } = poser("admin", (p) => ({ ...p, selection: { ...p.selection, isSelected: true } }));
    expect(pleins(container)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /detail\.selection\.selectCta/ })).toBeNull();
    expect(entree(/detail\.selection\.deselectCta/)).toBeInTheDocument();
  });

  it("l'auteur n'a aucun aplat : son passage en projet est dans « ⋯ »", () => {
    const { container } = poser("auteur");
    expect(pleins(container)).toHaveLength(0);
    expect(entree(/detail\.project\.generateCta/)).toBeInTheDocument();
    expect(entree(/detail\.project\.associateCta/)).toBeInTheDocument();
  });
});

describe("CommunActionBar — les dialogues vivent HORS du menu", () => {
  it.each([
    [/delete\.cta/, "delete-dialog"],
    [/detail\.project\.associateCta/, "finder-search-modal"],
    [/detail\.editors\.cta/, "editors-dialog"],
  ])("l'entrée %s ouvre un dialogue qui survit à la fermeture du menu", (nom, testId) => {
    poser("admin");
    expect(screen.queryByTestId(testId)).toBeNull();
    fireEvent.click(entree(nom) as HTMLElement);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });
});

describe("CommunActionBar — passer en projet, depuis « ⋯ »", () => {
  it("générer demande confirmation, écrit une seule fois, puis prévient la fiche", () => {
    const { props } = poser("admin");
    fireEvent.click(entree(/detail\.project\.generateCta/) as HTMLElement);
    expect(generateMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.confirmGenerate\.confirm/ }));
    expect(generateMutate).toHaveBeenCalledTimes(1);
    const [, rappels] = generateMutate.mock.calls[0] as [unknown, { onSuccess?: () => void }];
    act(() => rappels.onSuccess?.());
    expect(props.project.onLinked).toHaveBeenCalledTimes(1);
  });

  it("annuler la génération n'écrit rien", () => {
    poser("admin");
    fireEvent.click(entree(/detail\.project\.generateCta/) as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.confirmGenerate\.cancel/ }));
    expect(generateMutate).not.toHaveBeenCalled();
  });

  it("associer cherche parmi les projets que l'utilisateur administre, puis rattache le projet choisi", () => {
    const { props } = poser("admin", (p) => ({ ...p, project: { ...p.project, userId: "user-42" } }));
    fireEvent.click(entree(/detail\.project\.associateCta/) as HTMLElement);
    const finder = screen.getByTestId("finder-search-modal");
    expect(JSON.parse(finder.getAttribute("data-filters") ?? "[]")).toEqual([
      { attributeName: "links.contributors.user-42.type", valueName: "citoyens" },
      { attributeName: "links.contributors.user-42.isAdmin", valueName: "true" },
    ]);

    fireEvent.click(screen.getByText("pick-existing-project"));
    expect(associateMutate.mock.calls[0][0]).toEqual({ projectId: "existing-proj-1" });
    const [, rappels] = associateMutate.mock.calls[0] as [unknown, { onSuccess?: () => void }];
    act(() => rappels.onSuccess?.());
    expect(props.project.onLinked).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("finder-search-modal")).toBeNull();
  });

  it("sans utilisateur courant, pas de filtre sûr : « Associer » est désactivé", () => {
    poser("admin", (p) => ({ ...p, project: { ...p.project, userId: null } }));
    expect(entree(/detail\.project\.associateCta/)).toBeDisabled();
  });

  it("projet lié : « Ouvrir le projet » pour tous, et plus de passage en projet", () => {
    poser("visiteur", (p) => ({ ...p, project: { ...p.project, projectId: "proj-1" } }));
    expect(screen.getByRole("button", { name: /detail\.project\.openCta/ })).toBeInTheDocument();
    expect(screen.queryByText("detail.project.proposalPhaseBadge")).toBeNull();
    expect(entree(/detail\.project\.generateCta/)).toBeNull();
  });

  /** Relecture au retour sur l'onglet, co-admin qui lie un projet : le dialogue ouvert ne survit pas. */
  it("une recherche « Associer » ouverte disparaît si un projet arrive entre-temps, et ne revient pas seule", () => {
    const { props, rerender } = poser("admin");
    fireEvent.click(entree(/detail\.project\.associateCta/) as HTMLElement);
    expect(screen.getByTestId("finder-search-modal")).toBeInTheDocument();

    rerender(<CommunActionBar {...props} project={{ ...props.project, projectId: "proj-9" }} />);
    expect(screen.queryByTestId("finder-search-modal")).toBeNull();

    rerender(<CommunActionBar {...props} />);
    expect(screen.queryByTestId("finder-search-modal")).toBeNull();
    expect(associateMutate).not.toHaveBeenCalled();
  });

  it("une confirmation « Générer » ouverte disparaît si l'enveloppe repasse en vol", () => {
    const { props, rerender } = poser("admin");
    fireEvent.click(entree(/detail\.project\.generateCta/) as HTMLElement);
    expect(screen.getByRole("button", { name: /detail\.project\.confirmGenerate\.confirm/ })).toBeInTheDocument();

    rerender(<CommunActionBar {...props} project={{ ...props.project, isLoading: true, projectId: undefined }} />);
    expect(screen.queryByRole("button", { name: /detail\.project\.confirmGenerate\.confirm/ })).toBeNull();
  });

  it.each([
    ["une génération", () => (generatePending = true), (p: Props) => p],
    ["une association", () => (associatePending = true), (p: Props) => p],
    ["une suppression", () => (deletePending = true), (p: Props) => p],
    ["un retrait de l'annuaire", () => (savePending = true), (p: Props) => ({ ...p, selection: { ...p.selection, isSelected: true } })],
  ])("pendant %s lancée depuis « ⋯ », son déclencheur est désactivé — le menu, lui, est refermé", (_quoi, enCours, etat) => {
    enCours();
    poser("admin", etat);
    expect(plusDActions()).toBeDisabled();
  });
});

describe("CommunActionBar — l'annuaire", () => {
  it("écrit `selected` sous le contexte, l'étape et rien d'autre", () => {
    poser("admin");
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.selectCta/ }));
    expect(saveMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.confirmSelect\.confirm/ }));
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0]).toEqual({
      subFormId: "aapStep2",
      contextId: CONTEXTE,
      entry: { value: "selected", type: "organizations", name: "Fédération des CAE" },
    });
  });

  it("écrit `notselected` — jamais null, jamais {} — au retrait, depuis « ⋯ »", () => {
    // `null` déclencherait un $unset et `{}` un 500 côté SDK. Le legacy écrit la trace explicite,
    // le backend traite l'absence à l'identique.
    poser("admin", (p) => ({ ...p, selection: { ...p.selection, isSelected: true } }));
    fireEvent.click(entree(/detail\.selection\.deselectCta/) as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.confirmDeselect\.confirm/ }));
    expect(saveMutate.mock.calls[0][0].entry).toEqual({ value: "notselected", type: "organizations", name: "Fédération des CAE" });
  });

  it("n'écrit rien si l'utilisateur annule", () => {
    poser("admin");
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.selectCta/ }));
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.cancel/ }));
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it.each([
    ["contexte", { contextId: null }],
    ["étape", { subFormId: null }],
  ])("refuse d'écrire à l'aveugle quand il manque le %s : le statut seul", (_quoi, manque) => {
    poser("admin", (p) => ({ ...p, selection: { ...p.selection, ...manque } }));
    expect(screen.queryByRole("button", { name: /detail\.selection\.selectCta/ })).toBeNull();
    expect(screen.getByText("detail.selection.pending")).toBeInTheDocument();
  });

  it("refuse d'écrire à l'aveugle quand il manque la réponse : le statut seul", () => {
    poser("admin", (p) => ({ ...p, answerId: null }));
    expect(screen.queryByRole("button", { name: /detail\.selection\.selectCta/ })).toBeNull();
    expect(screen.getByText("detail.selection.pending")).toBeInTheDocument();
  });

  it("bascule sur une phrase SANS nom quand le contexte n'en a pas", () => {
    // Le legacy écrit `parent[<id>] = {id, type}` sans `name`, et le déplacement d'un formulaire
    // DÉTRUIT un `name` existant : sans repli, le dialogue annoncerait « l'annuaire de « » ».
    poser("admin", (p) => ({ ...p, selection: { ...p.selection, contextName: null } }));
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.selectCta/ }));
    expect(screen.getByText("detail.selection.descriptionNoName.confirmSelect")).toBeInTheDocument();
  });

  it("garde la phrase nommée quand le contexte a un nom", () => {
    poser("admin");
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.selectCta/ }));
    expect(screen.getByText(/detail\.selection\.confirmSelect\.description/)).toBeInTheDocument();
    expect(screen.queryByText("detail.selection.descriptionNoName.confirmSelect")).toBeNull();
  });

  it("désactive « Ajouter à l'annuaire » pendant l'enregistrement", () => {
    savePending = true;
    poser("admin");
    expect(screen.getByRole("button", { name: /detail\.selection\.selectCta/ })).toBeDisabled();
  });
});

describe("CommunActionBar — la suppression, à l'écart", () => {
  it("est une entrée destructive de « ⋯ », qui ouvre la confirmation", () => {
    poser("auteur");
    const supprimer = entree(/delete\.cta/) as HTMLElement;
    expect(supprimer).toHaveAttribute("data-variant", "destructive");
    expect(screen.queryByTestId("delete-dialog")).toBeNull();
    fireEvent.click(supprimer);
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("la confirmation ne se ferme pas pendant l'appel : la suppression en vol reste sous les yeux", () => {
    const { props, rerender } = poser("auteur");
    fireEvent.click(entree(/delete\.cta/) as HTMLElement);

    deletePending = true;
    rerender(<CommunActionBar {...props} />);
    fireEvent.click(screen.getByText("fermer-suppression"));
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();

    deletePending = false;
    rerender(<CommunActionBar {...props} />);
    fireEvent.click(screen.getByText("fermer-suppression"));
    expect(screen.queryByTestId("delete-dialog")).toBeNull();
  });

  it("n'est offerte ni à un éditeur ni à un visiteur", () => {
    poser("editeur");
    expect(entree(/delete\.cta/)).toBeNull();
    expect(plusDActions()).toBeNull();
  });
});

describe("CommunActionBar — modifier, et les éditeurs", () => {
  it("« Modifier » rend la main à la page ; absent sans le droit", () => {
    const { props, unmount } = poser("editeur");
    fireEvent.click(screen.getByRole("button", { name: /detail\.edit\.cta/ }));
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    unmount();

    poser("visiteur");
    expect(screen.queryByRole("button", { name: /detail\.edit\.cta/ })).toBeNull();
  });

  it("« Éditeurs » dit leur nombre en clair et n'ouvre le dialogue qu'au clic", () => {
    poser("admin");
    // Le compteur, collé au libellé, se lirait « Éditeurs1 » : le nom accessible le met entre parenthèses.
    const bouton = screen.getByRole("button", { name: "detail.editors.cta (1)" });
    expect(screen.queryByTestId("editors-dialog")).toBeNull();
    fireEvent.click(bouton);
    expect(screen.getByTestId("editors-dialog")).toBeInTheDocument();
  });

  it("sous `sm`, « Éditeurs » passe dans « ⋯ » : le bouton se masque, l'entrée n'apparaît qu'en mobile", () => {
    poser("admin");
    expect(screen.getByRole("button", { name: /detail\.editors\.cta/ })).toHaveClass("hidden", "sm:inline-flex");
    const miroir = entree(/detail\.editors\.cta/) as HTMLElement;
    expect(miroir.parentElement).toHaveClass("sm:hidden");
    // Le `title` du bouton ne se survole pas sur mobile : l'entrée écrit l'explication.
    expect(miroir).toHaveTextContent("detail.editors.ctaHint");
  });

  it("sans le droit de gérer la liste : ni bouton, ni entrée", () => {
    poser("editeur");
    expect(screen.queryByRole("button", { name: /detail\.editors\.cta/ })).toBeNull();
    expect(entree(/detail\.editors\.cta/)).toBeNull();
  });

  it("« ⋯ » réservé au mobile quand « Éditeurs » y est seul", () => {
    poser("auteur", (p) => ({
      ...p,
      project: { ...p.project, canManage: false },
      deletion: { ...p.deletion, canDelete: false },
    }));
    expect(plusDActions()).toHaveClass("sm:hidden");
  });
});
