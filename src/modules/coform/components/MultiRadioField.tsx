import { useRef } from "react";
import type { FieldErrors } from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FieldError, FieldLabel, HintText } from "./FormFields";
import type { FormFieldMapping, MultiRadioValue } from "../types";

interface MultiRadioFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: MultiRadioValue;
  onChange?: (value: MultiRadioValue) => void;
}

/**
 * Composant pour le champ multiRadio.
 * Radio à sélection unique avec options simples ou complexes (avec champ texte).
 */
export function MultiRadioField({
  field,
  errors,
  value = { value: "" },
  onChange,
}: MultiRadioFieldProps) {
  const options = field.options || [];
  const config = field.multiRadioConfig;
  const hasError = !!errors[field.name];

  const inputRef = useRef<HTMLInputElement | null>(null);

  const textsup = value.textsup || "";
  const selectedValue = value.value || "";

  const getOptionType = (option: string): "simple" | "cplx" => {
    return config?.tofill?.[option] || "simple";
  };

  const getPlaceholder = (option: string): string => {
    return config?.placeholdersradio?.[option] || "";
  };

  const handleRadioChange = (newValue: string) => {
    const optType = getOptionType(newValue);
    const newData: MultiRadioValue = {
      value: newValue,
      type: optType,
    };
    // Conserver textsup si on revient sur la même option cplx
    if (optType === "cplx") {
      newData.textsup = newValue === selectedValue ? textsup : "";
      if (newValue !== selectedValue) {
        // Focus sur l'input texte après sélection
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
    onChange?.(newData);
  };

  const handleTextsupChange = (text: string) => {
    onChange?.({
      ...value,
      textsup: text,
    });
  };

  return (
    <div className={cn("space-y-3", field.width)}>
      <FieldLabel field={field} />
      {field.info && <HintText text={field.info} />}

      <RadioGroup
        value={selectedValue}
        onValueChange={handleRadioChange}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${field.name}-error` : undefined}
        aria-required={field.isRequired || undefined}
        className="space-y-1"
      >
        {options.map((option, index) => {
          const optType = getOptionType(option);
          const isSelected = selectedValue === option;
          const isCplx = optType === "cplx";
          const hasInlineInput = isCplx && isSelected;
          const placeholder = getPlaceholder(option);

          return (
            <div
              key={index}
              className="rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
            >
              {/* Ligne : radio + label + input inline (cplx). flex-wrap → l'input
                  reste en ligne quand il y a la place, passe dessous sinon. */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <RadioGroupItem value={option} id={`${field.name}-${index}`} className="shrink-0" />
                <Label
                  htmlFor={`${field.name}-${index}`}
                  className={cn(
                    "font-normal leading-snug cursor-pointer",
                    !hasInlineInput && "flex-1"
                  )}
                >
                  {option}
                </Label>

                {/* Champ texte inline pour option cplx (nom accessible = label de l'option) */}
                {hasInlineInput && (
                  <Input
                    ref={inputRef}
                    aria-label={placeholder || option}
                    value={textsup}
                    onChange={(e) => handleTextsupChange(e.target.value)}
                    placeholder={placeholder}
                    className="h-9 min-w-40 flex-1 basis-48 text-sm"
                  />
                )}
              </div>
            </div>
          );
        })}
      </RadioGroup>

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}
