// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("../../i18n", () => ({}));
vi.mock("../../hooks/useNewsEntity", () => ({
  useNewsEntity: () => ({ entity: null, entityType: null, isLoading: false, isError: false }),
}));
vi.mock("../NewsFeed", () => ({ NewsFeed: () => <div>Fil d'actualités</div> }));

import { NewsSection } from "./NewsSection";

const props = {
  entitySlug: "tierslieuxbelgique",
  maxItems: 12,
  showAddButton: false,
  showFilters: false,
  showComments: true,
  showReactions: true,
};

afterEach(cleanup);

describe("NewsSection", () => {
  it("affiche le fil sur une page classique", () => {
    render(<MemoryRouter initialEntries={["/actualites"]}><NewsSection props={props} /></MemoryRouter>);
    expect(screen.getByText("Fil d'actualités")).toBeTruthy();
  });

  it("conserve le chargement différé dans les profils", () => {
    render(<MemoryRouter initialEntries={["/profil/exemple"]}><NewsSection props={props} /></MemoryRouter>);
    expect(screen.queryByText("Fil d'actualités")).toBeNull();
    cleanup();

    render(<MemoryRouter initialEntries={["/profil/exemple/news"]}><NewsSection props={props} /></MemoryRouter>);
    expect(screen.getByText("Fil d'actualités")).toBeTruthy();
  });
});
