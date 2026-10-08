// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici :
 *  - seuls les moyens que l'entité a configurés (`getEnvelopeData.paymentMethods`) sont proposés ;
 *  - sans réponse liée, rien ne peut être encaissé ;
 *  - un paiement part avec sa commande, figée au clic et au centime ;
 *  - contributeur et moyen sont figés pendant un paiement ou l'enregistrement d'une promesse ;
 *  - un paiement encaissé mais non enregistré ne propose que la reprise.
 * Les hooks data sont mockés à leur frontière.
 */

const mocks = vi.hoisted(() => ({
  paymentMethods: null as Record<string, unknown> | null,
  fundingEnvelope: null as unknown,
  saveContribution: null as unknown,
  reponses: {} as Record<string, Array<Record<string, unknown> | Promise<never>>>,
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
vi.mock("@/modules/cagnotte/hooks/useSaveCagnotteContribution", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/cagnotte/hooks/useSaveCagnotteContribution")>()),
  useSaveCagnotteContribution: () => ({ saveContribution: mocks.saveContribution }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(async () => undefined) }) }));
vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn(async () => null) }));
vi.mock("@stripe/react-stripe-js", () => ({ Elements: ({ children }: { children: unknown }) => children }));
vi.mock("./StripePaymentForm", () => ({
  default: ({ onSuccess }: { onSuccess: (data: Record<string, unknown>) => Promise<void> }) => (
    <button type="button" onClick={() => void onSuccess({ stripePaymentMethodId: "pm_1" })}>stripe-pay</button>
  ),
}));
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

const ENREGISTRE = { success: 1, paid: true, recorded: true, orderId: 99 };
const NON_ENREGISTRE = { success: 1, paid: true, recorded: false, orderId: 99, recordError: "depense not found" };
const EN_COURS = { success: 1, paid: false, recorded: false, inProgress: true, orderId: null, recordError: null };
const COMMANDE = { answerId: "ans1", financerId: "u1", fundings: [{ milestoneId: "m1", amount: 50 }] };

function afficher({
  paymentMethods,
  allowPledge = false,
  sansReponse = false,
  reponses = {},
  items = [ITEM],
}: {
  paymentMethods: Record<string, unknown> | null;
  allowPledge?: boolean;
  sansReponse?: boolean;
  reponses?: Record<string, Array<Record<string, unknown> | Promise<never>>>;
  items?: (typeof ITEM)[];
}) {
  const callbacks = { onBack: vi.fn(), onPaymentSuccess: vi.fn(), onClose: vi.fn() };
  mocks.paymentMethods = paymentMethods;
  mocks.saveContribution = vi.fn(async () => true);
  mocks.reponses = {
    helloassoPay: [{ success: 1, content: { id: 7, redirectUrl: "https://www.helloasso-sandbox.com/checkout/7" }, bill: "b7" }],
    helloassoStatus: [ENREGISTRE],
    cagnotteSettle: [ENREGISTRE],
    stripePay: [{ success: 1, message: "Paiement réussi !", intent_id: "pi_1", bill: "b8", recorded: true }],
    ...reponses,
  };
  mocks.fundingEnvelope = vi.fn(async (payload: { action: string }) => {
    const file = mocks.reponses[payload.action] ?? [];
    return file.length > 1 ? file.shift() : file[0];
  });
  const activeItemsIds = new Set(items.map((item) => item.itemId));
  const cagnotteConfig = { ...CAGNOTTE_TYPE_CONFIGS.standard, allowContributionWithoutPaiement: allowPledge };
  const page = (affiches: (typeof ITEM)[]) => (
    <PaymentConfigPage
      resourceName="Commun"
      resourceId="ans1"
      amount={50}
      items={affiches as never[]}
      activeItemsIds={activeItemsIds}
      itemAnswerId={sansReponse ? undefined : "ans1"}
      {...callbacks}
      currentUser={null}
      context=""
      cagnotteConfig={cagnotteConfig}
    />
  );
  const rendu = render(page(items));
  return { ...rendu, ...callbacks, changerItems: (affiches: (typeof ITEM)[]) => rendu.rerender(page(affiches)) };
}

