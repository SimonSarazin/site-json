import * as React from "react";
import { format, parse } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import getDateFnsLocale from "@/dateFns";

export interface DatePickerInputProps {
  value?: string; // Format ISO "YYYY-MM-DD"
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  startYear?: number;
  endYear?: number;
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = "Sélectionner une date",
  disabled = false,
  clearable = true,
  startYear = 1900,
  endYear = new Date().getFullYear(),
}: DatePickerInputProps) {
  const locale = getDateFnsLocale();
  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange?.(format(selectedDate, "yyyy-MM-dd"));
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange?.("");
  };

  return (
    <div className="relative flex items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              clearable && date && "pr-10",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP", { locale }) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            captionLayout="dropdown"
            startMonth={new Date(startYear, 0)}
            endMonth={new Date(endYear, 11)}
            defaultMonth={date}
          />
        </PopoverContent>
      </Popover>
      {clearable && date && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 p-1 hover:bg-muted rounded"
        >
          <X className="h-4 w-4 opacity-50 hover:opacity-100" />
        </button>
      )}
    </div>
  );
}
