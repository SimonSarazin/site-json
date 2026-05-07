import { useState } from "react";
import { Link, useLoaderData, useNavigate, useParams, useSearchParams } from "react-router";
import { Helmet } from "@dr.pogodin/react-helmet";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AlertCircle, Eye, Home, Info, Loader2, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartCoForm } from "../components/SmartCoForm";
import { CoFormReadOnly } from "../components/CoFormReadOnly";
import { CoFormThankYou } from "../components/CoFormThankYou";
import {
  useCoFormQuery,
  useCoFormAnswerQuery,
  useCoFormFinalMutation,
} from "../hooks/useCoFormQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { toast } from "sonner";
import type { AllStepsData } from "../types";
import "../i18n/i18n";

/** Mode d'affichage de la page */
type AnswerViewMode = "readonly" | "edit";

/** État interne de la page */
type AnswerPageState =
  | { view: "answer"; mode: AnswerViewMode }
  | { view: "thankYou" };

/**
 * Page pour afficher/modifier une réponse CoForm existante
 *
 * Route : /coform/:formId/answer/:answerId?mode=edit|readonly
 *
 * - mode=readonly (défaut) : affiche la réponse en lecture seule
 * - mode=edit : affiche le formulaire pré-rempli pour modification
 */
export default function CoFormAnswerPage() {
  const loaderData = useLoaderData() as {
    formId: string;
    answerId: string;
    mode: AnswerViewMode;
  } | null;
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Récupérer les paramètres
  const formId = loaderData?.formId || params.formId;
  const answerId = loaderData?.answerId || params.answerId;
  const initialMode: AnswerViewMode =
    loaderData?.mode ||
    (searchParams.get("mode") as AnswerViewMode) ||
    "readonly";

  // i18n
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  // État de la page
  const [pageState, setPageState] = useState<AnswerPageState>({
    view: "answer",
    mode: initialMode,
  });

  const currentMode = pageState.view === "answer" ? pageState.mode : "readonly";

  // Charger le formulaire (structure)
  const {
    formData,
    isLoading: isFormLoading,
    error: formError,
  } = useCoFormQuery({
    formId: formId || "",
    enabled: !!formId,
  });

  // Charger la réponse existante
  const {
    answer,
    answerData,
    isLoading: isAnswerLoading,
    error: answerError,
  } = useCoFormAnswerQuery({
    formId: formId || "",
    answerId: answerId || "",
    enabled: !!formId && !!answerId,
  });

  // Mutation pour la mise à jour
  const mutation = useCoFormFinalMutation({
    formId: formId || "",
    answerId: answerId,
    onSuccess: () => {
      setPageState({ view: "thankYou" });
    },
    onError: (error) => {
      toast.error(t("coform.status.error"), {
        description: error.message,
      });
    },
  });

  // ── Cas d'erreur / chargement ──────────────────────────────────

  if (!formId || !answerId) {
    return (
      <PageShell>
        <ErrorCard
          title={t("coform.errors.formNotFound")}
          description={t("coform.answer.missingParams")}
        />
      </PageShell>
    );
  }

  if (isFormLoading || isAnswerLoading) {
    return (
      <PageShell>
        <div className="text-center space-y-4 py-12">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            {t("coform.status.loading")}
          </p>
        </div>
      </PageShell>
    );
  }

  if (formError || answerError) {
    return (
      <PageShell>
        <ErrorCard
          title={t("coform.status.error")}
          description={(formError || answerError)?.message || ""}
        />
      </PageShell>
    );
  }

  if (!formData || !answerData) {
    return (
      <PageShell>
        <ErrorCard
          title={t("coform.answer.notFound")}
          description={t("coform.answer.notFoundDescription")}
        />
      </PageShell>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────

  const handleFinalSubmit = async (
    data: AllStepsData,
    addedOptions?: Record<string, Record<string, string[]>>,
    links?: Record<string, Record<string, { name: string; type: string }>>
  ) => {
    await mutation.mutateAsync({ allData: data, addedOptions, links });
  };

  const handleSwitchToEdit = () => {
    setPageState({ view: "answer", mode: "edit" });
  };

  const handleSwitchToReadonly = () => {
    setPageState({ view: "answer", mode: "readonly" });
  };

  // Titre d'onglet : nom du form (formData a passé les early-returns).
  // Suffixé "— Réponse" pour distinguer cette page de la page form classique.
  const documentTitle = `${formData.name ?? t("coform.title")} — ${t("coform.answer.viewingAnswer")}`;

  // ── Page de remerciement après update ──────────────────────────

  if (pageState.view === "thankYou") {
    return (
      <PageShell>
        <Helmet>
          <title>{documentTitle}</title>
        </Helmet>
        <CoFormThankYou
          config={formData.thankYou}
          formName={formData.name}
          isUpdate={true}
          onEditAnswer={() => setPageState({ view: "answer", mode: "edit" })}
          onGoHome={() => navigate("/")}
        />
      </PageShell>
    );
  }

  // ── Résoudre les droits d'édition (côté serveur) ───────────────

  const canEdit = answer?.canEdit === true;
  const editDeniedReason = answer?.editDeniedReason;

  // Si l'utilisateur est en mode edit mais n'a pas le droit, forcer readonly
  const effectiveMode = currentMode === "edit" && !canEdit ? "readonly" : currentMode;

  // ── Résoudre le nom de l'auteur ────────────────────────────────

  const authorName =
    typeof answer?.user === "object" ? answer.user?.name : undefined;

  // ── Rendu principal ────────────────────────────────────────────

  return (
    <PageShell>
      <Helmet>
        <title>{documentTitle}</title>
      </Helmet>

      {/* Bandeau refus d'édition si mode=edit demandé mais non autorisé */}
      {currentMode === "edit" && !canEdit && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          <Lock className="w-5 h-5 shrink-0" />
          <p>{t(`coform.answer.editDenied.${editDeniedReason || "default"}`)}</p>
        </div>
      )}

      {/* Barre d'actions : basculer entre readonly et edit */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">
          {effectiveMode === "readonly"
            ? t("coform.answer.viewingAnswer")
            : t("coform.access.editMode.title")}
        </div>
        <div className="flex gap-2">
          {effectiveMode === "readonly" && canEdit ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleSwitchToEdit}
            >
              <Pencil className="w-3.5 h-3.5" />
              {t("coform.answer.switchToEdit")}
            </Button>
          ) : effectiveMode === "edit" ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={handleSwitchToReadonly}
            >
              <Eye className="w-3.5 h-3.5" />
              {t("coform.answer.switchToReadonly")}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Mode lecture seule */}
      {effectiveMode === "readonly" && (
        <CoFormReadOnly
          formData={formData}
          answerData={answerData}
          authorName={authorName}
          submittedAt={answer?.created}
          updatedAt={answer?.updated}
          answerId={answerId}
        />
      )}

      {/* Mode édition */}
      {effectiveMode === "edit" && (
        <>
          {/* Bandeau mode édition */}
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <Info className="w-5 h-5 shrink-0" />
            <p>{t("coform.access.editMode.description")}</p>
          </div>

          <SmartCoForm
            formData={formData}
            formId={formId}
            submitMode="final"
            onFinalSubmit={handleFinalSubmit}
            showProgress={true}
            showStepNumbers={true}
            defaultValues={answerData}
            answerId={answerId}
            baseUpdatedAt={answer?.updated ?? null}
          />
        </>
      )}
    </PageShell>
  );
}

// ─── Shell de page (layout commun) ───────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 py-8">
        <div className="container max-w-5xl mx-auto px-4">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

// ─── Carte d'erreur réutilisable ─────────────────────────────────

function ErrorCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-md w-full mx-auto text-center space-y-8 py-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex justify-center">
        <div className="p-6 rounded-full bg-muted/50 ring-1 ring-border shadow-sm">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
        </div>
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-lg text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
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
  );
}
