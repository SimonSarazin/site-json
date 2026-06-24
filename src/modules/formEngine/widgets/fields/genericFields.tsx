import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectObject } from "@/components/ui/select-objet";
import { DatePickerInput } from "@/components/form/DatePickerInput";
import { FormMessage } from "../../components/FormMessage";

/**
 * Champs de formulaire GÉNÉRIQUES (formEngine, LEAF). Label déjà résolu passé en prop → i18n-agnostiques :
 * l'appelant fait `t(...)`. Le message d'erreur est rendu par `FormMessage` avec la fonction `errorTranslate`
 * injectée (le registre passe `p.t`). Aucun import de profil/SDK. cf. doc/moteur-formulaire-generique.md.
 */

interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  /** Label déjà traduit. */
  label: string;
  required?: boolean;
  disabled?: boolean;
  /** Traduit les clés d'erreur `validation.*` (injecté par le registre = `p.t`). */
  errorTranslate?: (key: string) => string;
}

export function FormFieldText<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  type = "text",
  placeholder,
  hint,
  errorTranslate,
}: BaseFieldProps<T> & { type?: string; placeholder?: string; hint?: string }) {
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
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage errorTranslate={errorTranslate} />
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
  errorTranslate,
}: BaseFieldProps<T> & { placeholder?: string }) {
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
          <FormMessage errorTranslate={errorTranslate} />
        </FormItem>
      )}
    />
  );
}

/** Case à cocher unique (booléen) — label cliquable à droite. */
export function FormFieldCheckbox<T extends FieldValues>({
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
        <FormItem className="flex flex-row items-start gap-3 space-y-0">
          <FormControl>
            <Checkbox checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
          {label && <FormLabel className="font-normal leading-none">{label}</FormLabel>}
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

/** Option de select/checkbox : soit une string (value=label), soit un couple {value,label} DISTINCTS. */
export type SelectOptionInput = string | { value: string; label: string };
const normOpt = (o: SelectOptionInput): { value: string; label: string } =>
  typeof o === "string" ? { value: o, label: o } : o;

export function FormFieldSelectObject<T extends FieldValues>({
  control,
  name,
  label,
  required,
  options,
  placeholder,
  placeholderSearch,
  multiple = false,
  errorTranslate,
}: BaseFieldProps<T> & {
  options: readonly SelectOptionInput[];
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
          {label && (
            <FormLabel>
              {label}
              {required && " *"}
            </FormLabel>
          )}
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
              options={options.map((opt) => { const o = normOpt(opt); return { id: o.value, label: o.label, value: o.value }; })}
              placeholder={placeholder}
              placeholderSearch={placeholderSearch}
            />
          </FormControl>
          <FormMessage errorTranslate={errorTranslate} />
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
  placeholder,
  hint,
  startYear,
  endYear,
  errorTranslate,
}: BaseFieldProps<T> & { placeholder?: string; hint?: string; startYear?: number; endYear?: number }) {
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
          <FormControl>
            <DatePickerInput
              value={typeof field.value === "string" ? field.value : ""}
              onChange={field.onChange}
              disabled={disabled}
              placeholder={placeholder}
              startYear={startYear}
              endYear={endYear}
            />
          </FormControl>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage errorTranslate={errorTranslate} />
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
  variant = "plain",
  errorTranslate,
}: BaseFieldProps<T> & {
  options: readonly SelectOptionInput[];
  /** `card` : chaque option = label bordé, cliquable pleine ligne (parité formulaires legacy). */
  variant?: "plain" | "card";
}) {
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
                {options.map((opt) => {
                  const { value, label: optLabel } = normOpt(opt);
                  const checkboxId = `${name}-${value}`;
                  const toggle = () =>
                    field.onChange(
                      selected.includes(value)
                        ? selected.filter((item) => item !== value)
                        : [...selected, value]
                    );
                  if (variant === "card") {
                    return (
                      <label key={value} htmlFor={checkboxId}
                        className="flex items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted cursor-pointer">
                        <Checkbox id={checkboxId} checked={selected.includes(value)} onCheckedChange={toggle} />
                        {optLabel}
                      </label>
                    );
                  }
                  return (
                    <div key={value} className="flex items-center gap-2 text-sm">
                      <Checkbox id={checkboxId} checked={selected.includes(value)} onCheckedChange={toggle} />
                      <label htmlFor={checkboxId}>{optLabel}</label>
                    </div>
                  );
                })}
              </div>
            </FormControl>
            <FormMessage errorTranslate={errorTranslate} />
          </FormItem>
        );
      }}
    />
  );
}
