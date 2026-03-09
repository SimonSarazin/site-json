import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface TextInputProps {
  label?: string;
  name: string;
  type?: "text" | "email" | "tel" | "number" | "password";
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
}

const TextInput: React.FC<TextInputProps> = ({
  label,
  name,
  type = "text",
  placeholder,
  value,
  defaultValue,
  onChange,
  onBlur,
  required = false,
  disabled = false,
  readOnly = false,
  className,
  error,
  helpText,
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={name} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};

export default TextInput;
