// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CAGNOTTE_TYPE_CONFIGS, type CagnotteFundableItem } from "@/modules/cagnotte/types";

/**
 * Ce qui est verrouillé ici : tant que l'enveloppe n'a pas répondu, aucun bloc du dialogue ne se
 * rend dans son état « donnée absente » — sinon il s'ouvre inerte, montants grisés et sans
 * bouton de contribution, avant de s'animer.
 *
 * Ces états ne s'observent pas en local, le serveur de dev répondant en quelques millisecondes ;
 * à la main, il faut brider le réseau (DevTools, profil « Slow 3G »).
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const { CagnotteItemList } = await import("./CagnotteItemList");
const { CagnotteResourceProgressCard } = await import("./CagnotteResourceProgressCard");
const { CagnotteAmountPicker } = await import("./CagnotteAmountPicker");

const config = CAGNOTTE_TYPE_CONFIGS.standard;

function makeItem(over: Partial<CagnotteFundableItem> = {}): CagnotteFundableItem {
  return {
    itemId: "item-1",
    name: "Palier 1",
    description: "",
    price: 1000,
    currentFunding: 250,
    status: "open",
    actions: [],
    allFunding: [],
    ...over,
  } as CagnotteFundableItem;
}

describe("CagnotteItemList — chargement", () => {
  it("ne se rend PAS vide quand les paliers ne sont pas encore arrivés", () => {
    const { container } = render(
      <CagnotteItemList
        items={undefined}
        activeItemIds={new Set()}
        onItemClick={() => {}}
        cagnotteConfig={config}
        context=""
        isLoading
      />
    );
    // Un `return null` rendrait « en cours » indistinguable de « aucun palier ».
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("reste silencieux quand il n'y a vraiment aucun palier", () => {
    const { container } = render(
      <CagnotteItemList
        items={[]}
        activeItemIds={new Set()}
        onItemClick={() => {}}
        cagnotteConfig={config}
        context=""
        isLoading={false}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("affiche les paliers dès qu'ils arrivent, même si une autre requête charge encore", () => {
    render(
      <CagnotteItemList
        items={[makeItem({ name: "Toiture" })]}
        activeItemIds={new Set()}
        onItemClick={() => {}}
        cagnotteConfig={config}
        context=""
        isLoading
      />
    );
    expect(screen.getByText("Toiture")).toBeTruthy();
  });
});

describe("CagnotteResourceProgressCard — chargement", () => {
  it("n'annonce jamais 0 € comme un vrai total pendant le vol", () => {
    const { container } = render(
      <CagnotteResourceProgressCard totalAmount={0} targetAmount={0} cagnotteConfig={config} context="" isLoading />
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.textContent).not.toContain("0 €");
  });

  it("affiche le montant réel une fois l'enveloppe reçue", () => {
    const { container } = render(
      <CagnotteResourceProgressCard totalAmount={1500} targetAmount={3000} cagnotteConfig={config} context="" />
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(container.textContent).toContain("1");
  });
});

describe("CagnotteAmountPicker — chargement", () => {
  const handlers = { onPredefinedAmountClick: () => {}, onCustomAmountChange: () => {} };

  it("ne présente pas des montants grisés comme s'ils étaient interdits", () => {
    const { container } = render(
      <CagnotteAmountPicker
        predefinedAmounts={[10, 20, 30, 50]}
        selectedAmountType={null}
        selectedPredefinedAmount={null}
        customAmount=""
        // Ce que vaut `maxContributionAmount` tant que l'enveloppe charge : 0, ce qui
        // désactive chaque pastille.
        maxContributionAmount={0}
        remainingToFinanceAmount={0}
        isProcessing={false}
        isLoading
        {...handlers}
      />
    );

    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
    // `radio`, le rôle que rend ToggleGroupItem — chercher un `button` passerait
    // même sans squelette, et le test ne prouverait rien.
    expect(screen.queryByRole("radio", { name: "10€" })).toBeNull();
    expect(container.querySelector("input")).toBeNull();
  });

  it("rend des montants cliquables une fois le reste à financer connu", () => {
    render(
      <CagnotteAmountPicker
        predefinedAmounts={[10, 20]}
        selectedAmountType={null}
        selectedPredefinedAmount={null}
        customAmount=""
        maxContributionAmount={500}
        remainingToFinanceAmount={500}
        isProcessing={false}
        {...handlers}
      />
    );

    const dix = screen.getByRole("radio", { name: "10€" });
    expect(dix.hasAttribute("disabled")).toBe(false);
  });
});
