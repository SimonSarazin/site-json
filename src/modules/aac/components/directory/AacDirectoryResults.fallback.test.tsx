// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { Suspense } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { EMPTY_AAC_USAGE } from "../../lib/aacUsage";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";

/** Repli `Suspense` d'une interface code-splittée : son squelette, sinon celui par défaut ; jamais la frontière parente. */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("./AacDirectorySkeleton", () => ({
  AacDirectorySkeleton: () => <div data-testid="squelette-defaut" />,
}));

vi.mock("./variants/items", async () => {
  const { lazy } = await import("react");
  const { makeVariantRegistry, staticVariant } = await import("@/lib/variants");
  type Variant = Parameters<typeof makeVariantRegistry>[0][string];
  const pending = () => new Promise<never>(() => {});
  /** Un variant dont le chunk n'arrive jamais. */
  const neverLoaded = () => Object.assign(lazy(pending), { preload: pending }) as unknown as Variant;
  /** Un variant code-splitté déjà chargé : non embarqué, mais rendu sans suspendre. */
  const loaded = (testId: string) =>
    Object.assign(() => <div data-testid={testId} />, { preload: () => Promise.resolve() }) as unknown as Variant;
  const stub = staticVariant(() => <article />) as unknown as Variant;

  return {
    AAC_DIRECTORY_CARD_VARIANTS: makeVariantRegistry({ default: stub, pret: neverLoaded(), absent: neverLoaded() }),
    AAC_DIRECTORY_ROW_VARIANTS: makeVariantRegistry({ default: stub, pret: neverLoaded(), absent: neverLoaded() }),
    AAC_DIRECTORY_SKELETON_VARIANTS: makeVariantRegistry({
      default: stub,
      pret: loaded("squelette-interface"),
      absent: neverLoaded(),
    }),
  };
});

const { AacDirectoryResults } = await import("./AacDirectoryResults");

const commun: CommunCard = {
  id: "c1",
  title: "Un commun",
  hasTitle: true,
  description: "",
  tags: [],
  keywords: [],
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
  usage: EMPTY_AAC_USAGE,
  address: null,
  project: null,
  createdAt: 0,
  updatedAt: 0,
};

function renderResults(itemVariant: string) {
  render(
    <Suspense fallback={<div data-testid="frontiere-parente" />}>
      <AacDirectoryResults
        communs={[commun]}
        display="grid"
        columns={3}
        isLoading={false}
        isFetchingNextPage={false}
        error={null}
        lastItemRef={() => {}}
        itemVariant={itemVariant}
      />
    </Suspense>
  );
}

afterEach(cleanup);

describe("AacDirectoryResults — repli d'une interface code-splittée", () => {
  it("carte en chargement : le squelette de l'interface, pas celui par défaut", () => {
    renderResults("pret");

    expect(screen.getByTestId("squelette-interface")).toBeTruthy();
    expect(screen.queryByTestId("squelette-defaut")).toBeNull();
    expect(screen.queryByTestId("frontiere-parente")).toBeNull();
  });

  it("squelette de l'interface pas encore chargé : le squelette par défaut, sans suspendre le parent", () => {
    renderResults("absent");

    expect(screen.getByTestId("squelette-defaut")).toBeTruthy();
    expect(screen.queryByTestId("frontiere-parente")).toBeNull();
  });
});
