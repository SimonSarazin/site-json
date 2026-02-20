import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface JsonFallbackFieldProps {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
}

export function JsonFallbackField({
  label,
  value,
  onChange,
}: JsonFallbackFieldProps) {
  const [json, setJson] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  function apply() {
    try {
      onChange(JSON.parse(json));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}{" "}
        <Badge variant="outline" className="text-[10px] ml-1">
          JSON
        </Badge>
      </Label>
      <textarea
        className="w-full h-32 font-mono text-xs p-2 border rounded-md bg-muted/30 resize-y"
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="sm" onClick={apply} className="w-full">
        Appliquer
      </Button>
    </div>
  );
}
