import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormLabel } from "@/components/ui/form";
import { MarkdownEditor } from "@/modules/coform/components/MarkdownEditor";
import { TranslatedFormMessage } from "./TranslatedFormMessage";

/**
 * Champ d'édition markdown : enveloppe `MarkdownEditor` (coform, client-only/SSR-safe via useClientModule)
 * dans le pattern react-hook-form. Value = STRING markdown brut (aligné avec `renderMarkdown` du reader).
 * Pas de `FormControl` (Slot exige un ref forwardé — MarkdownEditor est un composite non-ref), comme les
 * widgets `location`/`finder`.
 */
export function FormFieldMarkdown<T extends FieldValues>({
  control,
  name,
  label,
  required,
  height = 300,
  preview = "edit",
}: {
  control: Control<T>;
  name: FieldPath<T>;
  /** Label déjà traduit. */
  label: string;
  required?: boolean;
  height?: number;
  preview?: "edit" | "live" | "preview";
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && (
            <FormLabel>
              {label}
              {required && " *"}
            </FormLabel>
          )}
          <MarkdownEditor
            value={typeof field.value === "string" ? field.value : ""}
            onChange={field.onChange}
            height={height}
            preview={preview}
          />
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
