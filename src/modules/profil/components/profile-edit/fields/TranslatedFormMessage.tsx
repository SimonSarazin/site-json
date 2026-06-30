/**
 * Wrapper de COMPAT (domaine profil) autour du `FormMessage` générique de formEngine : injecte la
 * traduction du namespace "modules/profil" (où vivent les clés `validation.*`). Utilisé par les widgets
 * DOMAINE restant en profil (IconFormField, FormFieldTags, EditLocationTab/EventDates/Social/Schedule).
 * Les widgets GÉNÉRIQUES (déplacés dans formEngine) utilisent `FormMessage` directement avec `translate={p.t}`.
 */
import { type ComponentProps } from "react";
import { useT } from "@/hooks/useT";
import { FormMessage } from "@/modules/formEngine";

export function TranslatedFormMessage(props: ComponentProps<"p">) {
  const t = useT("modules/profil");
  return <FormMessage errorTranslate={t} {...props} />;
}
