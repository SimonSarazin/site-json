import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface TextareaInputProps {
  label?: string;
  name: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
  rows?: number;
}

const TextareaInput: React.FC<TextareaInputProps> = ({
  label,
  name,
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
  rows = 4,
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={name} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Textarea
        id={name}
        name={name}
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
          "resize-y",
          className
        )}
        rows={rows}
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

export default TextareaInput;
