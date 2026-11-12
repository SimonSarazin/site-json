// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Reservation } from "../../lib/reservations";
import type { ReservationsConf } from "../../schema";

/**
 * Bouton « Ajouter un créneau » de la fiche ORGANISATION, aligné sur la fiche équipement (seconde note de
 * Thomas sur la MR 114) : réservé aux admins par défaut ; avec `adminOnly: false`, un visiteur déconnecté le
 * voit aussi, et le clic ouvre la connexion au lieu du formulaire.
 */
const ctx = vi.hoisted(() => ({
  me: null as { id: string } | null,
  isAdmin: false,
  openLogin: vi.fn(),
}));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: ctx.me, entity: { id: "site" } }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => undefined }));
vi.mock("@/modules/auth", () => ({ useAuthModal: () => ({ openLogin: ctx.openLogin }) }));
vi.mock("@/modules/profil/hooks/useProfilPermissions", () => ({
  useProfilPermissions: () => ({ isAdmin: ctx.isAdmin }),
}));
// Lecture des réservations et contrôles de saisie : hors sujet ici, mocks inertes.
vi.mock("../../hooks/useOrgaReservationsQuery", () => ({
  useOrgaReservationsQuery: () => ({ data: [RESERVATION], isLoading: false, isError: false }),
}));
vi.mock("../../hooks/useResourcesInPerimeterQuery", () => ({
  useResourcesInPerimeterQuery: () => ({ allowed: null, isLoading: false, isError: false }),
}));
vi.mock("../../hooks/useBookingChecks", () => ({
  useBookingChecks: () => ({ beforeSubmit: vi.fn(), slotCheck: vi.fn(), afterSave: vi.fn() }),
}));
vi.mock("../../hooks/useUpdateSlotHours", () => ({
  useUpdateSlotHours: () => ({
    editing: null,
    open: vi.fn(),
    close: vi.fn(),
    submit: vi.fn(),
    checkLive: vi.fn(),
    saving: false,
  }),
}));
// Le formulaire n'est pas le sujet : seule son ouverture compte. Chargé en lazy, donc résolu en asynchrone.
vi.mock("@/modules/coform/components/CoFormModal", () => ({
  default: () => <div data-testid="formulaire-creneau" />,
}));

import PreviewBookedResources from "./PreviewBookedResources";

const RESERVATION: Reservation = {
  id: "r1",
  resources: [{ id: "poi1", name: "Gymnase du collège" }],
  resourceIds: ["poi1"],
  user: "Club de basket",
  userId: "org1",
  slots: [{ day: "monday", start: "18:00", end: "20:00", startMinutes: 1080, endMinutes: 1200 }],
};

const poser = (booking: ReservationsConf["booking"]) =>
  render(
    <PreviewBookedResources
      orgaId="org1"
      orgaName="Club de basket"
      conf={{
        form: "form-creneaux",
        step: "etape",
        fields: { finder: "equipement", user: "usager", activity: "activite", slots: "creneaux" },
        booking,
      }}
      booked={{}}
    />,
  );
const bouton = () => screen.queryByRole("button", { name: "PreviewBookedResources.addSlotAria" });

beforeEach(() => {
  ctx.me = null;
  ctx.isAdmin = false;
  ctx.openLogin.mockClear();
});

describe("PreviewBookedResources — bouton « Ajouter un créneau »", () => {
  it("par défaut (admins seuls) : aucun bouton pour un visiteur déconnecté", () => {
    poser({});
    expect(bouton()).toBeNull();
  });

  it("admin connecté : le clic ouvre le formulaire", async () => {
    ctx.me = { id: "u1" };
    ctx.isAdmin = true;
    poser({});
    fireEvent.click(bouton()!);
    expect(await screen.findByTestId("formulaire-creneau")).toBeInTheDocument();
    expect(ctx.openLogin).not.toHaveBeenCalled();
  });

  it("`adminOnly: false`, visiteur déconnecté : le bouton s'affiche et ouvre la connexion, pas le formulaire", async () => {
    poser({ adminOnly: false });
    fireEvent.click(bouton()!);
    expect(ctx.openLogin).toHaveBeenCalledTimes(1);
    await expect(screen.findByTestId("formulaire-creneau", {}, { timeout: 200 })).rejects.toThrow();
  });

  it("`adminOnly: false`, membre connecté sans être admin : le clic ouvre le formulaire", async () => {
    ctx.me = { id: "u1" };
    poser({ adminOnly: false });
    fireEvent.click(bouton()!);
    expect(await screen.findByTestId("formulaire-creneau")).toBeInTheDocument();
    expect(ctx.openLogin).not.toHaveBeenCalled();
  });
});
