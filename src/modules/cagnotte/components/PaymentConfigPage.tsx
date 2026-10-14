import { useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    CreditCard,
    Users,
    ArrowLeft,
    Check,
    ExternalLink,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { formatNumber, roundToCents } from "@/modules/cagnotte/utils/format";
import { availablePaymentChoices } from "@/modules/cagnotte/utils/paymentMethods";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import { validateHelloAssoConfig } from "@/modules/cagnotte/services/helloAssoService";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";
import { useHelloAssoCheckout } from "@/modules/cagnotte/hooks/useHelloAssoCheckout";
import { usePaymentChoice } from "@/modules/cagnotte/hooks/usePaymentChoice";
import { usePaymentSettlement } from "@/modules/cagnotte/hooks/usePaymentSettlement";
import { useStripeCharge } from "@/modules/cagnotte/hooks/useStripeCharge";
import { useUserAdminOrganizationsQuery } from "@/modules/cagnotte/hooks/useUserAdminOrganizations";
import { CagnotteOrganizationPicker } from "./parts/CagnotteOrganizationPicker";
import { PaymentMethodPicker } from "./parts/PaymentMethodPicker";
import { HelloAssoWaitingScreen } from "./parts/HelloAssoWaitingScreen";
import { PaymentRecordingScreen } from "./parts/PaymentRecordingScreen";
import { HelloAssoInfo } from "./parts/HelloAssoInfo";
import { useSaveCagnotteContribution } from "@/modules/cagnotte/hooks/useSaveCagnotteContribution";
import { cibleDepense } from "@/modules/cagnotte/utils/commande";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { launchConfettiBurst } from "@/lib/confetti";
import StripePaymentForm from "./StripePaymentForm";
import {CagnotteFundableItem, CagnotteTypeConfig} from "@/modules/cagnotte/types.ts";

interface PaymentConfigPageProps {

    resourceName: string;
    resourceId: string;
    resourceImage?: string;
    amount: number;
    items: CagnotteFundableItem[] | undefined;
    activeItemsIds: Set<string>;
    itemAnswerId?: string; //  ID de l'Answer associée
    onBack: () => void;
    onPaymentSuccess: (paymentData: Record<string, unknown>) => void;
    onContributionSaved?: () => void | Promise<void>;
    onClose: () => void;
    currentUser: EntityTypes | null;
    context: string;
    cagnotteConfig: CagnotteTypeConfig;
}

type ContributorType = "citoyens" | "organizations";
/** Contribution figée au lancement du paiement, rendue à `onPaymentSuccess` une fois enregistrée. */
type PaidContribution = Record<string, unknown> & { amount: number; method: "stripe" | "helloasso" };

/** Reste à financer d'un item, au centime. */
const remainingToTarget = (item: CagnotteFundableItem) =>
    roundToCents(Math.max(Number(item.price || 0) - Number(item.currentFunding || 0), 0));

const PaymentConfigPage = ({
                               resourceName,
                               resourceId,
                               resourceImage,
                               amount,
                               items,
                               activeItemsIds,
                               itemAnswerId,
                               onBack,
                               onPaymentSuccess,
                               onContributionSaved,
                               onClose,
                               context,
                               cagnotteConfig
                           }: PaymentConfigPageProps) => {
    const navigate = useNavigate();
    const { me } = useCocolight();
    const queryClient = useQueryClient();
    const [contributorType, setContributorType] = useState<ContributorType>(cagnotteConfig.allowPersonToFinance ? "citoyens" : "organizations");
    const [contributorId, setContributorId] = useState<string>(cagnotteConfig.allowPersonToFinance ? (me?.serverData?.id || "") : "");
    const [contributorName, setContributorName] = useState<string>(me?.serverData?.name || "");
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [acceptPledgeCondition, setAcceptPledgeCondition] = useState(false);
    const [isSavingPromise, setIsSavingPromise] = useState(false);
    const promiseSavingRef = useRef(false);
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");
    const fundingEnvelopeQuery = useFundingEnvelope(resourceId);
    const fundingPaymentMethods = fundingEnvelopeQuery.data?.paymentMethods ?? fundingEnvelopeQuery.data?.selectedProject?.paymentMethods ?? null;
    const submit = useFundingEnvelopeAction();

    // Clé publique de l'entité : même compte Stripe que le débit serveur.
    const stripePublicKey = fundingPaymentMethods?.stripePublicKey || "";
    const stripePromise = useMemo(
        () => (stripePublicKey ? loadStripe(stripePublicKey) : null),
        [stripePublicKey]
    );

    const acceptCondition = (e: { target: { checked: boolean | ((prevState: boolean) => boolean); }; }) => {setAcceptPledgeCondition(e.target.checked);};

    // Seuls les moyens configurés pour l'entité sont proposés.
    const isLoadingPaymentMethods = fundingEnvelopeQuery.isLoading;
    const paymentChoices = isLoadingPaymentMethods ? [] : availablePaymentChoices(fundingPaymentMethods, {
        stripePublicKey,
        allowPledge: cagnotteConfig.allowContributionWithoutPaiement,
    });
    const [paymentMethod, setPaymentMethod] = usePaymentChoice(paymentChoices);

    const { saveContribution } = useSaveCagnotteContribution();

    const refreshAfterContributionSave = useCallback(async () => {
        // `invalidateQueries` déclenche déjà le refetch des queries actives et await
        // jusqu'à leur résolution — pas besoin d'un `refetchFundingEnvelope()` supplémentaire.
        await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX() }),
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX() }),
            Promise.resolve(onContributionSaved?.()),
        ]);
    }, [queryClient, onContributionSaved]);

    const activeItems = useMemo(
        () => (items || []).filter((i) => activeItemsIds.has(i.itemId)),
        [items, activeItemsIds]
    );

    const maxAllocatable = useMemo(
        () => roundToCents(activeItems.reduce((sum, item) => sum + remainingToTarget(item), 0)),
        [activeItems]
    );

    // Au centime, comme les lignes de la commande.
    const effectiveAmount = roundToCents(Math.min(amount, maxAllocatable));

    // Allouer le montant saisi du premier au dernier depens actif
    const depenseFunding = useMemo(() => {
        let remainingAmount = effectiveAmount;
        const result = activeItems.map((item) => {
            const allocatedAmount = Math.max(Math.min(remainingAmount, remainingToTarget(item)), 0);

            remainingAmount = roundToCents(remainingAmount - allocatedAmount);

            return {
                depenseIndex: item.depenseIndex,
                amount: allocatedAmount,
                // Transmis au serveur, qui en déduit la clé de la dépense — plus
                // fiable que la position, cf. `utils/depenseKey.ts`.
                milestoneId: item.milestoneId,
                // Repli pour une dépense ORPHELINE (sans jalon) : la clé réelle du
                // document, quand la ressource a pu la lire à la source.
                depenseKey: item.depenseKey,
            };
        });

        return result;
    }, [activeItems, effectiveAmount]);

    const redirectToHome = useCallback((showToast = false) => {
        let didNavigate = false;

        try {
            navigate('/', { replace: true });
            didNavigate = true;
        } catch (error) {
            console.warn('navigate(/) a échoué, fallback window.location sera utilisé', error);
        }

        onClose();

        if (showToast) {
            showSuccessToast("PaymentConfigPage.toasts.thankYou.title", t);
        }

        if (!didNavigate && typeof window !== 'undefined') {
            window.location.assign('/');
        }
    }, [navigate, onClose, t]);

    // Organisations où l'utilisateur courant est admin. Sans `search` : même clé de
    // requête que CagnotteDialog → cache déjà chaud ; le picker filtre côté client.
    const currentUserEntity = (me && isUser(me) ? me : null) as User | null;
    const {
        organizations: userAdminOrganizations,
        isLoading: isAdminOrganizationsLoading,
    } = useUserAdminOrganizationsQuery(currentUserEntity, {});

    // Une seule orga administrée : la choisir d'office, un clic de moins.
    // Pattern "adjust state during render" (cf. CagnotteDialog) plutôt qu'un effet.
    if (
        contributorType === "organizations" &&
        !contributorId &&
        !isAdminOrganizationsLoading &&
        userAdminOrganizations.length === 1
    ) {
        setContributorId(userAdminOrganizations[0].id);
        setContributorName(userAdminOrganizations[0].name);
    }

    const financerId = contributorType === "citoyens" ? (contributorId || me?.serverData?.id || "") : contributorId;

    // Issue de l'enregistrement serveur d'un paiement encaissé.
    const settlement = usePaymentSettlement<PaidContribution>({
        submit,
        onRecorded: (contribution, { reference }) => {
            setPaymentSuccess(true);
            onPaymentSuccess({ ...contribution, transactionId: reference ?? undefined });
            launchConfettiBurst({ originY: 0.34, spread: 84, count: 40 });
            void refreshAfterContributionSave();
        },
    });

    const helloAsso = useHelloAssoCheckout<PaidContribution>({ submit, onSettled: settlement.settled });
    // Tentative Stripe non confirmée, gardée par utilisateur et par ressource.
    const userId = me?.serverData?.id;
    const stripeCharge = useStripeCharge<PaidContribution>({
        submit,
        stripe: stripePromise,
        storageKey: userId ? `cagnotte.stripe.${userId}.${resourceId}` : undefined,
        onSettled: settlement.settled,
    });
    const busy = helloAsso.phase !== "idle" || stripeCharge.phase !== "idle" || isSavingPromise;

    // Il faut la réponse liée (où s'enregistre la contribution) et un montant positif.
    const isFormComplete = Boolean(
        itemAnswerId &&
        effectiveAmount > 0 &&
        paymentMethod &&
        contributorType &&
        (contributorType === "citoyens" ||
            (contributorType === "organizations" && userAdminOrganizations.some((org) => org.id === contributorId)))
    );

    const buildContributionData = () => ({
        amount: effectiveAmount,
        resourceName,
        items: activeItems.map((i) => {
            const allocation = depenseFunding.find((df) => df.depenseIndex === i.depenseIndex);
            return {
                id: i.itemId,
                name: i.name,
                amount: allocation?.amount || 0,
            };
        }),
        contributorType,
        organizationId: contributorId || null,
        timestamp: new Date().toISOString(),
    });

    /** Commande envoyée au serveur, qui l'enregistre une fois le paiement vérifié. */
    const buildOrder = () => ({
        answerId: itemAnswerId,
        financerId,
        fundings: depenseFunding
            .filter((funding) => funding.amount > 0)
            .map((funding) => ({ ...cibleDepense(funding), amount: funding.amount })),
    });

    // Le serveur débite puis enregistre la commande dans la même requête.
    const handleStripePaymentSuccess = (stripeData: Record<string, unknown>) =>
        stripeCharge.charge(
            {
                payment_method_id: String(
                    stripeData.stripePaymentMethodId ||
                    stripeData.paymentMethodId ||
                    stripeData.payment_method_id ||
                    ""
                ),
                amount: effectiveAmount,
                email: me?.serverData?.email,
                order: buildOrder(),
            },
            { ...buildContributionData(), method: "stripe" },
        );

    // Synchrone jusqu'à `start` : la popup doit s'ouvrir pendant le clic.
    const handleHelloAssoPayment = () => {
        if (!isFormComplete || busy) return;

        // Valider la configuration (codes d'erreur traduits côté UI)
        const validation = validateHelloAssoConfig({
            amount: effectiveAmount,
            resourceName,
            resourceId,
            itemsIds: Array.from(activeItemsIds),
            contributorType,
            organizationId: contributorId || undefined,
        });
        if (!validation.valid) {
            const messages = validation.errors.map((code) =>
                String(t(`PaymentConfigPage.helloAssoConfigErrors.${code}`))
            );
            showErrorToast(new Error(messages.join(" | ")), "PaymentConfigPage.toasts.paymentError.title", t);
            return;
        }

        void helloAsso.start(effectiveAmount, buildOrder(), { ...buildContributionData(), method: "helloasso" });
    };

    // Promesse : engagement écrit directement, sans paiement.
    const saveContributionAsPromise = async () => {
        if (!isFormComplete || !itemAnswerId || promiseSavingRef.current) return;
        promiseSavingRef.current = true;
        setIsSavingPromise(true);
        try {
            const saved = await saveContribution(itemAnswerId, depenseFunding, {
                type: contributorType,
                name: contributorName,
                id: financerId,
            });
            if (saved) {
                setPaymentSuccess(true);
                onPaymentSuccess(buildContributionData());
                launchConfettiBurst({ originY: 0.34, spread: 84, count: 40 });
            }
        } finally {
            promiseSavingRef.current = false;
            setIsSavingPromise(false);
            await refreshAfterContributionSave();
        }
    };

    if (paymentSuccess) {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.successScreen.title")}</h3>
                <p className="text-muted-foreground">{t("PaymentConfigPage.successScreen.subtitle")}</p>
                <Button onClick={() => redirectToHome(false)} variant="outline">{t("PaymentConfigPage.successScreen.returnButton")}</Button>
            </div>
        );
    }

    if (settlement.status === "failed" && settlement.settlement) {
        return (
            <PaymentRecordingScreen
                reference={settlement.settlement.reference}
                error={settlement.settlement.error}
                inProgress={settlement.settlement.inProgress}
                retrying={settlement.retrying}
                onRetry={() => void settlement.retry()}
                onClose={onClose}
            />
        );
    }

    if (stripeCharge.phase === "unconfirmed") {
        return (
            <PaymentRecordingScreen
                variant="unconfirmed"
                error={stripeCharge.lastError}
                inProgress={stripeCharge.inProgress}
                retrying={stripeCharge.retrying}
                onRetry={() => void stripeCharge.verify()}
                onClose={onClose}
            />
        );
    }

    if (helloAsso.phase === "waiting" || helloAsso.phase === "checking") {
        return (
            <HelloAssoWaitingScreen
                checking={helloAsso.phase === "checking"}
                lastError={helloAsso.lastError}
                onCancel={helloAsso.cancel}
            />
        );
    }

    return (
        <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.title")}</h2>
                <Button onClick={onBack} variant="ghost" size="icon" aria-label={String(t("a11y.back"))} disabled={busy}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
            </div>

            <div className="bg-linear-to-r from-primary/20 to-accent/20 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-4">
                    {resourceImage && (
                        <img src={resourceImage} alt={resourceName} className="w-20 h-20 rounded-lg object-cover" />
                    )}
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{resourceName}</h3>
                        <p className="text-3xl font-bold text-primary">{effectiveAmount.toLocaleString("fr-FR")} €</p>
                        <p className="text-sm text-muted-foreground">
                            {activeItems.length} {String(t("PaymentConfigPage.pledge.selected", undefined, { count: activeItems.length }))}
                        </p>
                    </div>
                </div>

                {activeItems.length > 0 && (
                    <div className="space-y-2 border-t border-border/50 pt-4">
                        <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.milestonesLabel")}</p>
                        <div className="grid grid-cols-1 gap-2">
                            {activeItems.map((i) => {
                                const allocation = depenseFunding.find(df => df.depenseIndex === i.depenseIndex);
                                const allocatedAmount = allocation?.amount || 0;
                                return (
                                    <div key={i.depenseIndex} className="bg-background/50 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">{i.name}</span>
                                            <Badge variant="outline">{formatNumber(allocatedAmount)}€</Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Contributeur et moyen figés tant qu'un paiement ou une promesse est en cours. */}
            <fieldset disabled={busy} className="space-y-6 min-w-0">
                <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">{t( "PaymentConfigPage.contributorTypeLabel")}</p>
                    { cagnotteConfig.allowPersonToFinance && (
                        <ToggleGroup
                            type="single"
                            value={contributorType}
                            onValueChange={(value) => {
                                if (!value) return;
                                if (value === "citoyens") {
                                    setContributorType("citoyens");
                                    setContributorId(currentUserEntity?.serverData?.id || "");
                                    setContributorName(currentUserEntity?.serverData?.name || "");
                                } else if (value === "organizations") {
                                    setContributorType("organizations");
                                    // L'id de la personne ne doit pas survivre au changement de type.
                                    setContributorId("");
                                    setContributorName("");
                                }
                            }}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                            <ToggleGroupItem
                                value="citoyens"
                                aria-label={String(t("PaymentConfigPage.contributorOptions.person"))}
                                className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <Users className="w-4 h-4" /> {t("PaymentConfigPage.contributorOptions.person")}
                                </div>
                            </ToggleGroupItem>

                            <ToggleGroupItem
                                value="organizations"
                                aria-label={String(t("PaymentConfigPage.contributorOptions.organization"))}
                                className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <Users className="w-4 h-4" /> {t("PaymentConfigPage.contributorOptions.organization")}
                                </div>
                            </ToggleGroupItem>
                        </ToggleGroup>
                    )}
                </div>

                {contributorType === "organizations" && (
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                        <CagnotteOrganizationPicker
                            organizations={userAdminOrganizations}
                            isLoading={isAdminOrganizationsLoading}
                            selectedId={contributorId}
                            onSelect={(org) => {
                                setContributorId(org.id);
                                setContributorName(org.name);
                            }}
                        />
                    </div>
                )}

                <PaymentMethodPicker
                    choices={paymentChoices}
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    isLoading={isLoadingPaymentMethods}
                    disabled={busy}
                />
            </fieldset>

            <div className="space-y-3 pt-4 border-t border-border/50">
                {!itemAnswerId && (
                    <p className="text-sm text-destructive">{t("PaymentConfigPage.missingAnswer")}</p>
                )}
                {effectiveAmount <= 0 && (
                    <p className="text-sm text-destructive">{t("PaymentConfigPage.nothingToPay")}</p>
                )}

                {paymentMethod === "stripe" && isFormComplete && (
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.stripe.formLabel")}</p>
                        <Elements stripe={stripePromise}>
                            <StripePaymentForm
                                amount={effectiveAmount}
                                onSuccess={handleStripePaymentSuccess}
                                onError={() => undefined}
                            />
                        </Elements>
                    </div>
                )}

                {paymentMethod === "helloasso" && (
                    <Button
                        onClick={handleHelloAssoPayment}
                        disabled={!isFormComplete || busy}
                        size="lg"
                        className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground"
                    >
                        <ExternalLink className="w-5 h-5 mr-2" />
                        {helloAsso.phase === "opening"
                            ? t("PaymentConfigPage.helloasso.buttonLoading")
                            : t("PaymentConfigPage.helloasso.button", undefined, { amount: formatNumber(effectiveAmount) })}
                    </Button>
                )}

                {paymentMethod === "pledge" && (
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <h3 className="text-sm font-medium">{String(t("PaymentConfigPage.pledge.pledge"))}</h3>
                        <p className="text-sm text-muted-foreground">
                            {String(t("PaymentConfigPage.pledge.confirm", undefined, { amount: effectiveAmount }))}
                        </p>
                        <label className="flex items-start gap-2 text-sm text-muted-foreground">
                            <input type="checkbox" required className="mt-1 accent-[var(--color-primary)]" onChange={acceptCondition}  />
                            <span>{String(t("PaymentConfigPage.pledge.checkbox"))}</span>
                        </label>
                        {/* Même rendu que le bouton « Contribuer » (CagnotteContributeButton). */}
                        <div className="flex justify-center">
                            <Button
                                onClick={saveContributionAsPromise}
                                disabled={!isFormComplete || !acceptPledgeCondition || busy}
                                className="h-12 px-8"
                                size="lg"
                            >
                                {t("PaymentConfigPage.pledge.button", undefined,
                                    {
                                        amount: effectiveAmount,
                                        context: cagnotteConfig.selectorType+context
                                    }
                                )}
                            </Button>
                        </div>
                    </div>

                )}

                {!paymentMethod && paymentChoices.length > 0 && (
                    <Button disabled size="lg" className="w-full h-12">
                        <CreditCard className="w-5 h-5 mr-2" />
                        {t("PaymentConfigPage.selectMethodPlaceholder")}
                    </Button>
                )}
            </div>

            {paymentMethod === "helloasso" && <HelloAssoInfo />}
        </div>
    );
};

export default PaymentConfigPage;
