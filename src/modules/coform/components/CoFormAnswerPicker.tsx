import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import { FilePlus, Pencil, Calendar, Clock } from "lucide-react";
import { SmartCoForm } from "./SmartCoForm";
import type { CoFormAnswerSummary, CoFormData } from "../types";
import "../i18n/i18n";

interface CoFormAnswerPickerProps {
  formName?: string;
  formData?: CoFormData;
  answers: CoFormAnswerSummary[];
  onSelectAnswer: (answerId: string) => void;
  onNewAnswer: () => void;
}

/**
 * Interface de sélection de réponse. Affiché en mode réponse multiple
 * quand l'utilisateur a déjà des réponses existantes.
 * Permet de choisir une réponse à modifier ou d'en créer une nouvelle.
 */
export function CoFormAnswerPicker({
  formName,
  formData,
  answers,
  onSelectAnswer,
  onNewAnswer,
}: CoFormAnswerPickerProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-2xl w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
        {/* En-tête */}
        <div className="px-6 py-6 bg-primary/5 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">
            {t("coform.answerPicker.title")}
          </h2>
          {formName && (
            <p className="text-sm text-muted-foreground mt-1">{formName}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            {t("coform.answerPicker.description", undefined, {
              count: String(answers.length),
            })}
          </p>
        </div>

        {/* Liste des réponses existantes */}
        <div className="divide-y divide-border">
          {answers.map((answer, index) => (
            <button
              key={answer.id}
              type="button"
              onClick={() => onSelectAnswer(answer.id)}
              className="w-full px-6 py-4 text-left hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {t("coform.answerPicker.answerLabel", undefined, {
                        number: String(index + 1),
                      })}
                    </span>
                  </div>
                  {/* Date de création */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(answer.createdAt)}</span>
                    {answer.updatedAt && answer.updatedAt !== answer.createdAt && (
                      <>
                        <span className="mx-1">·</span>
                        <Clock className="w-3 h-3" />
                        <span>{t("coform.answerPicker.updated")} {formatDate(answer.updatedAt)}</span>
                      </>
                    )}
                  </div>
                  {/* Aperçu readonly des réponses */}
                  {formData && answer.answers && (
                    <div className="mt-2 relative">
                      <div className="max-h-48 overflow-y-auto">
                        <div className="pointer-events-none">
                          <SmartCoForm
                            formData={formData}
                            defaultValues={answer.answers}
                            readOnly
                            stepKey={Object.keys(formData.inputs || {})[0]}
                          />
                        </div>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                    </div>
                  )}
                </div>
                <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>

        {/* Bouton nouvelle réponse */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <Button onClick={onNewAnswer} variant="outline" className="w-full gap-2">
            <FilePlus className="w-4 h-4" />
            {t("coform.answerPicker.newAnswer")}
          </Button>
        </div>
      </div>
    </div>
  );
}
