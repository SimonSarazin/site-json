import { CheckCircle2, Home, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n";
import type { CoFormThankYouConfig } from "../types";

interface CoFormThankYouProps {
  config?: CoFormThankYouConfig | null;
  formName?: string;
  isUpdate?: boolean;
  onSubmitAnother?: (() => void) | null;
  onEditAnswer?: (() => void) | null;
  onGoHome?: () => void;
  className?: string;
}

/**
 * Page de remerciement après soumission d'un formulaire CoForm.
 * Supporte un mode générique et un mode personnalisé par l'admin.
 */
export function CoFormThankYou({
  config,
  formName,
  isUpdate = false,
  onSubmitAnother,
  onEditAnswer,
  onGoHome,
  className,
}: CoFormThankYouProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const title =
    config?.title ||
    (isUpdate
      ? t("coform.thankYou.updateTitle")
      : t("coform.thankYou.title"));

  const message =
    config?.message ||
    (isUpdate
      ? t("coform.thankYou.updateMessage")
      : t("coform.thankYou.message"));

  const showAnotherResponse =
    config?.showSubmitAnother ?? (!isUpdate && !!onSubmitAnother);

  return (
    <div
      className={cn(
        "flex items-center justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-700",
        className
      )}
    >
      <Card className="max-w-lg w-full shadow-lg border-0 overflow-hidden">
        {/* Bande de couleur en haut */}
        <div
          className={cn(
            "h-2",
            config?.accentColor
              ? undefined
              : isUpdate
                ? "bg-warning"
                : "bg-primary"
          )}
          style={config?.accentColor ? { backgroundColor: config.accentColor } : undefined}
        />

        <CardContent className="pt-10 pb-8 px-8 text-center space-y-6">
          {/* Icône de succès animée */}
          <div className="flex justify-center">
            <div
              className={cn(
                "rounded-full p-4 animate-in zoom-in duration-500",
                isUpdate
                  ? "bg-warning/15"
                  : "bg-primary/10"
              )}
            >
              <CheckCircle2
                className={cn(
                  "w-12 h-12",
                  isUpdate
                    ? "text-warning"
                    : "text-primary"
                )}
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* Titre */}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>

          {/* Message principal */}
          <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
            {message}
          </p>

          {/* Nom du formulaire (subtil) */}
          {formName && (
            <p className="text-xs text-muted-foreground/70 italic">
              {formName}
            </p>
          )}

          {/* Message supplémentaire personnalisé */}
          {config?.additionalInfo && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground leading-relaxed">
              {config.additionalInfo}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            {/* Modifier ma réponse */}
            {onEditAnswer && (
              <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={onEditAnswer}>
                <Pencil className="w-4 h-4" />
                {t("coform.thankYou.editAnswer")}
              </Button>
            )}

            {/* Soumettre une autre réponse */}
            {showAnotherResponse && onSubmitAnother && (
              <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={onSubmitAnother}>
                <RotateCcw className="w-4 h-4" />
                {t("coform.thankYou.submitAnother")}
              </Button>
            )}

            {/* Retour accueil */}
            {onGoHome && (
              <Button variant="ghost" className="gap-2 w-full sm:w-auto" onClick={onGoHome}>
                <Home className="w-4 h-4" />
                {t("coform.thankYou.goHome")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CoFormThankYou;
