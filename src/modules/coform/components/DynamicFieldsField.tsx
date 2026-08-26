import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import type { FieldErrors } from "react-hook-form";
import type { DynamicFieldsRow, DynamicFieldsSubField, FormFieldMapping } from "../types";
import { HintText, FieldError } from "./FormFields";

interface DynamicFieldsFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: unknown;
  onChange?: (value: DynamicFieldsRow[]) => void;
}

/**
 * Grille responsive des sous-champs d'une ligne. Tailwind exige des classes
 * STATIQUES (pas d'interpolation) → table de correspondance fieldsPerRow 1..6.
 * Mobile toujours 1 colonne, palier intermédiaire à 2 (lisibilité tactile).
 */
const GRID_BY_FIELDS_PER_ROW: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-6",
};

/** Types HTML natifs acceptés par le legacy pour un sous-champ `<input>`. */
const NATIVE_INPUT_TYPES = new Set(["text", "email", "tel", "number", "url", "password", "date", "time", "datetime-local"]);

/**
 * Champ « lignes dynamiques » (`tpls.forms.cplx.dynamicFields`) : répéteur de
 * lignes dont les sous-champs (type, label, options…) viennent de la config
 * admin du formulaire. Format sauvé = legacy : `[{ cléSousChamp: valeur }]`.
 */
export function DynamicFieldsField({ field, errors, value, onChange }: DynamicFieldsFieldProps) {
  const t = useT("modules/coform");
  const config = field.dynamicFieldsConfig;
  const rows: DynamicFieldsRow[] = Array.isArray(value) ? (value as DynamicFieldsRow[]) : [];
  const hasError = !!errors[field.name];

  const subFields = config?.fieldsConfig ?? [];
  const minRows = Math.max(field.isRequired ? 1 : 0, config?.minRows ?? 0);

  // Parité legacy : les `minRows` lignes existent d'emblée, sans clic sur
  // « Ajouter ». Stable : on ne peut pas descendre sous minRows (canRemove),
  // donc l'effet ne se re-déclenche pas en boucle.
  useEffect(() => {
    if (subFields.length === 0 || rows.length >= minRows) return;
    const seed = Array.from({ length: minRows - rows.length }, () =>
      Object.fromEntries(subFields.map((sub) => [sub.key, ""])),
    );
    onChange?.([...rows, ...seed]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- déclenché par le manque de lignes uniquement (rows/onChange changent à chaque render contrôlé)
  }, [rows.length, minRows, subFields.length]);

  // Sans fieldsConfig, le champ est inconfiguré côté admin : rien à saisir.
  if (!config || config.fieldsConfig.length === 0) return null;

  const maxRows = config.maxRows ?? 10;
  const multiple = config.enableMultipleRows === true;
  const showLabels = config.layout?.showLabels !== false;
  const showPlaceholders = config.layout?.showPlaceholders !== false;
  const gridClass = GRID_BY_FIELDS_PER_ROW[config.layout?.fieldsPerRow ?? 3] ?? GRID_BY_FIELDS_PER_ROW[3];
  const canAdd = multiple && rows.length < maxRows;
  const canRemove = multiple && rows.length > minRows;

  const createRow = (): DynamicFieldsRow =>
    Object.fromEntries(config.fieldsConfig.map((sub) => [sub.key, ""]));

  const updateCell = (rowIndex: number, key: string, cellValue: string) => {
    onChange?.(rows.map((row, i) => (i === rowIndex ? { ...row, [key]: cellValue } : row)));
  };

  const addRow = () => {
    onChange?.([...rows, createRow()]);
  };

  const removeRow = (index: number) => {
    onChange?.(rows.filter((_, i) => i !== index));
  };

  const renderSubField = (sub: DynamicFieldsSubField, rowIndex: number, row: DynamicFieldsRow) => {
    const id = `${field.name}-${rowIndex}-${sub.key}`;
    const cellValue = row[sub.key] ?? "";
    const placeholder = showPlaceholders ? sub.placeholder : undefined;
    const control =
      sub.type === "select" ? (
        <Select value={cellValue || undefined} onValueChange={(v) => updateCell(rowIndex, sub.key, v)}>
          <SelectTrigger id={id} className="w-full border border-input">
            <SelectValue placeholder={placeholder ?? String(t("coform.fields.selectPlaceholder"))} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(sub.options ?? {}).map(([optValue, optLabel]) => (
              <SelectItem key={optValue} value={optValue}>
                {optLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : sub.type === "textarea" ? (
        <Textarea
          id={id}
          value={cellValue}
          placeholder={placeholder}
          rows={3}
          maxLength={sub.validation?.maxLength}
          aria-required={sub.required || undefined}
          onChange={(e) => updateCell(rowIndex, sub.key, e.target.value)}
          className="border border-input"
        />
      ) : (
        <Input
          id={id}
          // Type inconnu de la config admin → repli "text" (jamais d'input cassé).
          type={NATIVE_INPUT_TYPES.has(sub.type) ? sub.type : "text"}
          value={cellValue}
          placeholder={placeholder}
          maxLength={sub.validation?.maxLength}
          aria-required={sub.required || undefined}
          onChange={(e) => updateCell(rowIndex, sub.key, e.target.value)}
          className="border border-input"
        />
      );

    return (
      <div key={sub.key} className="space-y-1.5">
        {showLabels && sub.label && (
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {sub.label}
            {sub.required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        {control}
      </div>
    );
  };

  return (
    <div className={cn("space-y-2", field.width)}>
      {field.label && (
        <Label className="text-sm font-medium text-foreground">
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {field.info && <HintText text={field.info} />}

      <div className="space-y-3">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="rounded-md border border-border/60 bg-muted/30 p-3">
            <div className={cn("grid gap-3", gridClass)}>
              {config.fieldsConfig.map((sub) => renderSubField(sub, rowIndex, row))}
            </div>
            {canRemove && (
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(rowIndex)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {config.ui?.removeButtonText ?? t("coform.dynamicFields.removeRow")}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(canAdd || rows.length === 0) && (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          {config.ui?.addButtonText ?? t("coform.dynamicFields.addRow")}
        </Button>
      )}

      <FieldError name={field.name} message={hasError ? (errors[field.name]?.message as string | undefined) : undefined} />
    </div>
  );
}
