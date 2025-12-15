import React from "react";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { cn } from "@/lib/utils";

export interface DatePickerInputProps {
  label?: string;
  name: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
  /** Include time selection */
  granularity?: "day" | "hour" | "minute" | "second";
  /** Show 12-hour format */
  hourCycle?: 12 | 24;
  /** Min selectable date */
  minDate?: Date;
  /** Max selectable date */
  maxDate?: Date;
}

const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  className,
  error,
  helpText,
  granularity = "day",
  hourCycle = 24,
  minDate,
  maxDate,
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={name} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <DateTimePicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        granularity={granularity}
        hourCycle={hourCycle}
        displayFormat={
          granularity === "day"
            ? { hour24: "dd/MM/yyyy" }
            : { hour24: "dd/MM/yyyy HH:mm" }
        }
        className={cn(
          error && "border-destructive focus-within:ring-destructive",
          className
        )}
        min={minDate}
        max={maxDate}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};

export default DatePickerInput;
