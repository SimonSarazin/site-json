// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";

/**
 * La page `/aac` (review MR 53, lot 2 — M12) : elle n'est qu'une enveloppe
 * autour de la section annuaire, mais c'est ELLE qui porte le SEO de la route.
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("../i18n", () => ({}));
vi.mock("@/components/layout/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/layout/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("../sections/AacDirectorySection", () => ({ default: () => <div data-testid="annuaire" /> }));

let formId: string | null = "f1";
vi.mock("@/hooks/useSite", () => ({
  useSite: () => ({ config: { aac: formId ? { formId } : undefined } }),
}));

let formServerData: { name?: string; description?: string } | null = null;
vi.mock("../hooks/useAacFormMeta", () => ({
  useAacFormEntity: () => (formServerData ? { serverData: formServerData } : null),
}));

vi.mock("../AacSeo", () => ({
  AacSeo: (props: { title?: string | null; description?: string | null; path?: string | null }) => (
    <div data-testid="seo" data-title={props.title ?? ""} data-description={props.description ?? ""} data-path={props.path ?? ""} />
  ),
}));

const { default: AacPage } = await import("./AacPage");

function renderPage() {
  return render(
    <LocalizationProvider>
      <AacPage />
    </LocalizationProvider>,
  );
}

beforeEach(() => {
  formId = "f1";
  formServerData = null;
});

describe("AacPage — SEO de l'annuaire (M12)", () => {
  it("le nom et la description de l'appel, canonical `/aac`", () => {
    formServerData = { name: "Les communs des CAE", description: "Un appel de la fédération" };
    renderPage();

    const seo = screen.getByTestId("seo");
    expect(seo.getAttribute("data-title")).toBe("Les communs des CAE");
    expect(seo.getAttribute("data-description")).toBe("Un appel de la fédération");
    expect(seo.getAttribute("data-path")).toBe("/aac");
    expect(screen.getByTestId("annuaire")).toBeTruthy();
  });

  it("tant que l'appel n'est pas chargé, un titre générique — jamais vide", () => {
    renderPage();
    expect(screen.getByTestId("seo").getAttribute("data-title")).toBe("page.directoryTitle");
  });

  it("sans `config.aac`, la page d'erreur porte aussi son SEO", () => {
    formId = null;
    renderPage();
    expect(screen.getByText("section.noForm")).toBeTruthy();
    expect(screen.getByTestId("seo").getAttribute("data-title")).toBe("page.directoryTitle");
  });
});
