// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CommunDetailReadyVM } from "../../../hooks/useCommunDetailController";

/**
 * Conformité des interfaces de la fiche, paramétrée sur `AAC_DETAIL_VARIANTS.keys()`.
 * Pour chaque interface, avec un view-model complet :
 *  - la barre d'actions reçoit les props du contrôleur ;
 *  - financement (carte, besoins, cofinanceurs, réactions) ssi `funding !== null` ;
 *  - paliers, contributeurs, actualités et agenda ssi phase `project` ;
 *  - chaque bloc de prose et la galerie sont atteignables (ancre ou onglet) ;
 *  - chaque lien de la carte de financement mène à sa section.
 * Les blocs sont remplacés par des sondes qui notent leurs props.
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

/** Les props reçues par chaque sonde, au dernier rendu. */
const received: Record<string, unknown> = {};
const probe = (name: string) => (props: Record<string, unknown>) => {
  received[name] = props;
  return <div data-testid={`probe-${name}`} />;
};

vi.mock("../CommunActionBar.tsx", () => ({ CommunActionBar: probe("action-bar") }));
vi.mock("../CommunHero.tsx", () => ({ CommunHero: probe("hero") }));
/** Les sections vers lesquelles la VRAIE carte de financement a des liens. */
const CARD_LINKS = ["besoins-financiers", "cofinanceurs", "objectifs"] as const;

// La sonde de la carte porte ses liens, par la même navigation que la vraie.
vi.mock("../CommunFinancingCard.tsx", async () => {
  const { useShowSection } = await import("../../../hooks/useCommunSectionNav");
  return {
    CommunFinancingCard: (props: Record<string, unknown>) => {
      received["funding-card"] = props;
      const showSection = useShowSection();
      return (
        <div data-testid="probe-funding-card">
          {CARD_LINKS.map((id) => (
            <button key={id} type="button" onClick={() => showSection(id)}>{`lien-${id}`}</button>
          ))}
        </div>
      );
    },
  };
});
vi.mock("../CommunReactionStats.tsx", () => ({ CommunReactionStats: probe("reactions") }));
vi.mock("../CommunFinancingSection.tsx", () => ({ CommunFinancingSection: probe("funding-section") }));
vi.mock("../CommunCofinancersTable.tsx", () => ({ CommunCofinancersTable: probe("cofinancers") }));
vi.mock("../CommunActionsSection.tsx", () => ({ CommunActionsSection: probe("actions") }));
vi.mock("../CommunContributorsSection.tsx", () => ({ CommunContributorsSection: probe("contributors") }));
vi.mock("../CommunNewsSection.tsx", () => ({ CommunNewsSection: probe("news") }));
vi.mock("../CommunAgendaSection.tsx", () => ({ CommunAgendaSection: probe("agenda") }));
vi.mock("../CommunProse.tsx", () => ({ CommunProse: probe("prose") }));
vi.mock("../CommunContentSections.tsx", () => ({ GallerySection: probe("gallery") }));
vi.mock("../CommunTocNav.tsx", () => ({ CommunTocNav: () => <nav data-testid="toc" /> }));

// jsdom n'a pas d'IntersectionObserver ; une interface à sommaire en crée un.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

const { AAC_DETAIL_VARIANTS } = await import("./registry");

const pack = (name: string) => ({ __pack: name });