const moyen = (cle: string) => screen.queryByRole("radio", { name: `PaymentConfigPage.${cle}.title` });
const boutonHelloAsso = () => screen.queryByRole("button", { name: /PaymentConfigPage\.helloasso\.button/ });
const appels = (action: string) =>
  (mocks.fundingEnvelope as ReturnType<typeof vi.fn>).mock.calls.filter(([payload]) => payload.action === action);

/** Clic sur le bouton HelloAsso, popup simulée. */
async function payerAvecHelloAsso() {
  vi.spyOn(window, "open").mockReturnValue({ closed: false, close: vi.fn(), location: { href: "" } } as unknown as Window);
  await act(async () => {
    fireEvent.click(boutonHelloAsso()!);
    await vi.advanceTimersByTimeAsync(1);
  });
}

async function attendre(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

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

  it("ne propose pas Stripe sans la clé publique de l'entité", () => {
    afficher({ paymentMethods: { stripe: true, helloasso: true } });

    expect(moyen("stripe")).not.toBeInTheDocument();
    expect(moyen("helloasso")).toBeInTheDocument();
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
    expect(boutonHelloAsso()).toBeEnabled();
  });

  it("bloque le paiement sans réponse où enregistrer la contribution", () => {
    afficher({ paymentMethods: { helloasso: true }, sansReponse: true });

    expect(screen.getByText("PaymentConfigPage.missingAnswer")).toBeInTheDocument();
    expect(boutonHelloAsso()).toBeDisabled();
  });
});

describe("PaymentConfigPage — paiement HelloAsso", () => {
  it("envoie la commande au serveur, puis affiche le succès une fois le paiement enregistré", async () => {
    vi.useFakeTimers();
    const { onPaymentSuccess } = afficher({ paymentMethods: { helloasso: true } });

    await payerAvecHelloAsso();

    expect(mocks.fundingEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ action: "helloassoPay", amount: 50, order: COMMANDE }),
    );
    expect(screen.getByText("PaymentConfigPage.waiting.title")).toBeInTheDocument();

    await attendre(5_000);

    expect(mocks.fundingEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ action: "helloassoStatus", checkoutIntentId: "7" }),
    );
    expect(screen.getByText("PaymentConfigPage.successScreen.title")).toBeInTheDocument();
    expect(onPaymentSuccess).toHaveBeenCalledWith(expect.objectContaining({ method: "helloasso", amount: 50, transactionId: "99" }));
    expect(mocks.saveContribution).not.toHaveBeenCalled();
  });

  it("la commande garde le montant du clic, même si les données changent pendant l'attente", async () => {
    vi.useFakeTimers();
    const { changerItems, onPaymentSuccess } = afficher({ paymentMethods: { helloasso: true } });

    await payerAvecHelloAsso();
    // Autre contribution pendant l'attente : il ne reste que 20 € à financer.
    changerItems([{ ...ITEM, currentFunding: 80 }]);
    await attendre(5_000);

    expect(appels("helloassoPay")[0][0]).toMatchObject({ order: COMMANDE });
    expect(onPaymentSuccess).toHaveBeenCalledWith(expect.objectContaining({ amount: 50 }));
  });

  it("contributeur et moyen sont figés pendant l'ouverture du checkout", async () => {
    vi.useFakeTimers();
    afficher({ paymentMethods: { helloasso: true }, reponses: { helloassoPay: [new Promise<never>(() => undefined)] } });

    await payerAvecHelloAsso();

    expect(moyen("helloasso")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "PaymentConfigPage.contributorOptions.organization" })).toBeDisabled();
  });

  it("montants au centime : la commande totalise exactement le montant affiché", async () => {
    vi.useFakeTimers();
    // Reste à financer de 16,666 € par palier : 33,34 € en tout, sous les 50 € saisis.
    const palier = (itemId: string, milestoneId: string, depenseIndex: number) =>
      ({ ...ITEM, itemId, milestoneId, depenseIndex, price: 20, currentFunding: 3.334 });
    afficher({ paymentMethods: { helloasso: true }, items: [palier("i1", "m1", 0), palier("i2", "m2", 1)] });

    await payerAvecHelloAsso();

    expect(appels("helloassoPay")[0][0]).toMatchObject({
      amount: 33.34,
      order: { fundings: [{ milestoneId: "m1", amount: 16.67 }, { milestoneId: "m2", amount: 16.67 }] },
    });
  });

  it("encaissé mais non enregistré : reprise sur la même facture, jamais un nouveau paiement", async () => {
    vi.useFakeTimers();
    afficher({ paymentMethods: { helloasso: true }, reponses: { helloassoStatus: [NON_ENREGISTRE] } });

    await payerAvecHelloAsso();
    await attendre(5_000);

    expect(screen.getByText("PaymentConfigPage.recordingFailed.title")).toBeInTheDocument();
    expect(screen.getByText("depense not found")).toBeInTheDocument();
    expect(boutonHelloAsso()).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "PaymentConfigPage.recordingFailed.retry" }));
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(mocks.fundingEnvelope).toHaveBeenCalledWith(expect.objectContaining({ action: "cagnotteSettle", bill: "b7" }));
    expect(appels("helloassoPay")).toHaveLength(1);
    expect(screen.getByText("PaymentConfigPage.successScreen.title")).toBeInTheDocument();
  });

  it("reprise pendant un enregistrement déjà en cours : message dédié, reprise toujours possible", async () => {
    vi.useFakeTimers();
    afficher({ paymentMethods: { helloasso: true }, reponses: { helloassoStatus: [NON_ENREGISTRE], cagnotteSettle: [EN_COURS] } });

    await payerAvecHelloAsso();
    await attendre(5_000);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "PaymentConfigPage.recordingFailed.retry" }));
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(screen.getByText("PaymentConfigPage.recordingFailed.inProgress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PaymentConfigPage.recordingFailed.retry" })).toBeEnabled();
    expect(appels("helloassoPay")).toHaveLength(1);
  });
});

