import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface BooleanFieldProps {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
}

export function BooleanField({
  label,
  value,
  onChange,
}: BooleanFieldProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <Label className="text-xs font-medium">{label}</Label>
      <Switch
        checked={!!value}
        onCheckedChange={(checked) => onChange(checked)}
      />
    </div>
  );
}
