import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "../../components/FormMessage";

interface FormFieldUrlListProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Texte du bouton d'ajout. */
  addLabel: string;
  /** aria-label du bouton de suppression. */
  removeLabel: string;
  placeholder?: string;
  /** Traduit les clés d'erreur `validation.*` (injecté par le registre = `p.t`). */
  errorTranslate?: (key: string) => string;
}

/**
 * Liste d'URLs répétable pour un champ `string[]` GÉNÉRIQUE (formEngine, LEAF) : un `<input type="url">`
 * par entrée + ajout/suppression. Message d'erreur via FormMessage injecté.
 */
export function FormFieldUrlList<T extends FieldValues>({
  control,
  name,
  label,
  addLabel,
  removeLabel,
  placeholder,
  errorTranslate,
}: FormFieldUrlListProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const urls: string[] = Array.isArray(field.value) ? field.value : [];
        const update = (next: string[]) => field.onChange(next);
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="space-y-2">
              {urls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="url"
                    inputMode="url"
                    value={url}
                    placeholder={placeholder}
                    onChange={(event) =>
                      update(urls.map((value, i) => (i === index ? event.target.value : value)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => update(urls.filter((_, i) => i !== index))}
                    aria-label={removeLabel}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => update([...urls, ""])}>
                <Plus className="mr-1 h-4 w-4" />
                {addLabel}
              </Button>
            </div>
            <FormMessage errorTranslate={errorTranslate} />
          </FormItem>
        );
      }}
    />
  );
}
