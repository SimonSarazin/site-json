import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fieldErrorId, fieldHintId } from "./fieldIds";

export interface FieldProps {
  /** Libellé visible, relié au contrôle par `htmlFor`. */
  label: string;
  /** Identifiant du contrôle enveloppé — le même que son `id`. */
  htmlFor: string;
  /** Aide permanente, affichée tant qu'il n'y a pas d'erreur. */
  hint?: string;
  /** Message d'erreur ; remplace l'aide et annonce le problème. */
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Champ de formulaire : libellé, contrôle, puis aide OU erreur, reliées au contrôle par
 * `fieldDescribedBy`. Repris de co-kanban (`components/ui/Field.tsx`) sur le `Label` du site,
 * qui n'a pas d'équivalent pour l'aide et l'erreur.
 */
export function Field({ label, htmlFor, hint, error, required = false, className, children }: FieldProps) {
  const { t } = useTranslation("modules/kanban");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <>
            {/* L'astérisque est DÉCORATIF : certains lecteurs l'annoncent « étoile ». Le mot,
                lui, est toujours juste. */}
            <span aria-hidden className="text-destructive">
              *
            </span>
            <span className="sr-only">{t("common.required")}</span>
          </>
        ) : null}
      </Label>

      {children}

      {error ? (
        // `role="alert"` : l'erreur apparaît APRÈS coup (à la validation), elle doit être annoncée
        // sans attendre que le focus l'atteigne.
        <p id={fieldErrorId(htmlFor)} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={fieldHintId(htmlFor)} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
