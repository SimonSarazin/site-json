// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici :
 *  - seuls les moyens que l'entité a configurés (`getEnvelopeData.paymentMethods`) sont proposés ;
 *  - sans réponse liée, rien ne peut être encaissé ;
 *  - un paiement HelloAsso confirmé par le serveur est enregistré comme versement `helloasso`.
 * Les hooks data sont mockés à leur frontière.
 */

const mocks = vi.hoisted(() => ({
  paymentMethods: null as Record<string, unknown> | null,
  fundingEnvelope: null as unknown,
  saveContribution: null as unknown,
}));

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    entity: { id: "org1", fundingEnvelope: mocks.fundingEnvelope, getEntityType: () => "organizations" },
    me: { id: "u1", serverData: { id: "u1", name: "Alice", email: "alice@example.org" }, getEntityType: () => "citoyens" },
    api: {},
    contextId: "org1",
    contextType: "organizations",
  }),
}));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: () => ({ data: { paymentMethods: mocks.paymentMethods, selectedProject: null }, isLoading: false }),
}));
vi.mock("@/modules/cagnotte/hooks/useUserAdminOrganizations", () => ({
  useUserAdminOrganizationsQuery: () => ({ organizations: [], isLoading: false }),
}));
vi.mock("@/modules/cagnotte/hooks/useSaveCagnotteContribution", () => ({
  useSaveCagnotteContribution: () => ({ saveContribution: mocks.saveContribution }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(async () => undefined) }) }));
vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn(async () => null) }));
vi.mock("@stripe/react-stripe-js", () => ({ Elements: ({ children }: { children: unknown }) => children }));
vi.mock("./StripePaymentForm", () => ({ default: () => <div data-testid="stripe-form" /> }));
vi.mock("@/lib/confetti", () => ({ launchConfettiBurst: vi.fn() }));
vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));

const { default: PaymentConfigPage } = await import("./PaymentConfigPage");
const { CAGNOTTE_TYPE_CONFIGS } = await import("@/modules/cagnotte/types");

const ITEM = {
  fromType: "milestone",
  itemId: "i1",
  milestoneId: "m1",
  depenseIndex: 0,
  name: "Palier 1",
  price: 100,
  status: "open",
  actions: [],
  funding: [],
  currentFunding: 0,
  unpaidFunding: 0,
  userPledge: 0,
  allFunding: [],
};

function afficher({
  paymentMethods,
  allowPledge = false,
  sansReponse = false,
}: {
  paymentMethods: Record<string, unknown> | null;
  allowPledge?: boolean;
  sansReponse?: boolean;
}) {
  const callbacks = { onBack: vi.fn(), onPaymentSuccess: vi.fn(), onClose: vi.fn() };
  mocks.paymentMethods = paymentMethods;
  mocks.saveContribution = vi.fn(async () => true);
  mocks.fundingEnvelope = vi.fn(async (payload: { action: string }) =>
    payload.action === "helloassoPay"
      ? { success: 1, content: { id: 7, redirectUrl: "https://www.helloasso-sandbox.com/checkout/7" } }
      : { success: 1, paid: true, orderId: 99 },
  );
  const activeItemsIds = new Set(["i1"]);
  const cagnotteConfig = { ...CAGNOTTE_TYPE_CONFIGS.standard, allowContributionWithoutPaiement: allowPledge };
  const page = (items: (typeof ITEM)[]) => (
    <PaymentConfigPage
      resourceName="Commun"
      resourceId="ans1"
      amount={50}
      items={items as never[]}
      activeItemsIds={activeItemsIds}
      itemAnswerId={sansReponse ? undefined : "ans1"}
      {...callbacks}
      currentUser={null}
      context=""
      cagnotteConfig={cagnotteConfig}
    />
  );
  const rendu = render(page([ITEM]));
  return { ...rendu, changerItems: (items: (typeof ITEM)[]) => rendu.rerender(page(items)) };
}

const moyen = (cle: string) => screen.queryByRole("radio", { name: `PaymentConfigPage.${cle}.title` });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PaymentConfigPage — moyens proposés", () => {
  it("ne propose que les moyens configurés, plus la promesse si le type l'autorise", () => {
    afficher({ paymentMethods: { stripe: false, helloasso: true, stripePublicKey: "pk_test_x" }, allowPledge: true });

    expect(moyen("helloasso")).toBeInTheDocument();
    expect(moyen("pledge")).toBeInTheDocument();
    expect(moyen("stripe")).not.toBeInTheDocument();
  });

  it("annonce l'absence de moyen configuré", () => {
    afficher({ paymentMethods: { stripe: false, helloasso: false, stripePublicKey: "pk_test_x" } });

    expect(screen.getByText("PaymentConfigPage.noPaymentMethod")).toBeInTheDocument();
    expect(moyen("stripe")).not.toBeInTheDocument();
    expect(moyen("helloasso")).not.toBeInTheDocument();
    expect(moyen("pledge")).not.toBeInTheDocument();
  });

  it("choisit d'office le seul moyen proposé", () => {
    afficher({ paymentMethods: { helloasso: true } });

    expect(moyen("helloasso")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /PaymentConfigPage\.helloasso\.button/ })).toBeEnabled();
  });

  it("bloque le paiement sans réponse où enregistrer la contribution", () => {
    afficher({ paymentMethods: { helloasso: true }, sansReponse: true });

    expect(screen.getByText("PaymentConfigPage.missingAnswer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PaymentConfigPage\.helloasso\.button/ })).toBeDisabled();
  });
});

describe("PaymentConfigPage — paiement HelloAsso", () => {
  it("enregistre le versement une fois le paiement confirmé par le serveur", async () => {
    vi.useFakeTimers();
    const popup = { closed: false, close: vi.fn(), location: { href: "" } };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    afficher({ paymentMethods: { helloasso: true } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /PaymentConfigPage\.helloasso\.button/ }));
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(mocks.fundingEnvelope).toHaveBeenCalledWith(expect.objectContaining({ action: "helloassoPay", amount: 50 }));
    expect(popup.location.href).toBe("https://www.helloasso-sandbox.com/checkout/7");
    expect(screen.getByText("PaymentConfigPage.waiting.title")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(mocks.fundingEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ action: "helloassoStatus", checkoutIntentId: "7" }),
    );
    expect(mocks.saveContribution).toHaveBeenCalledWith(
      "ans1",
      [{ depenseIndex: 0, amount: 50, milestoneId: "m1", depenseKey: undefined }],
      { type: "citoyens", name: "Alice", id: "u1" },
      "helloasso",
      "99",
    );
    expect(screen.getByText("PaymentConfigPage.successScreen.title")).toBeInTheDocument();
  });

  it("enregistre le montant du clic, même si les données changent pendant l'attente", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "open").mockReturnValue({ closed: false, close: vi.fn(), location: { href: "" } } as unknown as Window);
    const { changerItems } = afficher({ paymentMethods: { helloasso: true } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /PaymentConfigPage\.helloasso\.button/ }));
      await vi.advanceTimersByTimeAsync(1);
    });
    // Une autre contribution arrive pendant le paiement : il ne reste plus que 20 € à financer.
    changerItems([{ ...ITEM, currentFunding: 80 }]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(mocks.saveContribution).toHaveBeenCalledWith(
      "ans1",
      [expect.objectContaining({ amount: 50 })],
      expect.anything(),
      "helloasso",
      "99",
    );
  });
});
