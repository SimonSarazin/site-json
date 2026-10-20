// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ce que ces cas protègent, sur des boutons qui ÉCRIVENT et SUPPRIMENT :
 *
 *  - la GARDE. Un défaut ici publierait « Supprimer » à des visiteurs. C'est aussi la seule branche
 *    observable sans authentification : le cas admin ne peut pas être exercé dans un navigateur sur
 *    un poste sans `.env.test`, il n'est donc vérifié QUE par ce test.
 *  - la NAVIGATION après suppression : rester sur la fiche laisserait l'écran sur un article qui
 *    n'existe plus, que le rendu suivant afficherait en « introuvable ».
 *  - l'entité passée à la suppression est l'ENTITÉ SDK, pas les données aplaties — seule elle porte
 *    `delete()`.
 */

const permissions = vi.fn();
const navigate = vi.fn();
const mutate = vi.fn();
let onDeleted: (() => void) | undefined;

vi.mock("react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));
vi.mock("@/modules/profil/hooks/useProfilPermissions", () => ({
  useProfilPermissions: () => permissions(),
}));
vi.mock("@/modules/profil/components/profile-edit/EditModalRegistry", () => ({
  DynamicEditModal: ({ open }: { open: boolean }) => (open ? <div data-testid="modale-edition" /> : null),
}));
vi.mock("@/components/shared/ConfirmDialog", () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button data-testid="confirmer" onClick={onConfirm} /> : null,
}));
vi.mock("@/modules/admin/hooks/useDeleteEntity", () => ({
  useDeleteEntity: (cb?: () => void) => {
    onDeleted = cb;
    return { mutate, isPending: false };
  },
}));

import { ArticleAdminActions } from "./ArticleAdminActions";

/** Une entité SDK minimale : ce que le composant lit réellement. */
const entiteSdk = (avecDelete = true) =>
  ({ id: "poi1", ...(avecDelete ? { delete: vi.fn() } : {}) }) as never;

describe("ArticleAdminActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.mockReturnValue({ canEditProfile: true });
  });

  it("SANS la permission : ne rend RIEN — aucun bouton exposé à un visiteur", () => {
    permissions.mockReturnValue({ canEditProfile: false });
    const { container } = render(<ArticleAdminActions entity={entiteSdk()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sans entité (article encore en vol) : ne rend rien, même avec la permission", () => {
    const { container } = render(<ArticleAdminActions entity={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("AVEC la permission : les deux boutons sont là", () => {
    render(<ArticleAdminActions entity={entiteSdk()} />);
    expect(screen.getByText("article.edit")).toBeTruthy();
    expect(screen.getByText("article.delete")).toBeTruthy();
  });

  it("entité sans `delete()` : « Modifier » reste, « Supprimer » disparaît (bouton sans effet évité)", () => {
    render(<ArticleAdminActions entity={entiteSdk(false)} />);
    expect(screen.getByText("article.edit")).toBeTruthy();
    expect(screen.queryByText("article.delete")).toBeNull();
  });

  it("« Modifier » ouvre la modale d'édition", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<ArticleAdminActions entity={entiteSdk()} />);
    expect(screen.queryByTestId("modale-edition")).toBeNull();
    await userEvent.click(screen.getByText("article.edit"));
    expect(screen.getByTestId("modale-edition")).toBeTruthy();
  });

  it("« Supprimer » passe par une CONFIRMATION, et supprime l'ENTITÉ SDK", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const entity = entiteSdk();
    render(<ArticleAdminActions entity={entity} />);
    // Rien n'est supprimé tant que la confirmation n'a pas été rendue puis validée.
    await userEvent.click(screen.getByText("article.delete"));
    expect(mutate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("confirmer"));
    expect(mutate).toHaveBeenCalledWith({ entity, reason: "admin delete" });
  });

  it("une fois supprimé, on QUITTE la fiche (elle n'existe plus)", () => {
    render(<ArticleAdminActions entity={entiteSdk()} backTo="/blog" />);
    onDeleted?.();
    expect(navigate).toHaveBeenCalledWith("/blog");
  });
});
