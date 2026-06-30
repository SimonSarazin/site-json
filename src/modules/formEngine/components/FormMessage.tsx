/**
 * `FormMessage` — message d'erreur de champ GÉNÉRIQUE (formEngine, LEAF). Lit l'erreur RHF via
 * `useFormField()` ; si le message est une CLÉ i18n (`validation.*`), la traduit via la fonction
 * `translate` INJECTÉE (par défaut : message brut). Aucun namespace hardcodé → aucun import de profil/SDK.
 *
 * Les widgets sous `GenericForm` reçoivent déjà `t` (WidgetProps.t) ; le registre passe `translate={p.t}`.
 * Remplace l'ancien `profil/.../TranslatedFormMessage` (qui hardcodait `useT("modules/profil")`).
 */
import { type ComponentProps } from "react";
import { useFormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export interface FormMessageProps extends ComponentProps<"p"> {
  /** Traduit une clé i18n d'erreur (`validation.*`). Absent → message affiché brut.
   *  (Nommé `errorTranslate` et non `translate` : ce dernier est un attribut HTML réservé sur `<p>`.) */
  errorTranslate?: (key: string) => string;
}

export function FormMessage({ errorTranslate, className, ...props }: FormMessageProps) {
  const { error, formMessageId } = useFormField();
  if (!error?.message) return null;
  const msg = String(error.message);
  const body = msg.startsWith("validation.") && errorTranslate ? errorTranslate(msg) : msg;
  return (
    <p data-slot="form-message" id={formMessageId} className={cn("text-destructive text-sm", className)} {...props}>
      {body}
    </p>
  );
}