/** Un view-model PRÊT et complet : commun financé, projet lié, deux blocs de prose, une galerie. */
function makeVM(overrides: Partial<CommunDetailReadyVM> = {}): CommunDetailReadyVM {
  return {
    status: "ready",
    seo: { title: "Commun", description: "", image: null, path: "/aac/commun/a1" },
    hero: pack("hero"),
    summary: {
      card: {
        id: "a1",
        title: "Commun",
        hasTitle: true,
        description: "",
        tags: ["tag"],
        maturity: null,
        imageUrl: null,
        funds: [],
        totalRequested: 0,
        totalFunded: 0,
        progressPercent: 0,
        hasFundingRequest: false,
        usersCount: 0,
        interestCount: 0,
        isSelected: null,
        usage: { categories: [], subs: [], bySub: {} },
        createdAt: 0,
        updatedAt: 0,
      },
      longDescription: "",
      usageLabels: {},
    },
    funding: {
      card: pack("funding-card"),
      reactions: pack("reactions"),
      section: pack("funding-section"),
      cofinancers: pack("cofinancers"),
    },
    objectives: {
      phase: "project",
      actions: pack("actions"),
      contributors: pack("contributors"),
      news: pack("news"),
      agenda: pack("agenda"),
    },
    prose: [
      { id: "modele", title: "Modèle économique", icon: "layers", paragraphs: ["Un modèle"] },
      { id: "equipe", title: "Équipe", paragraphs: ["Une équipe"] },
    ],
    isProseLoading: false,
    gallery: { images: [{ src: "http://b/a.jpg", alt: "a.jpg" }] },
    actions: pack("action-bar"),
    overlays: { edit: null, milestones: {} },
    ...overrides,
  } as unknown as CommunDetailReadyVM;
}

async function renderVariant(key: string, vm: CommunDetailReadyVM) {
  await act(async () => {
    await AAC_DETAIL_VARIANTS.preload(key);
  });
  const View = AAC_DETAIL_VARIANTS.get(key);
  await act(async () => {
    render(
      <Suspense fallback={<div data-testid="suspended" />}>
        <View vm={vm} />
      </Suspense>
    );
  });
  await waitFor(() => expect(screen.queryByTestId("suspended")).toBeNull());
}

/** Les onglets de l'interface, s'il y en a — activés comme Radix l'attend (`mousedown`). */
function tabs(): HTMLElement[] {
  return screen.queryAllByRole("tab");
}

/** `found()` devient vrai d'emblée, ou après l'activation d'UN des onglets. */
function reachable(found: () => boolean): boolean {
  if (found()) return true;
  for (const tab of tabs()) {
    act(() => {
      fireEvent.mouseDown(tab, { button: 0 });
    });
    if (found()) return true;
  }
  return false;
}

/** Ni d'emblée, ni derrière aucun onglet. */
function nowhere(found: () => boolean): boolean {
  return !reachable(found);
}

const byTestId = (id: string) => () => screen.queryByTestId(id) !== null;
const byAnchor = (id: string) => () => document.getElementById(id) !== null;

/** Les éléments sur lesquels `scrollIntoView` a été appelé — jsdom ne l'implémente pas. */
const scrolled: Element[] = [];

beforeEach(() => {
  for (const k of Object.keys(received)) delete received[k];
  scrolled.length = 0;
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this);
  });
});
afterEach(cleanup);

