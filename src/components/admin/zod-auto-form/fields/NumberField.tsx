import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NumberFieldProps {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
  compact?: boolean;
}

export function NumberField({
  label,
  value,
  onChange,
  isOptional,
  compact,
}: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}{" "}
        {isOptional && (
          <span className="text-muted-foreground">(optionnel)</span>
        )}
      </Label>
      <Input
        type="number"
        value={value != null ? String(value) : ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? (isOptional ? undefined : 0) : Number(v));
        }}
        className={compact ? "h-8 text-xs" : ""}
      />
    </div>
  );
}
