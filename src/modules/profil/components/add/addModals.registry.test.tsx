// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * `isOpenableAddModal` tient pour ouvrables les modales standard de `STANDARD_ADD_MODAL_BY_TYPE`.
 * Ce test lie cette table au REGISTRE : chacune s'y ouvre vraiment. Le chemin costum (`add-<id>`)
 * est neutralisé — il accepte n'importe quel nom, et masquerait une modale retirée du registre.
 */

vi.mock("@/modules/auth/hooks/useAuthActions", () => ({ useAuthActions: () => ({ isConnected: true }) }));
vi.mock("@/modules/auth", () => ({ LoginPrompt: () => null }));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: {} }) }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (v: unknown) => String(v) }));
vi.mock("../../forms/EntityFormModal", () => ({
  EntityFormModal: (props: { config?: unknown; spec?: unknown }) =>
    props.config ? <div data-testid="formulaire-standard" /> : <div data-testid="formulaire-costum" />,
}));
vi.mock("../../forms/costum/registerCostumForms", () => ({ getCostumModalSpec: () => undefined }));
// Les configs des formulaires standard : une frontière — seul leur BRANCHEMENT au registre est testé ici.
vi.mock("../../forms/configs/addStandard", () => ({
  addOrganizationConfig: { collection: "organizations" },
  addProjectConfig: { collection: "projects" },
  addEventConfig: { collection: "events" },
  addPoiConfig: { collection: "poi" },
}));

import { DynamicModal } from "./ModalRegistry";
import { STANDARD_ADD_MODAL_BY_TYPE, isOpenableAddModal } from "./addModals";

describe("modales d'ajout standard", () => {
  it.each(Object.entries(STANDARD_ADD_MODAL_BY_TYPE))("%s → `%s` s'ouvre, sur le formulaire standard", async (_type, modale) => {
    expect(isOpenableAddModal(modale, undefined)).toBe(true);
    render(<DynamicModal modalName={modale} open onOpenChange={() => {}} />);
    expect(await screen.findByTestId("formulaire-standard")).toBeInTheDocument();
  });

  it("témoin : un nom hors du registre ne rend aucun formulaire", async () => {
    const { container } = render(<DynamicModal modalName="add-inconnu" open onOpenChange={() => {}} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("formulaire-standard")).not.toBeInTheDocument();
    expect(container.querySelector("[data-testid]")).toBeNull();
  });
});