describe.each(AAC_DETAIL_VARIANTS.keys())("interface de fiche « %s »", (key) => {
  it("la barre d'actions reçoit les props du contrôleur", async () => {
    const vm = makeVM();
    await renderVariant(key, vm);

    expect(screen.getByTestId("probe-action-bar")).toBeTruthy();
    expect(received["action-bar"]).toEqual(vm.actions);
  });

  it("financement déclaré : les trois blocs sont atteignables, avec leurs props", async () => {
    const vm = makeVM();
    await renderVariant(key, vm);

    for (const [probeName, field] of [
      ["funding-card", "card"],
      ["funding-section", "section"],
      ["cofinancers", "cofinancers"],
    ] as const) {
      expect(reachable(byTestId(`probe-${probeName}`)), `${probeName} introuvable`).toBe(true);
      // `toMatchObject` : une interface peut AJOUTER des props de présentation
      // (`layout`, `secondaryAction`), jamais changer celles du contrôleur.
      expect(received[probeName]).toMatchObject(vm.funding?.[field] ?? {});
    }
  });

  it("réactions rendues à part : avec le paquet du contrôleur", async () => {
    const vm = makeVM();
    await renderVariant(key, vm);

    if (!reachable(byTestId("probe-reactions"))) return; // rendues par la carte elle-même
    expect(received.reactions).toMatchObject(vm.funding!.reactions);
  });

  it("sans étape de financement : aucun des trois blocs, nulle part", async () => {
    await renderVariant(key, makeVM({ funding: null }));

    for (const probeName of ["funding-card", "funding-section", "cofinancers", "reactions"]) {
      expect(nowhere(byTestId(`probe-${probeName}`)), `${probeName} rendu sans financement`).toBe(true);
    }
  });

  it("phase projet : paliers et contributeurs atteignables", async () => {
    await renderVariant(key, makeVM());

    expect(reachable(byTestId("probe-actions"))).toBe(true);
    expect(reachable(byTestId("probe-contributors"))).toBe(true);
  });

  it("sans projet lié, ou phase en résolution : ni paliers, ni contributeurs", async () => {
    await renderVariant(key, makeVM({ objectives: { phase: "none" } }));
    expect(nowhere(byTestId("probe-actions"))).toBe(true);
    expect(nowhere(byTestId("probe-contributors"))).toBe(true);
    cleanup();

    await renderVariant(key, makeVM({ objectives: { phase: "unresolved", isProjectPhase: true } }));
    expect(nowhere(byTestId("probe-actions"))).toBe(true);
    expect(nowhere(byTestId("probe-contributors"))).toBe(true);
  });

  it("actualités et agenda rendus : avec les props du contrôleur, et seulement en phase projet", async () => {
    const vm = makeVM();
    await renderVariant(key, vm);

    if (!reachable(byTestId("probe-news"))) return; // interface sans actualités ni agenda
    expect(reachable(byTestId("probe-agenda"))).toBe(true);
    if (vm.objectives.phase !== "project") throw new Error("vm de test hors phase projet");
    expect(received.news).toEqual(vm.objectives.news);
    expect(received.agenda).toEqual(vm.objectives.agenda);
    cleanup();

    for (const objectives of [{ phase: "none" }, { phase: "unresolved", isProjectPhase: true }] as const) {
      await renderVariant(key, makeVM({ objectives }));
      expect(nowhere(byTestId("probe-news")), `actualités en phase ${objectives.phase}`).toBe(true);
      expect(nowhere(byTestId("probe-agenda")), `agenda en phase ${objectives.phase}`).toBe(true);
      cleanup();
    }
  });

  it("chaque bloc de prose est atteignable par son ancre", async () => {
    const vm = makeVM();
    await renderVariant(key, vm);

    for (const block of vm.prose) {
      expect(reachable(byAnchor(block.id)), `bloc « ${block.id} » introuvable`).toBe(true);
    }
  });

  it("chaque lien de la carte de financement mène à sa section", async () => {
    await renderVariant(key, makeVM());
    expect(reachable(byTestId("probe-funding-card"))).toBe(true);

    for (const id of CARD_LINKS) {
      scrolled.length = 0;
      fireEvent.click(screen.getByRole("button", { name: `lien-${id}` }));
      expect(scrolled.map((el) => el.id), `lien « ${id} »`).toEqual([id]);
      expect(document.getElementById(id), `ancre « ${id} » absente après le clic`).not.toBeNull();
    }
  });

  it("la galerie est atteignable si le site en déclare une, absente sinon", async () => {
    await renderVariant(key, makeVM());
    expect(reachable(byTestId("probe-gallery"))).toBe(true);
    cleanup();

    await renderVariant(key, makeVM({ gallery: null }));
    expect(nowhere(byTestId("probe-gallery"))).toBe(true);
  });
});

describe("registre des interfaces de fiche", () => {
  it("une clé inconnue retombe sur l'interface par défaut", () => {
    expect(AAC_DETAIL_VARIANTS.get("nexistepas")).toBe(AAC_DETAIL_VARIANTS.get("default"));
  });
});
