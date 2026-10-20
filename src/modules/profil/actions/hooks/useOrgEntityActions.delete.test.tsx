// @vitest-environment jsdom
/**
 * QUI voit « Supprimer cette fiche ». L'action est définitive et sort l'élément de tout Communecter :
 * elle ne doit apparaître que si le SITE l'a ouverte (`allowDelete`, absente par défaut) ET que le
 * compte est ADMINISTRATEUR de cette fiche. Une seule des deux conditions ne suffit pas — c'est
 * exactement ce que ce test verrouille, sur le vrai hook.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { Organization } from "@communecter/cocolight-api-client";

import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { ProfilPermissions } from "../../permissions";
import { useOrgEntityActions } from "./useOrgEntityActions";

vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: null }) }));

/** Permissions pilotées par test : seul `isAdmin` nous intéresse ici. */
let permissions: Partial<ProfilPermissions>;
vi.mock("../../hooks/useProfilPermissions", () => ({
  useProfilPermissions: () => permissions,
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <LocalizationProvider>{children}</LocalizationProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const fiche = { slug: "la-plume-a-loup", getEntityType: () => "organizations" } as unknown as Organization;
const actionsDe = (options?: { allowDelete?: boolean; deleteRedirectPath?: string }) =>
  renderHook(() => useOrgEntityActions(fiche, options), { wrapper }).result.current?.actions ?? [];

beforeEach(() => {
  permissions = { isAdmin: true, isMember: true, canFollow: true };
});

describe("useOrgEntityActions — action « Supprimer cette fiche »", () => {
  it("absente par défaut, même pour un administrateur (aucun site ne l'ouvre sans le dire)", () => {
    expect(actionsDe().some((a) => a.type === "delete")).toBe(false);
  });

  it("absente si le site l'ouvre mais que le compte n'est pas admin de la fiche", () => {
    permissions = { isAdmin: false, isMember: true, canFollow: true };
    expect(actionsDe({ allowDelete: true }).some((a) => a.type === "delete")).toBe(false);
  });

  it("présente pour l'administrateur quand le site l'ouvre, destructive et confirmée", () => {
    const action = actionsDe({ allowDelete: true, deleteRedirectPath: "/lieux" }).find((a) => a.type === "delete");
    expect(action).toBeDefined();
    expect(action!.variant).toBe("destructive");
    expect(action!.isDestructive).toBe(true);
    expect(action!.requiresConfirmation).toBe(true);
    // Le dialogue est renseigné : sans texte, la confirmation ne dirait pas ce qu'elle engage.
    expect(action!.confirmationTitle?.length ?? 0).toBeGreaterThan(0);
    expect(action!.confirmationDescription?.length ?? 0).toBeGreaterThan(0);
  });

  it("reste la DERNIÈRE action proposée (le menu la pose derrière un séparateur)", () => {
    const actions = actionsDe({ allowDelete: true });
    expect(actions[actions.length - 1].type).toBe("delete");
  });
});
