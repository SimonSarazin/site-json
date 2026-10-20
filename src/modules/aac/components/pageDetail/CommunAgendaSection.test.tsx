// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("@/modules/search/i18n", () => ({}));
vi.mock("react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

type Flux = {
  events: unknown[];
  now: Date;
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: ReturnType<typeof vi.fn>;
};
const flux: Record<"upcoming" | "past", Flux> = {} as never;
vi.mock("@/modules/aac/hooks/useCommunProjectEvents", () => ({
  useCommunProjectEvents: (_projectId: string, bucket: "upcoming" | "past") => flux[bucket],
}));

const { CommunAgendaSection } = await import("./CommunAgendaSection");

const NOW = new Date("2026-10-01T10:00:00Z");
const vide = (): Flux => ({
  events: [],
  now: NOW,
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
});

/** La sous-liste titrée `detail.agendaSection.<bucket>`. */
const liste = (bucket: "upcoming" | "past") =>
  screen.getByRole("heading", { name: `detail.agendaSection.${bucket}` }).parentElement as HTMLElement;

beforeEach(() => {
  flux.upcoming = vide();
  flux.past = vide();
});
afterEach(cleanup);

describe("CommunAgendaSection", () => {
  it("sans projet : rien", () => {
    const { container } = render(<CommunAgendaSection projectId={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("des événements : nom en lien vers leur fiche, date · commune", () => {
    flux.upcoming.events = [
      {
        id: "e1",
        serverData: { name: "Assemblée", slug: "assemblee", startDate: new Date("2026-10-08T14:00:00Z"), address: { addressLocality: "Saint-Pierre" } },
      },
    ];
    render(<CommunAgendaSection projectId="p1" />);

    const lien = within(liste("upcoming")).getByRole("link", { name: "Assemblée" });
    expect(lien.getAttribute("href")).toBe("/profil/assemblee");
    expect(within(liste("upcoming")).getByText(/Saint-Pierre$/)).toBeTruthy();
  });

  it("vide, en erreur, en chargement : chaque flux dit son état", () => {
    flux.past.isError = true;
    render(<CommunAgendaSection projectId="p1" />);

    expect(within(liste("upcoming")).getByText("detail.agendaSection.empty")).toBeTruthy();
    expect(within(liste("past")).getByText("detail.agendaSection.error")).toBeTruthy();
    cleanup();

    flux.upcoming.isLoading = true;
    flux.past.isError = false;
    render(<CommunAgendaSection projectId="p1" />);
    expect(liste("upcoming").querySelector("[aria-busy='true']")).not.toBeNull();
    expect(within(liste("past")).getByText("detail.agendaSection.emptyPast")).toBeTruthy();
  });

  it("« Voir plus » charge la page suivante du flux", () => {
    flux.past.events = [{ id: "e2", serverData: { name: "Atelier", startDate: new Date("2026-09-01T08:00:00Z") } }];
    flux.past.hasNextPage = true;
    render(<CommunAgendaSection projectId="p1" />);

    expect(within(liste("upcoming")).queryByRole("button")).toBeNull();
    fireEvent.click(within(liste("past")).getByRole("button", { name: "detail.agendaSection.more" }));
    expect(flux.past.fetchNextPage).toHaveBeenCalled();
  });
});
