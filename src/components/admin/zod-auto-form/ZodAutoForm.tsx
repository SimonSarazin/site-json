import { useState } from "react";
import type { z } from "zod";
import { classifyField, createDefaultValue, humanizeKey, resolveType } from "./schema-utils";
import { StringField } from "./fields/StringField";
import { NumberField } from "./fields/NumberField";
import { BooleanField } from "./fields/BooleanField";
import { EnumField } from "./fields/EnumField";
import { LocalizedStringField } from "./fields/LocalizedStringField";
import { ArrayField } from "./fields/ArrayField";
import { JsonFallbackField } from "./fields/JsonFallbackField";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";


export function ObjectFields({
  schema,
  value,
  onChange,
  compact = false,
}: {
  schema: z.ZodTypeAny;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  compact?: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape = (schema._def as Record<string, any>).shape as Record<string, z.ZodTypeAny>;
  const entries = Object.entries(shape);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Aucune propriété configurable.
      </p>
    );
  }

  function updateField(key: string, fieldValue: unknown) {
    const next = { ...value, [key]: fieldValue };
    if (fieldValue === undefined) {
      delete next[key];
    }
    onChange(next);
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {entries.map(([key, fieldSchema]) => {
        const info = classifyField(fieldSchema);
        const label = humanizeKey(key);
        const fieldValue = value?.[key];

        switch (info.kind) {
          case "localizedString":
            return (
              <LocalizedStringField
                key={key}
                label={label}
                value={fieldValue}
                onChange={(v) => updateField(key, v)}
                isOptional={info.isOptional}
                compact={compact}
              />
            );
          case "string":
            return (
              <StringField
                key={key}
                label={label}
                fieldKey={key}
                value={fieldValue}
                onChange={(v) => updateField(key, v)}
                isOptional={info.isOptional}
                compact={compact}
              />
            );
          case "number":
            return (
              <NumberField
                key={key}
                label={label}
                value={fieldValue}
                onChange={(v) => updateField(key, v)}
                isOptional={info.isOptional}
                compact={compact}
              />
            );
          case "boolean":
            return (
              <BooleanField
                key={key}
                label={label}
                value={fieldValue}
                onChange={(v) => updateField(key, v)}
                isOptional={info.isOptional}
              />
            );
          case "enum":
            return (
              <EnumField
                key={key}
                label={label}
                value={fieldValue}
                onChange={(v) => updateField(key, v)}
                isOptional={info.isOptional}
                options={info.enumOptions!}
                compact={compact}
              />
            );
          case "unionLiterals":
            return (
              <EnumField
                key={key}
                label={label}
                value={fieldValue}
                onChange={(v) => updateField(key, v)}
                isOptional={info.isOptional}
                options={info.literalValues! as (string | number)[]}
                compact={compact}
              />
            );
          case "array":
            return (
              <ArrayField
                key={key}
                label={label}
                value={fieldValue}
                onChange={(v) => updateField(key, v)}
                isOptional={info.isOptional}
                elementSchema={info.elementSchema!}
              />
            );
          case "object":
            return info.isOptional ? (
              <OptionalObjectField
                key={key}
                label={label}
                schema={info.schema}
                value={fieldValue as Record<string, unknown> | undefined}
                onChange={(v) => updateField(key, v)}
                compact={compact}
              />
            ) : (
              <div key={key} className="space-y-2 pl-3 border-l-2 border-muted">
                <Label className="text-xs font-medium">{label}</Label>
                <ObjectFields
                  schema={info.schema}
                  value={(fieldValue as Record<string, unknown>) ?? {}}
                  onChange={(v) => updateField(key, v)}
                  compact={compact}
                />
              </div>
            );
          case "unsupported":
            return (
              <JsonFallbackField
                key={key}
                label={label}
                value={fieldValue}
                onChange={(v) => updateField(key, v)}
                isOptional={info.isOptional}
              />
            );
        }
      })}
    </div>
  );
}


function OptionalObjectField({
  label,
  schema,
  value,
  onChange,
  compact,
}: {
  label: string;
  schema: z.ZodTypeAny;
  value: Record<string, unknown> | undefined;
  onChange: (v: Record<string, unknown> | undefined) => void;
  compact: boolean;
}) {
  const isActive = value !== undefined && value !== null;
  const [collapsed, setCollapsed] = useState(false);

  function handleActivate() {
    onChange(createDefaultValue(schema) as Record<string, unknown>);
  }

  function handleRemove() {
    onChange(undefined);
  }

  if (!isActive) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={handleActivate}
        >
          <Plus className="h-3 w-3" />
          {label}
        </Button>
        <span className="text-[10px] text-muted-foreground">(optionnel)</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 pl-3 border-l-2 border-primary/30 rounded-sm">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium hover:text-primary transition-colors"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {label}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={handleRemove}
          title={`Supprimer ${label}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {!collapsed && (
        <ObjectFields
          schema={schema}
          value={value}
          onChange={onChange}
          compact={compact}
        />
      )}
    </div>
  );
}


interface ZodAutoFormProps {
  schema: z.ZodTypeAny;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}

export default function ZodAutoForm({
  schema,
  value,
  onChange,
}: ZodAutoFormProps) {
  const { innerSchema } = resolveType(schema);

  if (innerSchema._def.type !== "object") {
    return (
      <JsonFallbackField
        label="Props"
        value={value}
        onChange={(v) => onChange(v as Record<string, unknown>)}
        isOptional={false}
      />
    );
  }

  return <ObjectFields schema={innerSchema} value={value} onChange={onChange} />;
}
