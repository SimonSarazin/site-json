import { toast } from "sonner";

type TranslateFunction = (key: string, defaultValue?: string, params?: Record<string, string>) => string;

/**
 * Formate un message d'erreur à partir d'une erreur inconnue
 */
export function formatMutationError(error: unknown, t: TranslateFunction): string {
  if (error instanceof Error) {
    return error.message;
  }
  return t("toast.error.generic");
}

/**
 * Affiche un toast d'erreur formaté
 */
export function showErrorToast(
  error: unknown,
  errorKey: string,
  t: TranslateFunction,
  params?: Record<string, string>
): void {
  const errorMessage = formatMutationError(error, t);
  toast.error(t(errorKey, undefined, params), {
    description: errorMessage,
  });
}

/**
 * Affiche un toast de succès
 */
export function showSuccessToast(
  successKey: string,
  t: TranslateFunction,
  params?: Record<string, string>
): void {
  toast.success(t(successKey, undefined, params));
}
