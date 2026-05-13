import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCALES, type Locale } from "@/types/locale-schema";

interface LocalizedStringFieldProps {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
  compact?: boolean;
}

const DEFAULT_LANG: Locale = "fr";

export function LocalizedStringField({
  label,
  value,
  onChange,
  isOptional,
  compact,
}: LocalizedStringFieldProps) {
  const obj = (value ?? {}) as Record<string, string>;

  const updateLocale = (locale: Locale, val: string) => {
    const next = { ...obj, [locale]: val };
    if (!val) delete next[locale];

    if (isOptional && Object.keys(next).length === 0) {
      onChange(undefined);
      return;
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {LOCALES.map((locale, idx) => {
        const isDefault = locale === DEFAULT_LANG;
        return (
          <div key={locale} className="space-y-1.5">
            {idx === 0 && (
              <Label className="text-xs font-medium">
                {label}{" "}
                {isOptional && (
                  <span className="text-muted-foreground">(optionnel)</span>
                )}
              </Label>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground w-7 shrink-0 uppercase">
                {locale}
                {isDefault && !isOptional && <span className="text-destructive ml-0.5">*</span>}
              </span>
              <Input
                value={obj[locale] ?? ""}
                onChange={(e) => updateLocale(locale, e.target.value)}
                className={compact ? "h-8 text-xs" : ""}
                placeholder={isDefault ? undefined : `Traduction ${locale.toUpperCase()}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
