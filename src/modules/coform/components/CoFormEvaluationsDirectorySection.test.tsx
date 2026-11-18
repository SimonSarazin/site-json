// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import CoFormEvaluationsDirectorySection from "./CoFormEvaluationsDirectorySection";
import { CoFormEvaluationsDirectorySectionSchema } from "../schema";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  answers: vi.fn(),
  radar: vi.fn(),
  next: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/modules/search/hooks/useSearchQuery", () => ({ useSearchQuery: mocks.search }));
vi.mock("@/modules/profil/hooks/useGetAnwersByFormsQuery", () => ({ useGetAnswersByFormsQuery: mocks.answers }));
vi.mock("../hooks/useMultiEvalData", () => ({ useMultiEvalData: mocks.radar }));
vi.mock("./MultiEvalRadarTabs", () => ({ MultiEvalRadarTabs: () => <div>RADAR</div> }));

const props = { sourceKey: "kpacite", formId: "form", finder: "answers.finder" };
const place = { id: "place-1", slug: "un-lieu", serverData: { name: "Un lieu" } };

function show() {
  render(<MemoryRouter><CoFormEvaluationsDirectorySection id="directory" props={props} /></MemoryRouter>);
}

describe("CoFormEvaluationsDirectorySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.mockReturnValue({
      transformedResults: [place], isPending: false, error: null, refetch: mocks.retry,
      hasNextPage: true, fetchNextPage: mocks.next, isFetchingNextPage: false,
    });
    mocks.answers.mockReturnValue({
      data: [{ id: "form", answers: [{ id: "answer-1" }, { id: "answer-2" }] }],
      isLoading: false, error: null, refetch: mocks.retry,
    });
    mocks.radar.mockReturnValue({ data: { steps: [{ stepKey: "s" }] }, isLoading: false, error: null, refetch: mocks.retry });
  });

  it("recherche le slug configuré et affiche toutes les réponses du lieu", () => {
    show();
    expect(mocks.search.mock.calls[0][0].baseParams.sourceKey).toEqual(["kpacite"]);
    expect(mocks.answers.mock.calls[0][0].forms).toEqual({
      form: { name: "form", finder: "answers.finder", linked: true, hide: false, openMode: "modal" },
    });
    expect(mocks.radar.mock.calls.map(([options]) => options.answerId)).toEqual(["answer-1", "answer-2"]);
    expect(screen.getAllByText("RADAR")).toHaveLength(2);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/profil/un-lieu");
    fireEvent.click(screen.getByText("coform.evaluationsDirectory.more"));
    expect(mocks.next).toHaveBeenCalledOnce();
  });

  it("distingue l'absence de réponse d'une erreur et permet de réessayer", () => {
    mocks.answers.mockReturnValue({ data: [{ id: "form", answers: [] }], isLoading: false, error: null });
    const { rerender } = render(<MemoryRouter><CoFormEvaluationsDirectorySection props={props} /></MemoryRouter>);
    expect(screen.getByText("coform.evaluationsDirectory.noAnswers")).toBeTruthy();
    mocks.answers.mockReturnValue({ data: undefined, isLoading: false, error: new Error("backend"), refetch: mocks.retry });
    rerender(<MemoryRouter><CoFormEvaluationsDirectorySection props={props} /></MemoryRouter>);
    expect(screen.getByRole("alert").textContent).toContain("coform.evaluationsDirectory.answersError");
    fireEvent.click(screen.getByText("coform.evaluationsDirectory.retry"));
    expect(mocks.retry).toHaveBeenCalledOnce();
  });

  it("signale une erreur de radar plutôt qu'une évaluation absente", () => {
    mocks.radar.mockReturnValue({ data: null, isLoading: false, error: new Error("backend"), refetch: mocks.retry });
    show();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.queryByText("coform.evaluationsDirectory.noRadar")).toBeNull();
  });

  it("exige un slug, un formulaire et un finder non vides", () => {
    expect(CoFormEvaluationsDirectorySectionSchema.safeParse({ type: "coform-evaluations-directory", props }).success).toBe(true);
    expect(CoFormEvaluationsDirectorySectionSchema.safeParse({ type: "coform-evaluations-directory", props: { ...props, finder: "" } }).success).toBe(false);
  });
});
