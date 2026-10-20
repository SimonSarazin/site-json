// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { preloadAll } from "vite-preload";
import type { CtaCardGridProps, StatDynamicSource } from "@/types/site-schema";

/**
 * Contrat d'affichage d'un chiffre de tuile, le même pour `stats` et `cta-card-grid` :
 * compte connu → compte ; sinon chiffre écrit ; sinon squelette (attente) ou tiret (absence).
 *
 * Deux défauts d'origine, chacun avec son garde-fou :
 *  - « 0 » rendu pendant le vol et pour toujours après un échec de recherche ;
 *  - tiret rendu dès le SSR par un serveur sans entité, squelette côté client ⇒ erreur
 *    d'hydratation : l'absence ne se tranche qu'après hydratation.
 * Les sources sont doublées une couche sous les hooks d'état (recherche, membres, contexte AAC).
 */

const state = vi.hoisted(() => ({
  entity: { slug: "assoc" } as unknown,
  query: {} as Record<string, unknown>,
  members: {} as Record<string, unknown>,
  aacContext: { formId: "form-1" as string | null, resolved: {} as unknown, isFormLoading: false, configError: null as Error | null },
  aacCount: { count: null as number | null, isLoading: false, error: null as Error | null },
}));

vi.mock("./i18n/i18n", () => ({}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useT", () => ({
  useT: () => (k: unknown) => (typeof k === "string" ? k : (k as { fr: string }).fr),
}));
vi.mock("@/hooks/useLocalization", () => ({
  useLocalization: () => ({ t: (v: unknown) => (typeof v === "string" ? v : (v as { fr: string })?.fr ?? "") }),
}));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: state.entity }),
}));
vi.mock("@/modules/search/hooks/useSearchQuery", () => ({
  useSearchQuery: () => state.query,
}));
vi.mock("@/modules/profil/hooks/useMembersQuery", () => ({
  useEntityMembers: () => state.members,
}));
vi.mock("@/modules/aac/hooks/useAacDirectoryContext", () => ({
  useAacDirectoryContext: () => state.aacContext,
}));
vi.mock("@/modules/aac/hooks/useAacCommunsCount", () => ({
  useAacCommunsCount: () => state.aacCount,
}));
vi.mock("lucide-react/dynamic", () => ({ DynamicIcon: () => <span /> }));
vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: React.ComponentProps<"a"> & { to: string }) => <a href={to} {...p}>{children}</a>,
}));

import { StatValue } from "./StatValue";
import { CtaCardGrid } from "./CtaCardGrid";

const QUERY_IN_FLIGHT = {
  transformedResults: [],
  totalCount: 0,
  hasCount: false,
  isLoading: true,
  isPending: true,
  isFetching: true,
  error: null,
  fetchNextPage: () => Promise.resolve(),
  hasNextPage: false,
  isFetchingNextPage: false,
};

const tile = (stat: { value?: string; source?: StatDynamicSource }) => (
  <div>
    <StatValue stat={stat}>
      {(value) => <strong>{value}</strong>}
    </StatValue>
  </div>
);

// Comme `entry-server.tsx` : les `lazy()` résolus avant le rendu — le SSR rend le vrai composant
// de la tuile AAC, pas le repli du Suspense (sinon le test SSR passerait à vide).
beforeAll(async () => {
  await preloadAll();
});

const SEARCH: StatDynamicSource = { type: "searchCount", entityType: "citoyens" };
const AAC: StatDynamicSource = { type: "aacCommuns" };
const NO_AAC = { formId: null, resolved: null, isFormLoading: false, configError: null };

beforeEach(() => {
  state.entity = { slug: "assoc" };
  state.query = { ...QUERY_IN_FLIGHT };
  state.members = { totalCount: 0, hasCount: false, isLoading: true, error: null };
  state.aacContext = { formId: "form-1", resolved: {}, isFormLoading: false, configError: null };
  state.aacCount = { count: null, isLoading: false, error: null };
});

describe("StatValue", () => {
  it("SSR d'une recherche en vol : squelette, jamais « 0 »", () => {
    const html = renderToString(tile({ source: SEARCH }));
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain(">0<");
  });

  it("recherche en échec : tiret nommé, pas « 0 »", () => {
    state.query = { ...QUERY_IN_FLIGHT, isLoading: false, isPending: false, isFetching: false, error: new Error("500") };
    render(tile({ source: SEARCH }));
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Chiffre non disponible")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("serveur sans entité (AAC injoignable) : squelette en SSR, tiret seulement après hydratation", () => {
    state.aacContext = { formId: "form-1", resolved: null, isFormLoading: false, configError: null };
    const html = renderToString(tile({ source: AAC }));
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain("—");

    render(tile({ source: AAC }));
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("sans entité (slug non résolu) : squelette en SSR, tiret après hydratation", () => {
    state.entity = null;
    state.query = { ...QUERY_IN_FLIGHT, isLoading: false, isFetching: false };
    const html = renderToString(tile({ source: SEARCH }));
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain("—");

    render(tile({ source: SEARCH }));
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("le SSR rend la tuile AAC elle-même (chunk préchargé), pas le repli du Suspense", () => {
    state.aacCount = { count: 144, isLoading: false, error: null };
    expect(renderToString(tile({ source: AAC }))).toContain(">144<");
  });

  it("compte connu : le compte", () => {
    state.aacCount = { count: 144, isLoading: false, error: null };
    render(tile({ source: AAC }));
    expect(screen.getByText("144")).toBeTruthy();
  });

  it("chiffre écrit affiché tant que le compte est en vol", () => {
    const { container } = render(tile({ value: "90", source: SEARCH }));
    expect(screen.getByText("90")).toBeTruthy();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });

  it("membres en échec : tiret, pas le 0 d'attente", () => {
    state.members = { totalCount: 0, hasCount: false, isLoading: false, error: new Error("500") };
    render(tile({ source: { type: "membersCount", toBeValidated: false } }));
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("sans source : le chiffre écrit", () => {
    render(tile({ value: "12" }));
    expect(screen.getByText("12")).toBeTruthy();
  });
});

describe("CtaCardGrid — tuile aacCommuns", () => {
  const props: CtaCardGridProps = {
    headline: { fr: "Chiffres" },
    actions: [],
    stats: [{ label: { fr: "communs" }, source: { type: "aacCommuns" } }],
  };

  it("sans AAC déclaré : tiret, jamais un squelette perpétuel", () => {
    state.aacContext = NO_AAC;
    const { container } = render(<CtaCardGrid id="g" props={props} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });

  it("compte connu : le compte dans la tuile", () => {
    state.aacCount = { count: 7, isLoading: false, error: null };
    render(<CtaCardGrid id="g" props={props} />);
    expect(screen.getByText("7")).toBeTruthy();
  });
});
