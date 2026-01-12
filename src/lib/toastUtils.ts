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
 * @param error - L'erreur à afficher
 * @param errorKey - Clé i18n pour le titre du toast
 * @param t - Fonction de traduction
 * @param params - Paramètres de traduction optionnels
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
 * @param successKey - Clé i18n pour le message
 * @param t - Fonction de traduction
 * @param params - Paramètres de traduction optionnels
 */
export function showSuccessToast(
  successKey: string,
  t: TranslateFunction,
  params?: Record<string, string>
): void {
  toast.success(t(successKey, undefined, params));
}
