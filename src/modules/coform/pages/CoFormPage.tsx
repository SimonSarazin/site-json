import { useState } from "react";
import { Link, useLoaderData, useNavigate, useParams, useSearchParams } from "react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AlertCircle, Home, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartCoForm } from "../components/SmartCoForm";
import { CoFormAccessGuard } from "../components/CoFormAccessGuard";
import { CoFormAnswerPicker } from "../components/CoFormAnswerPicker";
import { CoFormThankYou } from "../components/CoFormThankYou";
import { useCoFormQuery, useCoFormFinalMutation } from "../hooks/useCoFormQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import type { AllStepsData } from "../types";
import "../i18n/i18n";

/** État de la page CoForm */
type CoFormPageState =
  | { view: "form"; isEditMode: boolean }
  | { view: "thankYou"; isUpdate: boolean };

/**
 * Page principale pour afficher un formulaire CoForm dynamique
 * Le formId est récupéré depuis l'URL : /coform/:formId
 */
export default function CoFormPage() {
    const loaderData = useLoaderData() as { formId: string } | null;
    const params = useParams();
    
    // Récupérer le formId depuis le loader ou les params
    const formId = loaderData?.formId || params.formId;

    // i18n
    useLoadNamespace("modules/coform");
    const t = useT("modules/coform");
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Paramètres URL standalone
    const stepKeyFromUrl = searchParams.get("step") || undefined;
    const inputKeyFromUrl = searchParams.get("input") || undefined;
    const answerIdFromUrl = searchParams.get("answerId") || undefined;
    const showAnswersFromUrl = searchParams.has("showAnswers");
    const readOnlyFromUrl = searchParams.has("readOnly");

    // Détection du mode standalone
    const isStandalone = !!stepKeyFromUrl;

    // État de la page : formulaire ou page de remerciement
    const [pageState, setPageState] = useState<CoFormPageState>({
      view: "form",
      isEditMode: false,
    });

    // Raccourcis
    const isEditMode = pageState.view === "form" && pageState.isEditMode;

    // Charger les données du formulaire + informations d'accès
    const { formData, access, isLoading, error } = useCoFormQuery({
        formId: formId || "",
        enabled: !!formId,
    });

    const effectiveAnswerId = answerIdFromUrl
        ?? (isEditMode ? (access?.existingAnswerId ?? undefined) : undefined);

    // Résoudre les defaultValues : oneAnswerPerPers → existingAnswer, multi → chercher dans existingAnswers par id
    const resolvedDefaultValues = (() => {
        if (readOnlyFromUrl || effectiveAnswerId) {
            // Mode oneAnswerPerPers : réponse unique dans access.existingAnswer
            if (access?.existingAnswer) return access.existingAnswer;
            // Mode multi-answer : chercher par answerId dans la liste
            if (answerIdFromUrl && access?.existingAnswers) {
                return access.existingAnswers.find(a => a.id === answerIdFromUrl)?.answers ?? undefined;
            }
        }
        return undefined;
    })();

    // Mutation pour soumettre/mettre à jour le formulaire
    const mutation = useCoFormFinalMutation({
        formId: formId || "",
        answerId: effectiveAnswerId,
        onSuccess: () => {
            // En mode standalone, pas de page remerciement (onAfterSubmit gère l'affichage)
            if (!isStandalone) {
                setPageState({ view: "thankYou", isUpdate: !!effectiveAnswerId });
            }
        },
        onError: (error) => {
            showErrorToast(error, "coform.status.error", t);
        },
    });

    // Cas : formId manquant
    if (!formId) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <SiteHeader />
                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="flex justify-center">
                            <div className="p-6 rounded-full bg-muted/50 ring-1 ring-border shadow-sm">
                                <AlertCircle className="w-12 h-12 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                                Formulaire introuvable
                            </h1>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                L'identifiant du formulaire est manquant.
                            </p>
                        </div>
                        <div className="pt-4">
                            <Button asChild variant="outline" className="gap-2">
                                <Link to="/">
                                    <Home className="w-4 h-4" />
                                    Retour à l'accueil
                                </Link>
                            </Button>
                        </div>
                    </div>
                </main>
                <SiteFooter />
            </div>
        );
    }

    // Cas : Chargement en cours
    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <SiteHeader />
                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center space-y-4">
                        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                        <p className="text-muted-foreground">Chargement du formulaire...</p>
                    </div>
                </main>
                <SiteFooter />
            </div>
        );
    }

    // Cas : Erreur de chargement
    if (error) {
        const isConnectionError = error.message.includes('ECONNREFUSED') || error.message.includes('connect');
        
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <SiteHeader />
                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="max-w-lg w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="flex justify-center">
                            <div className="p-6 rounded-full bg-destructive/10 ring-1 ring-destructive/20 shadow-sm">
                                <AlertCircle className="w-12 h-12 text-destructive" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                                {isConnectionError ? 'Backend non disponible' : 'Erreur de chargement'}
                            </h1>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                {isConnectionError 
                                    ? 'Le backend Communecter n\'est pas démarré (port 3000).'
                                    : `Impossible de charger le formulaire "${formId}".`
                                }
                            </p>
                            {isConnectionError && (
                                <div className="bg-muted/50 p-4 rounded-lg text-sm text-left space-y-2">
                                    <p className="font-medium">💡 Deux options :</p>
                                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                        <li>Démarrer le backend PHP Communecter sur le port 3000</li>
                                        <li>Utiliser la <Link to="/coform/test" className="text-primary hover:underline">page de test</Link> avec des données statiques</li>
                                    </ol>
                                </div>
                            )}
                            {!isConnectionError && (
                                <p className="text-sm text-destructive">
                                    {error.message}
                                </p>
                            )}
                        </div>
                        <div className="pt-4 flex gap-3 justify-center">
                            {isConnectionError ? (
                                <Button asChild variant="default" className="gap-2">
                                    <Link to="/coform/test">
                                        Voir la page de test
                                    </Link>
                                </Button>
                            ) : (
                                <Button 
                                    variant="outline" 
                                    className="gap-2"
                                    onClick={() => window.location.reload()}
                                >
                                    Réessayer
                                </Button>
                            )}
                            <Button asChild variant="outline" className="gap-2">
                                <Link to="/">
                                    <Home className="w-4 h-4" />
                                    Retour à l'accueil
                                </Link>
                            </Button>
                        </div>
                    </div>
                </main>
                <SiteFooter />
            </div>
        );
    }

    // Cas : Pas de données
    if (!formData) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <SiteHeader />
                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="max-w-md w-full text-center space-y-8">
                        <div className="flex justify-center">
                            <div className="p-6 rounded-full bg-muted/50 ring-1 ring-border shadow-sm">
                                <AlertCircle className="w-12 h-12 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                                Formulaire introuvable
                            </h1>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Le formulaire "{formId}" n'existe pas ou n'est plus disponible.
                            </p>
                        </div>
                        <div className="pt-4">
                            <Button asChild variant="outline" className="gap-2">
                                <Link to="/">
                                    <Home className="w-4 h-4" />
                                    Retour à l'accueil
                                </Link>
                            </Button>
                        </div>
                    </div>
                </main>
                <SiteFooter />
            </div>
        );
    }

    // Callbacks de soumission
    const handleFinalSubmit = async (
        data: AllStepsData,
        addedOptions?: Record<string, Record<string, string[]>>,
        links?: Record<string, Record<string, { name: string; type: string }>>
    ) => {
        await mutation.mutateAsync({ allData: data, addedOptions, links });
    };

    // Callback standalone après soumission réussie (toast simple, pas de page remerciement)
    const handleAfterStandaloneSubmit = () => {
        showSuccessToast("coform.status.success", t);
    };

    // Mode édition : l'utilisateur a déjà répondu et veut modifier sa réponse
    const handleEditExisting = () => {
        setPageState({ view: "form", isEditMode: true });
    };

    // Depuis la page de remerciement : modifier sa réponse
    const handleEditFromThankYou = () => {
        setPageState({ view: "form", isEditMode: true });
    };

    // Depuis la page de remerciement : soumettre une autre réponse (si autorisé)
    const handleSubmitAnother = () => {
        // Retirer answerId et showAnswers de l'URL, revenir au formulaire vierge
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("answerId");
            next.delete("showAnswers");
            return next;
        });
        setPageState({ view: "form", isEditMode: false });
    };

    // Rendu de la page de remerciement
    if (pageState.view === "thankYou") {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <SiteHeader />
                <main className="flex-1 py-8">
                    <div className="container max-w-4xl mx-auto px-4">
                        <CoFormThankYou
                            config={formData?.thankYou}
                            formName={formData?.name}
                            isUpdate={pageState.isUpdate}
                            onEditAnswer={
                                access?.isOneAnswerPerPers ? handleEditFromThankYou : null
                            }
                            onSubmitAnother={
                                !access?.isOneAnswerPerPers ? handleSubmitAnother : null
                            }
                            onGoHome={() => navigate("/")}
                        />
                    </div>
                </main>
                <SiteFooter />
            </div>
        );
    }

    // Réponse multiple : afficher le picker uniquement si ?showAnswers est dans l'URL
    const showAnswerPicker = showAnswersFromUrl
        && !isStandalone
        && !answerIdFromUrl
        && !isEditMode
        && !readOnlyFromUrl
        && access != null
        && !access.isOneAnswerPerPers
        && access.existingAnswers != null
        && access.existingAnswers.length > 0;

    // Navigation vers le formulaire avec un answerId sélectionné
    const handleSelectAnswer = (answerId: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("answerId", answerId);
            return next;
        });
    };

    // Navigation vers le formulaire sans answerId (nouvelle réponse)
    const handleNewAnswer = () => {
        // Retirer showAnswers de l'URL pour afficher directement le formulaire
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("showAnswers");
            return next;
        });
    };

    // Rendu du sélecteur de réponses (mode réponse multiple)
    if (showAnswerPicker && pageState.view === "form" && !pageState.isEditMode) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <SiteHeader />
                <main className="flex-1 py-8">
                    <div className="container max-w-4xl mx-auto px-4">
                        <CoFormAnswerPicker
                            formName={formData?.name}
                            formData={formData}
                            answers={access.existingAnswers!}
                            onSelectAnswer={handleSelectAnswer}
                            onNewAnswer={handleNewAnswer}
                        />
                    </div>
                </main>
                <SiteFooter />
            </div>
        );
    }

    // Rendu du formulaire avec garde d'accès
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <SiteHeader />
            <main className="flex-1 py-8">
                <div className="container max-w-4xl mx-auto px-4">
                    <CoFormAccessGuard
                        access={(isEditMode || answerIdFromUrl) ? null : access}
                        onEditExisting={handleEditExisting}
                        onLogin={() => {
                            
                        }}
                    >
                        {/* Bandeau mode édition */}
                        {(!!effectiveAnswerId && !isStandalone) && (
                            <div className="mb-6 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
                                <Info className="w-5 h-5 shrink-0" />
                                <p>{t("coform.access.editMode.description")}</p>
                            </div>
                        )}

                        <SmartCoForm
                            formData={formData}
                            submitMode="final"
                            onFinalSubmit={handleFinalSubmit}
                            onAfterSubmit={isStandalone ? handleAfterStandaloneSubmit : undefined}
                            showProgress={true}
                            showStepNumbers={true}
                            defaultValues={resolvedDefaultValues}
                            answerId={effectiveAnswerId}
                            stepKey={stepKeyFromUrl}
                            inputKey={inputKeyFromUrl}
                            readOnly={readOnlyFromUrl}
                        />
                    </CoFormAccessGuard>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
