// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("../i18n", () => ({}));
vi.mock("@/modules/profil/hooks/useNewsDetailUrlGenerator", () => ({ useNewsDetailUrlGenerator: () => null }));
vi.mock("../hooks/useNewsMutations", () => ({ useDeleteNews: () => ({ mutate: vi.fn(), isPending: false }) }));

let permissions = { canAddNews: false, canModerateNews: false, canEditComment: false };
vi.mock("../hooks/useNewsPermissions", () => ({ useNewsPermissions: () => permissions }));

let query: { news: { id: string }[]; isLoading: boolean; isFetchingNextPage: boolean; hasNextPage: boolean; lastItemRef: () => void };
vi.mock("../hooks/useNewsQuery", () => ({ useNewsQuery: () => query }));

vi.mock("./NewsItem", () => ({ NewsItem: ({ item }: { item: { id: string } }) => <article data-testid={`news-${item.id}`} /> }));
vi.mock("./forms/AddNewsModal", () => ({ AddNewsModal: () => null }));
vi.mock("./forms/EditNewsModal", () => ({ EditNewsModal: () => null }));
vi.mock("./DeleteNewsDialog", () => ({ DeleteNewsDialog: () => null }));
vi.mock("./ShareNewsDialog", () => ({ ShareNewsDialog: () => null }));
vi.mock("./ReportDialog", () => ({ ReportDialog: () => null }));

const { NewsFeed } = await import("./NewsFeed");

const entity = { id: "p1", getEntityType: () => "projects" } as never;

beforeEach(() => {
  permissions = { canAddNews: false, canModerateNews: false, canEditComment: false };
  query = { news: [], isLoading: false, isFetchingNextPage: false, hasNextPage: false, lastItemRef: () => {} };
});
afterEach(cleanup);

describe("NewsFeed", () => {
  it("fil vide : message, et « Publier » seulement pour qui peut publier", () => {
    render(<NewsFeed entity={entity} entityType="projects" />);
    expect(screen.getByText("NewsSection.noNews")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /NewsSection\.createPost/ })).toBeNull();
    cleanup();

    permissions = { ...permissions, canAddNews: true };
    render(<NewsFeed entity={entity} entityType="projects" />);
    expect(screen.getByRole("button", { name: /NewsSection\.createPost/ })).toBeTruthy();
  });

  it("une actualité par élément du fil", () => {
    query = { ...query, news: [{ id: "n1" }, { id: "n2" }] };
    render(<NewsFeed entity={entity} entityType="projects" />);

    expect(screen.getByTestId("news-n1")).toBeTruthy();
    expect(screen.getByTestId("news-n2")).toBeTruthy();
  });

  it("entité en résolution : squelette, pas de fil vide", () => {
    render(<NewsFeed entity={null} entityType={null} isEntityLoading />);
    expect(screen.queryByText("NewsSection.noNews")).toBeNull();
  });
});
