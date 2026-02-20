import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import {
  classifyField,
  createDefaultValue,
  resolveType,
  isLocalizedString,
} from "../schema-utils";
import { ObjectFields } from "../ZodAutoForm";
import { LocalizedStringField } from "./LocalizedStringField";
import { StringField } from "./StringField";
import { NumberField } from "./NumberField";

interface ArrayFieldProps {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
  elementSchema: z.ZodTypeAny;
}

export function ArrayField({
  label,
  value,
  onChange,
  isOptional,
  elementSchema,
}: ArrayFieldProps) {
  const items = (value as unknown[]) ?? [];
  const { innerSchema: elInner } = resolveType(elementSchema);
  const isElObject =
    elInner._def.type === "object" && !isLocalizedString(elInner);
  const isElLS = isLocalizedString(elInner);

  function addItem() {
    onChange([...items, createDefaultValue(elementSchema)]);
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, newVal: unknown) {
    onChange(items.map((item, i) => (i === idx ? newVal : item)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">
          {label} ({items.length}){" "}
          {isOptional && (
            <span className="text-muted-foreground">(optionnel)</span>
          )}
        </Label>
        <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>

      {items.map((item, idx) => (
        <div
          key={idx}
          className="p-3 border rounded-md space-y-2 bg-muted/20"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {label} {idx + 1}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive"
              onClick={() => removeItem(idx)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {isElObject ? (
            <ObjectFields
              schema={elInner}
              value={(item as Record<string, unknown>) ?? {}}
              onChange={(newVal) => updateItem(idx, newVal)}
              compact
            />
          ) : isElLS ? (
            <LocalizedStringField
              label=""
              value={item}
              onChange={(newVal) => updateItem(idx, newVal)}
              isOptional={false}
              compact
            />
          ) : classifyField(elementSchema).kind === "number" ? (
            <NumberField
              label=""
              value={item}
              onChange={(newVal) => updateItem(idx, newVal)}
              isOptional={false}
              compact
            />
          ) : (
            <StringField
              label=""
              value={item}
              onChange={(newVal) => updateItem(idx, newVal)}
              isOptional={false}
              compact
            />
          )}
        </div>
      ))}
    </div>
  );
}
