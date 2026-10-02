import { useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    CreditCard,
    Users,
    ArrowLeft,
    Check,
    ExternalLink,
    Info,
    Clock,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { formatNumber } from "@/modules/cagnotte/utils/format";
import type { UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";
import { availablePaymentChoices, type PaymentChoice } from "@/modules/cagnotte/utils/paymentMethods";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import {
    buildHelloAssoPaymentData,
    validateHelloAssoConfig,
    type HelloAssoPaymentConfig,
} from "@/modules/cagnotte/services/helloAssoService";
import { readFundingEnvelopeResponse } from "@/modules/cagnotte/services/fundingEnvelopeResponse";
import { getStripePublicKey } from "@/modules/cagnotte/services/stripeService";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import {
    useHelloAssoCheckout,
    type HelloAssoAction,
    type HelloAssoPayment,
} from "@/modules/cagnotte/hooks/useHelloAssoCheckout";
import { useUserAdminOrganizationsQuery } from "@/modules/cagnotte/hooks/useUserAdminOrganizations";
import { CagnotteOrganizationPicker } from "./parts/CagnotteOrganizationPicker";
import { useSaveCagnotteContribution } from "@/modules/cagnotte/hooks/useSaveCagnotteContribution";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { launchConfettiBurst } from "@/lib/confetti";
import StripePaymentForm from "./StripePaymentForm";
import {CagnotteFundableItem, DepenseFunding, CagnotteTypeConfig} from "@/modules/cagnotte/types.ts";

interface PaymentConfigPageProps {

    resourceName: string;
    resourceId: string;
    resourceImage?: string;
    amount: number;
    items: CagnotteFundableItem[] | undefined;
    activeItemsIds: Set<string>;
    itemAnswerId?: string; //  ID de l'Answer associée
    itemProjectId?: string; //  ID de du Projet associée
    onBack: () => void;
    onPaymentSuccess: (paymentData: Record<string, unknown>) => void;
    onContributionSaved?: () => void | Promise<void>;
    onClose: () => void;
    currentUser: EntityTypes | null;
    context: string;
    cagnotteConfig: CagnotteTypeConfig;
}

interface PaymentDataPayload extends Record<string, unknown> {
    method?: string;
    transactionId?: string;
}

type PaymentMethod = PaymentChoice | null;
/** Montant et répartition figés au lancement du paiement HelloAsso. */
type HelloAssoSnapshot = { config: HelloAssoPaymentConfig; fundings: DepenseFunding[] };
type ContributorType = "citoyens" | "organizations";

function normalizeFundingContextType(type: string | undefined): string {
    const lowered = (type || "").toLowerCase();
    if (lowered.includes("organization")) return "organizations";
    if (lowered.includes("project")) return "projects";
    if (lowered.includes("citoyen") || lowered.includes("user")) return "citoyens";
    return lowered;
}

const PaymentConfigPage = ({
                               resourceName,
                               resourceId,
                               resourceImage,
                               amount,
                               items,
                               activeItemsIds,
                               itemAnswerId,
                               itemProjectId,
                               onBack,
                               onPaymentSuccess,
                               onContributionSaved,
                               onClose,
                               context,
                               cagnotteConfig
                           }: PaymentConfigPageProps) => {
    const navigate = useNavigate();
    const { entity, me, api, contextId, contextType } = useCocolight();
    const queryClient = useQueryClient();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
    const [contributorType, setContributorType] = useState<ContributorType>(cagnotteConfig.allowPersonToFinance ? "citoyens" : "organizations");
    const [contributorId, setContributorId] = useState<string>(cagnotteConfig.allowPersonToFinance ? (me?.serverData?.id || "") : "");
    const [contributorName, setContributorName] = useState<string>(me?.serverData?.name || "");
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [acceptPledgeCondition, setAcceptPledgeCondition] = useState(false);
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");
    const fundingEnvelopeQuery = useFundingEnvelope(resourceId);
    const fundingPaymentMethods = fundingEnvelopeQuery.data?.paymentMethods ?? fundingEnvelopeQuery.data?.selectedProject?.paymentMethods ?? null;

    const stripePublicKey = fundingPaymentMethods?.stripePublicKey || getStripePublicKey();
    const stripePromise = useMemo(
        () => (stripePublicKey ? loadStripe(stripePublicKey) : null),
        [stripePublicKey]
    );

    const acceptCondition = (e: { target: { checked: boolean | ((prevState: boolean) => boolean); }; }) => {setAcceptPledgeCondition(e.target.checked);};

    // Seuls les moyens configurés pour l'entité sont proposés.
    const isLoadingPaymentMethods = fundingEnvelopeQuery.isLoading;
    const paymentChoices = availablePaymentChoices(fundingPaymentMethods, {
        stripePublicKey,
        allowPledge: cagnotteConfig.allowContributionWithoutPaiement,
    });

    // Désélectionne un moyen retiré, choisit d'office un moyen unique.
    if (!isLoadingPaymentMethods) {
        if (paymentMethod && !paymentChoices.includes(paymentMethod)) {
            setPaymentMethod(null);
        } else if (!paymentMethod && paymentChoices.length === 1) {
            setPaymentMethod(paymentChoices[0]);
        }
    }

    // Hook pour sauvegarder les contributions (dual-strategy: Answer.updateField + fallback save)
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
        () => activeItems.reduce((sum, item) => {
            const currentFunding = Number(item.currentFunding || 0);
            const targetAmount = Number(item.price || 0);
            return sum + Math.max(targetAmount - currentFunding, 0);
        }, 0),
        [activeItems]
    );

    const effectiveAmount = Math.min(amount, maxAllocatable);

    // Allouer le montant saisi du premier au dernier depens actif
    const depenseFunding = useMemo(() => {
        let remainingAmount = effectiveAmount;
        const result = activeItems.map((item) => {
            const currentFunding = Number(item.currentFunding || 0);
            const targetAmount = Number(item.price || 0);
            const remainingToTarget = Math.max(targetAmount - currentFunding, 0);
            const allocatedAmount = Math.max(Math.min(remainingAmount, remainingToTarget), 0);

            remainingAmount -= allocatedAmount;

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

    const submitFundingEnvelopeAction = useCallback(async (
        action: "stripePay" | HelloAssoAction,
        payload: Record<string, unknown>
    ): Promise<UnknownRecord> => {
        if (!entity || typeof entity.fundingEnvelope !== "function") {
            throw new Error(String(t("PaymentConfigPage.errors.fundingEnvelopeUnavailable")));
        }

        const effectiveContextId = contextId || entity.id || itemProjectId;
        const effectiveContextType = normalizeFundingContextType(contextType || entity.getEntityType?.()) || "projects" ;

        if (!effectiveContextId) {
            throw new Error(String(t("PaymentConfigPage.errors.noContextId")));
        }

        const rawResponse = await entity.fundingEnvelope({
            contextId: effectiveContextId,
            contextType: effectiveContextType,
            action,
            ...payload,
        } as Parameters<typeof entity.fundingEnvelope>[0]);

        return readFundingEnvelopeResponse(rawResponse, String(t("PaymentConfigPage.errors.paymentRejected")));
    // `itemProjectId` est lu l.223 (repli de `effectiveContextId`) : sans lui, le
    // callback capturait une valeur périmée. Sans risque de boucle — il n'est
    // consommé que par des gestionnaires d'événements, jamais par un useEffect.
    }, [entity, contextId, contextType, itemProjectId, t]);

    // Bloque un second enregistrement ; repasse à "idle" sur erreur pour permettre une relance.
    const completionStateRef = useRef<"idle" | "running" | "done">("idle");

    // Envelopper completePayment dans useCallback pour éviter les dépendances changeantes
    const completePayment = useCallback(async (
        paymentData: PaymentDataPayload,
        fundingData: DepenseFunding[],
    ) => {
        if (completionStateRef.current !== "idle") return;
        completionStateRef.current = "running";
        try {
            //  Enregistrer les financements dans Answer (si answerId disponible)
            if (itemAnswerId && api) {
                const itemFundingData = fundingData.map((f) => ({
                    depenseIndex: f.depenseIndex,
                    amount: f.amount,
                    milestoneId: f.milestoneId,
                    depenseKey: f.depenseKey,
                }));

                // `saveContribution` accepte directement un id — il charge l'Answer
                // via api.answer({id}) en interne et utilise `answer.updateField` pour
                // la mutation atomique de chaque dépense.
                // Si c'est un pledge, method et transactionId seront undefined ici
                const { method, transactionId } = paymentData;

                const saved = await saveContribution(
                    itemAnswerId,
                    itemFundingData,
                    {
                        type: contributorType,
                        name: contributorName,
                        id: contributorId
                    },
                    method,
                    transactionId
                );

                if (!saved) throw new Error(String(t("PaymentConfigPage.errors.saveFailed")));
            }

            completionStateRef.current = "done";
            setPaymentSuccess(true);
            onPaymentSuccess(paymentData);
            launchConfettiBurst({ originY: 0.34, spread: 84, count: 40 });
        } catch (error) {
            // Échec de l'enregistrement : on repasse à "idle" pour permettre une relance.
            completionStateRef.current = "idle";
            console.error('Erreur completePayment:', error);
            showErrorToast(error, "PaymentConfigPage.toasts.paymentAcceptedIncomplete.title", t);
        } finally {
            await refreshAfterContributionSave();
        }
    }, [itemAnswerId, api, contributorType, contributorName, contributorId, t, onPaymentSuccess, saveContribution, refreshAfterContributionSave]);

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

    const helloAssoConfig = {
        amount: effectiveAmount,
        resourceName,
        resourceId,
        itemsIds: Array.from(activeItemsIds),
        contributorType,
        organizationId: contributorId || undefined,
    };

    // Enregistre la contribution avec le montant et la répartition figés au clic.
    const handleHelloAssoPaid = ({ checkoutIntentId, orderId }: HelloAssoPayment, { config, fundings }: HelloAssoSnapshot) => {
        void completePayment(buildHelloAssoPaymentData(config, orderId ?? checkoutIntentId), fundings);
    };

    const helloAsso = useHelloAssoCheckout<HelloAssoSnapshot>({ submit: submitFundingEnvelopeAction, onPaid: handleHelloAssoPaid });

    // La contribution s'enregistre sur la réponse liée : sans elle, pas de paiement.
    const isFormComplete = Boolean(
        itemAnswerId &&
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

    const handleStripePaymentSuccess = async (stripeData: Record<string, unknown>) => {
        try {
            await submitFundingEnvelopeAction("stripePay", {
                payment_method_id: String(
                    stripeData.stripePaymentMethodId ||
                    stripeData.paymentMethodId ||
                    stripeData.payment_method_id ||
                    ""
                ),
                amount: effectiveAmount,
                email: me?.serverData?.email,
            });

            const contributionData = buildContributionData();

            const finalPayload = {
                ...contributionData,
                method: "stripe",
                transactionId: String(stripeData.transactionId || `stripe_${Date.now()}`)
            };
            const paymentData = {
                ...finalPayload,
                ...stripeData,
            }
            completePayment(paymentData, depenseFunding);
        } catch (error) {
            console.error("Erreur financement Stripe via fundingEnvelope:", error);
            showErrorToast(error, "PaymentConfigPage.toasts.stripeError.title", t);
        }
    };

    // Synchrone jusqu'à `start` : la popup doit s'ouvrir pendant le clic.
    const handleHelloAssoPayment = () => {
        if (!isFormComplete) return;

        // Valider la configuration (codes d'erreur traduits côté UI)
        const validation = validateHelloAssoConfig(helloAssoConfig);
        if (!validation.valid) {
            const messages = validation.errors.map((code) =>
                String(t(`PaymentConfigPage.helloAssoConfigErrors.${code}`))
            );
            showErrorToast(new Error(messages.join(" | ")), "PaymentConfigPage.toasts.paymentError.title", t);
            return;
        }

        void helloAsso.start(effectiveAmount, { config: helloAssoConfig, fundings: depenseFunding });
    };

    const saveContributionAsPromise = async ()  => {
        if (!isFormComplete) return;
        try {
            const paymentData: PaymentDataPayload = {
                ...buildContributionData(),
            };
            await completePayment(paymentData, depenseFunding);
        } catch (error) {
            showErrorToast(error, "PaymentConfigPage.toasts.paymentError.title", t);
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

    if (helloAsso.phase === "waiting") {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.waiting.title")}</h3>
                <p className="text-muted-foreground">{t("PaymentConfigPage.waiting.subtitle")}</p>
                <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.waiting.hint")}</p>
                {helloAsso.lastError && (
                    <p className="text-xs text-destructive">{helloAsso.lastError}</p>
                )}
                <Button onClick={helloAsso.cancel} variant="outline">{t("PaymentConfigPage.waiting.cancel")}</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.title")}</h2>
                <Button onClick={onBack} variant="ghost" size="icon" aria-label={String(t("a11y.back"))} disabled={helloAsso.phase !== "idle"}>
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

            <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.paymentMethodLabel")}</p>
                {isLoadingPaymentMethods ? (
                    <div
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                        role="status"
                        aria-label={String(t("PaymentConfigPage.paymentMethodsLoading"))}
                    >
                        <Skeleton className="h-16 rounded-lg" />
                        <Skeleton className="h-16 rounded-lg" />
                    </div>
                ) : paymentChoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg border border-border/50">
                        {t("PaymentConfigPage.noPaymentMethod")}
                    </p>
                ) : (
                    <ToggleGroup
                        type="single"
                        value={paymentMethod ?? ""}
                        onValueChange={(value) => {
                            const choice = paymentChoices.find((c) => c === value);
                            if (choice) setPaymentMethod(choice);
                        }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                        {paymentChoices.includes("stripe") && (
                            <ToggleGroupItem
                                value="stripe"
                                aria-label={String(t("PaymentConfigPage.stripe.title"))}
                                className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-info/20 flex items-center justify-center shrink-0">
                                        <CreditCard className="w-5 h-5 text-info" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{t("PaymentConfigPage.stripe.title")}</p>
                                        <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.stripe.description")}</p>
                                    </div>
                                </div>
                            </ToggleGroupItem>
                        )}

                        {paymentChoices.includes("helloasso") && (
                            <ToggleGroupItem
                                value="helloasso"
                                aria-label={String(t("PaymentConfigPage.helloasso.title"))}
                                className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                                        <ExternalLink className="w-5 h-5 text-success" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{t("PaymentConfigPage.helloasso.title")}</p>
                                        <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.helloasso.description")}</p>
                                    </div>
                                </div>
                            </ToggleGroupItem>
                        )}

                        {paymentChoices.includes("pledge") && (
                            <ToggleGroupItem
                                value="pledge"
                                aria-label={String(t("PaymentConfigPage.pledge.title"))}
                                className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                                        <Clock className="w-5 h-5 text-success" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{t("PaymentConfigPage.pledge.title")}</p>
                                        <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.pledge.description")}</p>
                                    </div>
                                </div>
                            </ToggleGroupItem>
                        )}
                    </ToggleGroup>
                )}
            </div>

            <div className="space-y-3 pt-4 border-t border-border/50">
                {!itemAnswerId && (
                    <p className="text-sm text-destructive">{t("PaymentConfigPage.missingAnswer")}</p>
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
                        disabled={!isFormComplete || helloAsso.phase !== "idle"}
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
                                disabled={!isFormComplete || !acceptPledgeCondition}
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

            {/* Information supplémentaire pour HelloAsso */}
            {paymentMethod === "helloasso" && (
                <div className="text-xs text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-md border border-border/50">
                    <p className="font-semibold flex items-center gap-2"><Info className="w-3.5 h-3.5" />{t("PaymentConfigPage.helloasso.info.title")}</p>
                    <ul className="space-y-1 ml-3 list-disc">
                        <li>{t("PaymentConfigPage.helloasso.info.li1")}</li>
                        <li>{t("PaymentConfigPage.helloasso.info.li2")}</li>
                        <li>{t("PaymentConfigPage.helloasso.info.li3")}</li>
                        <li>{t("PaymentConfigPage.helloasso.info.li4")}</li>
                        <li>{t("PaymentConfigPage.helloasso.info.li5")}</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default PaymentConfigPage;