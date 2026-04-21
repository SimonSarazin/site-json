import { useRef } from "react";
import type { FieldErrors } from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FormFieldMapping, MultiRadioValue } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function HintText({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground -mt-1 mb-1 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

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
    <div className={cn("space-y-4", field.width)}>
      <Label className="text-sm font-medium text-foreground">
        {field.label}
        {field.isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.info && <HintText text={field.info} />}

      <RadioGroup
        value={selectedValue}
        onValueChange={handleRadioChange}
        className="flex-col space-y-1"
      >
        {options.map((option, index) => {
          const optType = getOptionType(option);
          const isSelected = selectedValue === option;
          const isCplx = optType === "cplx";

          return (
            <div key={index} className="space-y-1.5">
              <div className="flex items-center space-x-2.5 cursor-pointer">
                <RadioGroupItem value={option} id={`${field.name}-${index}`} />
                <Label
                  htmlFor={`${field.name}-${index}`}
                  className="font-normal cursor-pointer flex-1"
                >
                  {option}
                </Label>
              </div>
              {/* Champ texte pour option cplx */}
              {isCplx && isSelected && (
                <div className="ml-7">
                  <Input
                    ref={inputRef}
                    value={textsup}
                    onChange={(e) => handleTextsupChange(e.target.value)}
                    placeholder={getPlaceholder(option)}
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          );
        })}
      </RadioGroup>

      {hasError && (
        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {errors[field.name]?.message as string}
        </p>
      )}
    </div>
  );
}
