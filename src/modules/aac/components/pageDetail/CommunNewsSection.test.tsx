// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("@/modules/news/i18n", () => ({}));

const feedProps: Record<string, unknown>[] = [];
vi.mock("@/modules/news/components/NewsFeed", () => ({
  NewsFeed: (props: Record<string, unknown>) => {
    feedProps.push(props);
    return <div data-testid="feed" />;
  },
}));

let projetCourant: { project: { id: string } | null; isUnresolved: boolean };
vi.mock("@/modules/aac/hooks/useCommunProjectEntity", () => ({
  useCommunProjectEntityQuery: () => projetCourant,
}));

const { CommunNewsSection } = await import("./CommunNewsSection");

beforeEach(() => {
  feedProps.length = 0;
  projetCourant = { project: { id: "p1" }, isUnresolved: false };
});
afterEach(cleanup);

describe("CommunNewsSection", () => {
  it("sans projet : rien", () => {
    const { container } = render(<CommunNewsSection projectId={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("le fil est celui du projet du commun", () => {
    render(<CommunNewsSection projectId="p1" />);

    expect(screen.getByTestId("feed")).toBeTruthy();
    expect(feedProps[feedProps.length - 1]).toMatchObject({ entity: projetCourant.project, entityType: "projects", isEntityLoading: false });
  });

  it("projet pas encore résolu (requête en vol ou pas encore partie) : le squelette du fil, pas l'erreur", () => {
    projetCourant = { project: null, isUnresolved: false };
    render(<CommunNewsSection projectId="p1" />);

    expect(screen.queryByText("detail.newsSection.error")).toBeNull();
    expect(feedProps[feedProps.length - 1]).toMatchObject({ entity: null, isEntityLoading: true });
  });

  it("projet non résolu : un message, pas de fil vide trompeur", () => {
    projetCourant = { project: null, isUnresolved: true };
    render(<CommunNewsSection projectId="p1" />);

    expect(screen.queryByTestId("feed")).toBeNull();
    expect(screen.getByText("detail.newsSection.error")).toBeTruthy();
  });
});
