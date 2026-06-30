/**
 * Widget `fieldArray` du moteur générique : liste répétable d'OBJETS (ex. réseaux sociaux
 * `[{platform, url}]`). Chaque ligne rend les sous-champs déclarés dans `widgetProps.itemFields`
 * (kind `text` | `select`), bornés à `${name}.${index}.${sous-champ}`. + boutons add/remove.
 * S'appuie sur `useFieldArray` (RHF).
 */
import { useFieldArray, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FieldArrayItem {
  name: string;
  kind: "text" | "select";
  label?: string;          // déjà traduit
  placeholder?: string;    // déjà traduit
  options?: Array<{ value: string; label: string }>; // pour kind="select"
}

export interface FieldArrayFieldProps {
  form: UseFormReturn<FieldValues>;
  name: string;
  label?: string;
  addLabel: string;
  itemFields: FieldArrayItem[];
}

export function FieldArrayField({ form, name, label, addLabel, itemFields }: FieldArrayFieldProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: name as never });
  const emptyItem = Object.fromEntries(itemFields.map((f) => [f.name, ""]));
  const path = (i: number, sub: string) => `${name}.${i}.${sub}` as FieldPath<FieldValues>;

  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-semibold">{label}</div>}
      {fields.map((row, i) => (
        <div key={row.id} className="flex items-center gap-2">
          {itemFields.map((sub) => {
            const value = (form.watch(path(i, sub.name)) as string) ?? "";
            if (sub.kind === "select") {
              return (
                <Select key={sub.name} value={value} onValueChange={(v) => form.setValue(path(i, sub.name), v)}>
                  <SelectTrigger className="w-40"><SelectValue placeholder={sub.placeholder ?? sub.label} /></SelectTrigger>
                  <SelectContent>
                    {(sub.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              );
            }
            return (
              <Input key={sub.name} className="flex-1" placeholder={sub.placeholder ?? sub.label}
                value={value} onChange={(e) => form.setValue(path(i, sub.name), e.target.value)} />
            );
          })}
          <Button type="button" variant="destructive" size="icon" onClick={() => remove(i)} aria-label="remove">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => append(emptyItem as never)}>
        <Plus className="mr-1 h-4 w-4" /> {addLabel}
      </Button>
    </div>
  );
}

export default FieldArrayField;
