import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LocalizedStringFieldProps {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
  compact?: boolean;
}

export function LocalizedStringField({
  label,
  value,
  onChange,
  isOptional,
  compact,
}: LocalizedStringFieldProps) {
  const obj = (value ?? {}) as Record<string, string>;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label} (fr){" "}
        {isOptional && (
          <span className="text-muted-foreground">(optionnel)</span>
        )}
      </Label>
      <Input
        value={obj.fr ?? ""}
        onChange={(e) => {
          const fr = e.target.value;
          if (isOptional && !fr) {
            onChange(undefined);
          } else {
            onChange({ ...obj, fr });
          }
        }}
        className={compact ? "h-8 text-xs" : ""}
      />
    </div>
  );
}
