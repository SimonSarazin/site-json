import { useFormField } from "@/components/ui/form";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

/**
 * FormMessage avec traduction automatique des clés i18n
 *
 * Si le message d'erreur commence par "validation.", il est traduit
 * via le namespace "modules/profil". Sinon, il est affiché tel quel.
 */
export function TranslatedFormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const t = useT("modules/profil");

  if (!error?.message) {
    return null;
  }

  // Traduit si c'est une clé (commence par "validation.")
  const body = error.message.startsWith("validation.")
    ? t(error.message)
    : error.message;

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      {body}
    </p>
  );
}
