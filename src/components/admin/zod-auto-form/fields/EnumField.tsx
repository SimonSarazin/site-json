import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { humanizeKey } from "../schema-utils";

interface EnumFieldProps {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
  options: (string | number)[];
  compact?: boolean;
}

export function EnumField({
  label,
  value,
  onChange,
  isOptional,
  options,
  compact,
}: EnumFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}{" "}
        {isOptional && (
          <span className="text-muted-foreground">(optionnel)</span>
        )}
      </Label>
      <Select
        value={value != null ? String(value) : ""}
        onValueChange={(v) => {
          if (v === "__none__") return onChange(undefined);
          const num = Number(v);
          onChange(isNaN(num) || options.every((o) => typeof o === "string") ? v : num);
        }}
      >
        <SelectTrigger className={compact ? "h-8 text-xs" : ""}>
          <SelectValue placeholder={isOptional ? "Aucun" : "Sélectionner..."} />
        </SelectTrigger>
        <SelectContent>
          {isOptional && (
            <SelectItem value="__none__">Aucun</SelectItem>
          )}
          {options.map((opt) => (
            <SelectItem key={String(opt)} value={String(opt)}>
              {humanizeKey(String(opt))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
