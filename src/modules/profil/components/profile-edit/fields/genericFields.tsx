import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectObject } from "@/components/ui/select-objet";
import { DatePickerInput } from "@/components/form/DatePickerInput";
import { TranslatedFormMessage } from "./TranslatedFormMessage";

/**
 * Champs de formulaire génériques (label déjà résolu passé en prop → réutilisables
 * et i18n-agnostiques : l'appelant fait `t(...)`). Factorisent les patterns
 * répétés des gros formulaires (input texte, switch, select, groupe de cases).
 */

interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  /** Label déjà traduit. */
  label: string;
  required?: boolean;
  disabled?: boolean;
}

export function FormFieldText<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  type = "text",
  placeholder,
}: BaseFieldProps<T> & { type?: string; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && " *"}
          </FormLabel>
          <FormControl>
            <Input
              type={type}
              value={typeof field.value === "string" ? field.value : ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
              placeholder={placeholder}
              disabled={disabled}
            />
          </FormControl>
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Champ numérique : convertit à la saisie (`"" → undefined`, sinon `Number`) et
 * stocke un vrai `number` dans le form (schéma `z.number()`). Évite la coercion
 * string→number en aval (un `<input type="number">` renvoie sinon une string).
 */
export function FormFieldNumber<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  placeholder,
}: BaseFieldProps<T> & { placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && " *"}
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              value={field.value === undefined || field.value === null ? "" : String(field.value)}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === "") {
                  field.onChange(undefined);
                  return;
                }
                const parsed = Number(raw);
                field.onChange(Number.isNaN(parsed) ? undefined : parsed);
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
              placeholder={placeholder}
              disabled={disabled}
            />
          </FormControl>
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}

export function FormFieldSwitch<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
}: BaseFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <FormLabel className="m-0">{label}</FormLabel>
          <FormControl>
            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function FormFieldSelectObject<T extends FieldValues>({
  control,
  name,
  label,
  required,
  options,
  placeholder,
  placeholderSearch,
  multiple = false,
}: BaseFieldProps<T> & {
  options: readonly string[];
  placeholder?: string;
  placeholderSearch?: string;
  /** Multi-sélection : la valeur du champ est un `string[]` (sinon une `string`). */
  multiple?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && " *"}
          </FormLabel>
          <FormControl>
            <SelectObject
              multiple={multiple}
              value={
                multiple
                  ? (Array.isArray(field.value) ? field.value : [])
                  : (typeof field.value === "string" ? field.value : "")
              }
              onChange={(value) =>
                multiple
                  ? field.onChange(Array.isArray(value) ? value : [])
                  : field.onChange(typeof value === "string" ? value : "")
              }
              options={options.map((option) => ({ id: option, label: option, value: option }))}
              placeholder={placeholder}
              placeholderSearch={placeholderSearch}
            />
          </FormControl>
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}

export function FormFieldDate<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
}: BaseFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && " *"}
          </FormLabel>
          <FormControl>
            <DatePickerInput
              value={typeof field.value === "string" ? field.value : ""}
              onChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}

export function FormFieldCheckboxGroup<T extends FieldValues>({
  control,
  name,
  label,
  options,
}: BaseFieldProps<T> & { options: readonly string[] }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected = Array.isArray(field.value) ? (field.value as string[]) : [];
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div role="group" className="grid gap-2 sm:grid-cols-2">
                {options.map((option) => {
                  const checkboxId = `${name}-${option}`;
                  const toggle = () =>
                    field.onChange(
                      selected.includes(option)
                        ? selected.filter((item) => item !== option)
                        : [...selected, option]
                    );
                  return (
                    <div key={option} className="flex items-center gap-2 text-sm">
                      <Checkbox id={checkboxId} checked={selected.includes(option)} onCheckedChange={toggle} />
                      <label htmlFor={checkboxId}>{option}</label>
                    </div>
                  );
                })}
              </div>
            </FormControl>
            <TranslatedFormMessage />
          </FormItem>
        );
      }}
    />
  );
}
