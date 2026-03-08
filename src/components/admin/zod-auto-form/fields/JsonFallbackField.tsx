import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

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
  isOptional,
}: JsonFallbackFieldProps) {
  const hasValue = value !== undefined && value !== null;

  if (isOptional && !hasValue) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => onChange({})}
        >
          <Plus className="h-3 w-3" />
          {label}
        </Button>
        <Badge variant="outline" className="text-[10px]">
          JSON
        </Badge>
        <span className="text-[10px] text-muted-foreground">(optionnel)</span>
      </div>
    );
  }

  return (
    <JsonEditor
      label={label}
      value={value}
      onChange={onChange}
      isOptional={isOptional}
    />
  );
}

function JsonEditor({
  label,
  value,
  onChange,
  isOptional,
}: JsonFallbackFieldProps) {
  const [json, setJson] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJson(JSON.stringify(value, null, 2));
  }, [value]);

  function apply() {
    try {
      onChange(JSON.parse(json));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleRemove() {
    onChange(undefined);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium">
          {label}{" "}
          <Badge variant="outline" className="text-[10px] ml-1">
            JSON
          </Badge>
        </Label>
        {isOptional && (
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
        )}
      </div>
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
