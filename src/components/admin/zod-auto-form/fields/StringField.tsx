import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CodeField } from "./CodeField";
import { ImageField, isImageKey } from "./ImageField";
import { IconField, isIconKey } from "./IconField";

const CODE_KEYS = new Set([
  "html", "css", "js", "code",
  "customCSS", "customJS", "script", "style",
]);

const MULTILINE_KEYS = new Set([
  "content", "description", "markdown",
  "body", "template", "snippet",
]);

interface StringFieldProps {
  label: string;
  fieldKey?: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
  compact?: boolean;
}

export function StringField({
  label,
  fieldKey,
  value,
  onChange,
  isOptional,
  compact,
}: StringFieldProps) {
  const isCode = fieldKey ? CODE_KEYS.has(fieldKey) : false;
  const isMultiline = fieldKey ? MULTILINE_KEYS.has(fieldKey) : false;
  const isIcon = fieldKey ? isIconKey(fieldKey) : false;
  const isImage = fieldKey ? (!isIcon && isImageKey(fieldKey)) : false;

  if (isCode && fieldKey) {
    return (
      <CodeField
        label={label}
        fieldKey={fieldKey}
        value={value}
        onChange={onChange}
        isOptional={isOptional}
        compact={compact}
      />
    );
  }

  if (isIcon && fieldKey) {
    return (
      <IconField
        label={label}
        fieldKey={fieldKey}
        value={value}
        onChange={onChange}
        isOptional={isOptional}
        compact={compact}
      />
    );
  }

  if (isImage && fieldKey) {
    return (
      <ImageField
        label={label}
        fieldKey={fieldKey}
        value={value}
        onChange={onChange}
        isOptional={isOptional}
        compact={compact}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}{" "}
        {isOptional && (
          <span className="text-muted-foreground">(optionnel)</span>
        )}
      </Label>
      {isMultiline ? (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) =>
            onChange(e.target.value || (isOptional ? undefined : ""))
          }
          className={compact ? "text-xs font-mono min-h-24" : "font-mono min-h-32"}
          rows={6}
        />
      ) : (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) =>
            onChange(e.target.value || (isOptional ? undefined : ""))
          }
          className={compact ? "h-8 text-xs" : ""}
        />
      )}
    </div>
  );
}