describe("PaymentConfigPage — paiement Stripe", () => {
  it("le serveur débite et enregistre la commande ; succès avec l'intention Stripe", async () => {
    const { onPaymentSuccess } = afficher({ paymentMethods: { stripe: true, stripePublicKey: "pk_test_x" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "stripe-pay" }));
    });

    expect(mocks.fundingEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ action: "stripePay", payment_method_id: "pm_1", amount: 50, order: COMMANDE }),
    );
    expect(onPaymentSuccess).toHaveBeenCalledWith(expect.objectContaining({ method: "stripe", transactionId: "pi_1" }));
    expect(mocks.saveContribution).not.toHaveBeenCalled();
  });

  it("débit fait mais non enregistré : écran de reprise avec la référence Stripe", async () => {
    afficher({
      paymentMethods: { stripe: true, stripePublicKey: "pk_test_x" },
      reponses: { stripePay: [{ success: 1, intent_id: "pi_1", bill: "b8", recorded: false, recordError: "not allowed" }] },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "stripe-pay" }));
    });

    expect(screen.getByText("PaymentConfigPage.recordingFailed.title")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "stripe-pay" })).not.toBeInTheDocument();
  });
});

describe("PaymentConfigPage — promesse", () => {
  it("contributeur et moyen sont figés pendant l'enregistrement d'une promesse", async () => {
    afficher({ paymentMethods: { helloasso: true }, allowPledge: true });
    mocks.saveContribution = vi.fn(() => new Promise<boolean>(() => undefined));

    fireEvent.click(moyen("pledge")!);
    fireEvent.click(screen.getByRole("checkbox", { name: "PaymentConfigPage.pledge.checkbox" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "PaymentConfigPage.pledge.button" }));
    });

    expect(mocks.saveContribution).toHaveBeenCalledTimes(1);
    expect(moyen("helloasso")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "PaymentConfigPage.contributorOptions.organization" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "PaymentConfigPage.pledge.button" })).toBeDisabled();
  });
});
