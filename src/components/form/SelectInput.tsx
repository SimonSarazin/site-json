import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectInputProps {
  label?: string;
  name: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLButtonElement>) => void;
  options: SelectOption[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
}

const SelectInput: React.FC<SelectInputProps> = ({
  label,
  name,
  placeholder = "Sélectionnez une option",
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
}) => {
  return (
    <div className="space-y-2 w-full">
      {label && (
        <Label htmlFor={name} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Select
        value={value}
        defaultValue={defaultValue}
        onValueChange={onChange}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger
          id={name}
          name={name}
          className={cn(
            error && "border-destructive focus:ring-destructive",
            className
          )}
          onBlur={onBlur}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};

export default SelectInput;
