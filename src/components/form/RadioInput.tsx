import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioInputProps {
  label?: string;
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
  options: RadioOption[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
  orientation?: "horizontal" | "vertical";
}

const RadioInput: React.FC<RadioInputProps> = ({
  label,
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  options,
  required = false,
  disabled = false,
  className,
  error,
  helpText,
  orientation = "vertical",
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <Label className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <RadioGroup
        value={value}
        defaultValue={defaultValue}
        onValueChange={onChange}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        className={cn(
          orientation === "horizontal" && "flex flex-wrap gap-4",
          className
        )}
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem
              value={option.value}
              id={`${name}-${option.value}`}
              disabled={option.disabled || disabled}
            />
            <Label
              htmlFor={`${name}-${option.value}`}
              className={cn(
                "text-sm font-normal cursor-pointer",
                (option.disabled || disabled) && "cursor-not-allowed opacity-70"
              )}
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};

export default RadioInput;
