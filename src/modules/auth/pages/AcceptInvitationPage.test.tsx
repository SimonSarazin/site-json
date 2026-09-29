// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

/**
 * Ce qui est protégé : sur le lien d'une DEMANDE (mail askToBecome), la page doit relayer `linkOption`
 * et `key` au backend. Sans eux, l'action retombe sur `isInviting`, n'écrit RIEN, et la page affiche
 * « déjà répondu » — la demande reste en attente sans que rien ne le signale.
 */

const state = vi.hoisted(() => ({ callEndpoint: vi.fn() }));

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ apiClient: { callEndpoint: state.callEndpoint } }),
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
// Le layout (header/footer du site, SEO) n'est pas l'objet du test.
vi.mock("../components/AuthPageLayout", () => ({
  AuthPageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import AcceptInvitationPage from "./AcceptInvitationPage";

const BASE = "/co2/link/validateinvitationbymail/userId/u1/targetType/organizations/targetId/o1";

function rendre(lien: string) {
  render(
    <MemoryRouter initialEntries={[lien]}>
      <Routes>
        <Route
          path="co2/link/validateinvitationbymail/userId/:userId/targetType/:targetType/targetId/:targetId/*"
          element={<AcceptInvitationPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AcceptInvitationPage — charge utile envoyée au clic", () => {
  beforeEach(() => {
    state.callEndpoint.mockReset();
    state.callEndpoint.mockResolvedValue({ data: { result: true, msg: "ok" } });
  });

  it("demande (askToBecome) : relaie linkOption et key, avec les libellés de demande", async () => {
    rendre(`${BASE}/linkOption/toBeValidated/key/sig123/costumSlug/s/answer/true`);
    expect(screen.getByText("Voulez-vous accepter cette demande ?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Accepter la demande"));
    await waitFor(() => expect(screen.getByText("Votre réponse a été enregistrée.")).toBeInTheDocument());
    expect(state.callEndpoint).toHaveBeenCalledWith("VALIDATE_INVITATION_BY_MAIL", {
      userId: "u1",
      targetType: "organizations",
      targetId: "o1",
      answer: "true",
      linkOption: "toBeValidated",
      key: "sig123",
    });
  });

  it("invitation : exactement les 4 champs historiques, libellés d'invitation", async () => {
    rendre(`${BASE}/costum/true/answer/false`);
    fireEvent.click(screen.getByText("Décliner l'invitation"));
    await waitFor(() => expect(state.callEndpoint).toHaveBeenCalled());
    expect(state.callEndpoint).toHaveBeenCalledWith("VALIDATE_INVITATION_BY_MAIL", {
      userId: "u1",
      targetType: "organizations",
      targetId: "o1",
      answer: "false",
    });
  });

  it("rien n'est envoyé au montage : seul le clic déclenche l'action (scanner anti-spam)", () => {
    rendre(`${BASE}/linkOption/isAdminPending/key/sig123/answer/true`);
    expect(state.callEndpoint).not.toHaveBeenCalled();
  });
});
