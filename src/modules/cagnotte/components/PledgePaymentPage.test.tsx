// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici :
 *  - la commande règle le solde de chaque promesse, ciblée par sa `finkey` ;
 *  - le succès n'est annoncé qu'une fois, après l'enregistrement serveur.
 * Les hooks data sont mockés à leur frontière.
 */

const mocks = vi.hoisted(() => ({
  fundingEnvelope: null as unknown,
}));

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    entity: { id: "org1", fundingEnvelope: mocks.fundingEnvelope, getEntityType: () => "organizations" },
    me: { id: "u1", serverData: { id: "u1", name: "Alice", email: "alice@example.org" }, getEntityType: () => "citoyens" },
    contextId: "org1",
    contextType: "organizations",
  }),
}));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: () => ({ data: { paymentMethods: { helloasso: true }, selectedProject: null }, isLoading: false }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(async () => undefined) }) }));
vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn(async () => null) }));
vi.mock("@stripe/react-stripe-js", () => ({ Elements: ({ children }: { children: unknown }) => children }));
vi.mock("./StripePaymentForm", () => ({ default: () => <div data-testid="stripe-form" /> }));
vi.mock("@/lib/confetti", () => ({ launchConfettiBurst: vi.fn() }));
vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));

const { default: PledgePaymentPage } = await import("./PledgePaymentPage");

const promesse = (over: Record<string, unknown>) => ({
  id: "p1",
  financerId: "u1",
  resourceId: "ans1",
  resourceName: "Commun",
  depenseIndex: 0,
  depenseName: "Palier",
  fundingAmount: 1000,
  userPledge: 0,
  userfundingPledge: [],
  ...over,
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PledgePaymentPage — règlement HelloAsso", () => {
  it("transmet une ligne par promesse réglable et affiche le règlement une fois enregistré", async () => {
    vi.useFakeTimers();
    mocks.fundingEnvelope = vi.fn(async (payload: { action: string }) =>
      payload.action === "helloassoPay"
        ? { success: 1, content: { id: 7, redirectUrl: "https://www.helloasso-sandbox.com/checkout/7" }, bill: "b7" }
        : { success: 1, paid: true, recorded: true, orderId: 99 },
    );
    const onPaymentSuccess = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({ closed: false, close: vi.fn(), location: { href: "" } } as unknown as Window);
    render(
      <PledgePaymentPage
        pledges={[
          promesse({ id: "p1", finkey: "a-1", depenseKey: "0", remainingAmount: 33.5 }),
          promesse({ id: "p2", fundingIndex: 2, depenseIndex: 1, fundingAmount: 20 }),
          promesse({ id: "soldee", finkey: "a-3", remainingAmount: 0 }),
        ] as never[]}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onPaymentSuccess={onPaymentSuccess}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /PaymentConfigPage\.helloasso\.button/ }));
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(mocks.fundingEnvelope).toHaveBeenCalledWith(expect.objectContaining({
      action: "helloassoPay",
      amount: 53.5,
      order: {
        pledges: [
          { answerId: "ans1", depenseKey: "0", financerId: "u1", finkey: "a-1", finIndex: undefined, amount: 33.5 },
          { answerId: "ans1", depenseKey: "1", financerId: "u1", finkey: undefined, finIndex: 2, amount: 20 },
        ],
      },
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(onPaymentSuccess).toHaveBeenCalledTimes(1);
    expect(onPaymentSuccess).toHaveBeenCalledWith(expect.objectContaining({ method: "helloasso", amount: 53.5, transactionId: "99" }));
  });
});
