import type { FieldErrors } from "react-hook-form";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { FormFieldMapping } from "../types";

interface ErrorSummaryProps {
  errors: FieldErrors;
  fields: FormFieldMapping[];
  serverError?: Error | null;
  onFieldClick?: (fieldName: string) => void;
  className?: string;
}

/**
 * Pas de `memo`, pas de `useMemo` sur `entries` : RHF peut **muter**
 * `_formState.errors` en place (path `p()/z()` pour la revalidation d'un
 * champ unique en mode `onChange`), gardant la même référence. Toute
 * memoization basée sur cette référence — `memo()` ou `useMemo([errors])` —
 * masque les changements de contenu et fige le récap. Comme le composant
 * rend au plus quelques entrées, on recalcule à chaque render du parent
 * (déclenché par la subscription `useFormState` côté MultiStepCoForm).
 */
export function ErrorSummary({ errors, fields, serverError, onFieldClick, className }: ErrorSummaryProps) {
  const t = useT("modules/coform");

  const names = Object.keys(errors);
  const byName = new Map<string, FormFieldMapping>();
  for (const f of fields) byName.set(f.name, f);
  const entries = names.map((name) => ({
    name,
    label: byName.get(name)?.label ?? name,
    message: (errors[name]?.message as string | undefined) ?? "",
  }));

  if (entries.length === 0 && !serverError) return null;

  return (
    <Alert
      aria-live="polite"
      className={cn(
        "mb-4 border-destructive/40 bg-destructive/5",
        className
      )}
    >
      <AlertCircle className="h-4 w-4 text-destructive" />
      <AlertTitle className="text-destructive">
        {serverError
          ? t("coform.errors.summary.serverError")
          : t("coform.errors.summary.title", undefined, { count: entries.length })}
      </AlertTitle>
      <AlertDescription>
        {serverError && <p className="text-foreground">{serverError.message}</p>}
        {entries.length > 0 && (
          <ul className="list-disc pl-5 space-y-0.5 mt-1">
            {entries.map((e) => (
              <li key={e.name} className="text-foreground marker:text-destructive/60">
                <button
                  type="button"
                  onClick={() => onFieldClick?.(e.name)}
                  className={cn(
                    "group inline-flex items-center gap-1 text-left rounded px-1.5 py-0.5 -ml-1.5 cursor-pointer",
                    "transition-all duration-200 ease-out",
                    "hover:bg-destructive/10 hover:translate-x-1",
                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-destructive/60"
                  )}
                  aria-label={`${t("coform.errors.summary.jumpTo")} : ${e.label}`}
                >
                  <span className="font-medium">{e.label}</span>
                  {e.message ? <span className="text-muted-foreground"> — {e.message}</span> : null}
                  <span
                    aria-hidden="true"
                    className="text-destructive/60 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
