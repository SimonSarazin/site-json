import { add, format, isBefore, isAfter, type Locale } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { useImperativeHandle, useRef, useState, useEffect, useMemo } from "react";
import { DayPicker } from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------- utils start ----------
type Period = "AM" | "PM";
type TimePickerType = "minutes" | "seconds" | "hours" | "12hours";

function isValidHour(value: string): boolean {
  return /^(0[0-9]|1[0-9]|2[0-3])$/.test(value);
}

function isValid12Hour(value: string): boolean {
  return /^(0[1-9]|1[0-2])$/.test(value);
}

function isValidMinuteOrSecond(value: string): boolean {
  return /^[0-5][0-9]$/.test(value);
}

function getValidNumber(value: string, { max, min = 0, loop = false }: { max: number; min?: number; loop?: boolean }): string {
  let numericValue = parseInt(value, 10);

  if (!Number.isNaN(numericValue)) {
    if (!loop) {
      if (numericValue > max) numericValue = max;
      if (numericValue < min) numericValue = min;
    } else {
      if (numericValue > max) numericValue = min;
      if (numericValue < min) numericValue = max;
    }
    return numericValue.toString().padStart(2, "0");
  }

  return "00";
}

function getValidHour(value: string): string {
  if (isValidHour(value)) return value;
  return getValidNumber(value, { max: 23 });
}

function getValid12Hour(value: string): string {
  if (isValid12Hour(value)) return value;
  return getValidNumber(value, { min: 1, max: 12 });
}

function getValidMinuteOrSecond(value: string): string {
  if (isValidMinuteOrSecond(value)) return value;
  return getValidNumber(value, { max: 59 });
}

function getValidArrowNumber(value: string, { min, max, step }: { min: number; max: number; step: number }): string {
  let numericValue = parseInt(value, 10);
  if (!Number.isNaN(numericValue)) {
    numericValue += step;
    return getValidNumber(String(numericValue), { min, max, loop: true });
  }
  return "00";
}

function getValidArrowHour(value: string, step: number): string {
  return getValidArrowNumber(value, { min: 0, max: 23, step });
}

function getValidArrow12Hour(value: string, step: number): string {
  return getValidArrowNumber(value, { min: 1, max: 12, step });
}

function getValidArrowMinuteOrSecond(value: string, step: number): string {
  return getValidArrowNumber(value, { min: 0, max: 59, step });
}

function setMinutes(date: Date, value: string): Date {
  const minutes = getValidMinuteOrSecond(value);
  date.setMinutes(parseInt(minutes, 10));
  return date;
}

function setSeconds(date: Date, value: string): Date {
  const seconds = getValidMinuteOrSecond(value);
  date.setSeconds(parseInt(seconds, 10));
  return date;
}

function setHours(date: Date, value: string): Date {
  const hours = getValidHour(value);
  date.setHours(parseInt(hours, 10));
  return date;
}

function set12Hours(date: Date, value: string, period: Period): Date {
  const hours = parseInt(getValid12Hour(value), 10);
  const convertedHours = convert12HourTo24Hour(hours, period);
  date.setHours(convertedHours);
  return date;
}

function setDateByType(date: Date, value: string, type: TimePickerType, period?: Period): Date {
  switch (type) {
  case "minutes":
    return setMinutes(date, value);
  case "seconds":
    return setSeconds(date, value);
  case "hours":
    return setHours(date, value);
  case "12hours":
    if (!period) return date;
    return set12Hours(date, value, period);
  default:
    return date;
  }
}

function getDateByType(date: Date | undefined, type: TimePickerType): string {
  if (!date) return "00";
  switch (type) {
  case "minutes":
    return getValidMinuteOrSecond(String(date.getMinutes()));
  case "seconds":
    return getValidMinuteOrSecond(String(date.getSeconds()));
  case "hours":
    return getValidHour(String(date.getHours()));
  case "12hours":
    return getValid12Hour(String(display12HourValue(date.getHours())));
  default:
    return "00";
  }
}

function getArrowByType(value: string, step: number, type: TimePickerType): string {
  switch (type) {
  case "minutes":
    return getValidArrowMinuteOrSecond(value, step);
  case "seconds":
    return getValidArrowMinuteOrSecond(value, step);
  case "hours":
    return getValidArrowHour(value, step);
  case "12hours":
    return getValidArrow12Hour(value, step);
  default:
    return "00";
  }
}

function convert12HourTo24Hour(hour: number, period: Period): number {
  if (period === "PM") {
    if (hour <= 11) {
      return hour + 12;
    }
    return hour;
  }
  if (period === "AM") {
    if (hour === 12) return 0;
    return hour;
  }
  return hour;
}

function display12HourValue(hours: number): string {
  if (hours === 0 || hours === 12) return "12";
  if (hours >= 22) return `${hours - 12}`;
  if (hours % 12 > 9) return `${hours}`;
  return `0${hours % 12}`;
}

function genMonths(locale: Locale): Array<{ value: number; label: string }> {
  return Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2021, i), "MMMM", { locale }),
  }));
}

function genYears(yearRange = 50): Array<{ value: number; label: string }> {
  const today = new Date();
  return Array.from({ length: yearRange * 2 + 1 }, (_, i) => ({
    value: today.getFullYear() - yearRange + i,
    label: (today.getFullYear() - yearRange + i).toString(),
  }));
}

function clampDate(date: Date, min?: Date, max?: Date): Date {
  if (min && isBefore(date, min)) return new Date(min);
  if (max && isAfter(date, max)) return new Date(max);
  return date;
}

// ---------- utils end ----------

type CalendarProps = {
  className?: string;
  classNames?: Record<string, string>;
  showOutsideDays?: boolean;
  yearRange?: number;
  min?: Date;
  max?: Date;
  mode?: 'single';
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (date: Date) => void;
  locale?: Locale;
  showWeekNumber?: boolean;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  yearRange = 50,
  min,
  max,
  ...props
}: CalendarProps) {
  const MONTHS = useMemo(() => {
    const locale = (props.locale as Locale | undefined) || fr;
    return genMonths(locale);
  }, [props.locale]);

  const YEARS = useMemo(() => genYears(yearRange), [yearRange]);

  const disableLeftNavigation = () => {
    const today = new Date();
    const startDate = new Date(today.getFullYear() - yearRange, 0, 1);
    if (props.month) {
      return (
        props.month.getMonth() === startDate.getMonth() &&
        props.month.getFullYear() === startDate.getFullYear()
      );
    }
    return false;
  };

  const disableRightNavigation = () => {
    const today = new Date();
    const endDate = new Date(today.getFullYear() + yearRange, 11, 31);
    if (props.month) {
      return (
        props.month.getMonth() === endDate.getMonth() &&
        props.month.getFullYear() === endDate.getFullYear()
      );
    }
    return false;
  };

  // Désactive les jours hors plage min/max
  const disabledDays = (date: Date): boolean => {
    if (min && isBefore(date, min)) return true;
    if (max && isAfter(date, max)) return true;
    return false;
  };

  // Extract only DayPicker-compatible props; CalendarProps has extra fields (yearRange, min, max)
  const { selected, onSelect, month, onMonthChange, locale: pickerLocale, showWeekNumber } = props;

  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={onSelect}
      month={month}
      onMonthChange={onMonthChange}
      locale={pickerLocale}
      showWeekNumber={showWeekNumber}
      showOutsideDays={showOutsideDays}
      disabled={disabledDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 justify-center",
        month: "flex flex-col items-center space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-5 top-5",
          disableLeftNavigation() && "pointer-events-none"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-5 top-5",
          disableRightNavigation() && "pointer-events-none"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: cn("flex", props.showWeekNumber && "justify-end"),
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day:
          "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 rounded-1",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-l-md rounded-r-md"
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-l-md rounded-r-md",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: (props) =>
          props.orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
        MonthCaption: ({ calendarMonth }) => {
          return (
            <div className="inline-flex gap-2">
              <Select
                defaultValue={calendarMonth.date.getMonth().toString()}
                onValueChange={(value) => {
                  const newDate = new Date(calendarMonth.date);
                  newDate.setMonth(Number.parseInt(value, 10));
                  if (min && isBefore(newDate, min)) newDate.setTime(min.getTime());
                  if (max && isAfter(newDate, max)) newDate.setTime(max.getTime());
                  props.onMonthChange?.(newDate);
                }}
              >
                <SelectTrigger className="focus:bg-accent focus:text-accent-foreground w-fit gap-1 border-none p-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                defaultValue={calendarMonth.date.getFullYear().toString()}
                onValueChange={(value) => {
                  const newDate = new Date(calendarMonth.date);
                  newDate.setFullYear(Number.parseInt(value, 10));
                  if (min && isBefore(newDate, min)) newDate.setTime(min.getTime());
                  if (max && isAfter(newDate, max)) newDate.setTime(max.getTime());
                  props.onMonthChange?.(newDate);
                }}
              >
                <SelectTrigger className="focus:bg-accent focus:text-accent-foreground w-fit gap-1 border-none p-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year.value} value={year.value.toString()}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        },
      }}
    />
  );
}
Calendar.displayName = "Calendar";

interface TimePeriodSelectProps extends React.ComponentPropsWithoutRef<"div"> {
  period?: Period;
  setPeriod?: (period: Period) => void;
  date?: Date;
  onDateChange?: (date: Date) => void;
  onLeftFocus?: () => void;
  onRightFocus?: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}

function TimePeriodSelect({
  period,
  setPeriod,
  date,
  onDateChange,
  onLeftFocus,
  onRightFocus,
  buttonRef,
  ...props
}: TimePeriodSelectProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") onRightFocus?.();
    if (e.key === "ArrowLeft") onLeftFocus?.();
  };

  const handleValueChange = (value: string) => {
    setPeriod?.(value as Period);

    if (date) {
      const tempDate = new Date(date);
      const hours = display12HourValue(date.getHours());
      onDateChange?.(
        setDateByType(tempDate, hours.toString(), "12hours", period === "AM" ? "PM" : "AM")
      );
    }
  };

  return (
    <div className="flex h-10 items-center" data-slot="time-period-select" {...props}>
      <Select defaultValue={period} onValueChange={handleValueChange}>
        <SelectTrigger
          ref={buttonRef}
          className="focus:bg-accent focus:text-accent-foreground w-[65px]"
          onKeyDown={handleKeyDown}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

interface TimePickerInputProps extends Omit<React.ComponentPropsWithoutRef<"input">, "type" | "value" | "onChange" | "onKeyDown" | "min" | "max"> {
  type?: string;
  value?: string;
  picker?: TimePickerType;
  date?: Date;
  onDateChange?: (date: Date) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  period?: Period;
  onLeftFocus?: () => void;
  onRightFocus?: () => void;
  min?: Date;
  max?: Date;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function TimePickerInput({
  className,
  type = "tel",
  value,
  id,
  name,
  date = new Date(new Date().setHours(0, 0, 0, 0)),
  onDateChange,
  onChange,
  onKeyDown,
  picker = "hours",
  period,
  onLeftFocus,
  onRightFocus,
  min,
  max,
  inputRef,
  ...props
}: TimePickerInputProps) {
  const [flag, setFlag] = useState(false);
  const [prevIntKey, setPrevIntKey] = useState("0");


  useEffect(() => {
    if (flag) {
      const timer = setTimeout(() => {
        setFlag(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [flag]);

  const calculatedValue = useMemo(() => {
    return getDateByType(date, picker);
  }, [date, picker]);

  const calculateNewValue = (key: string): string => {
    if (picker === "12hours") {
      if (flag && calculatedValue.slice(1, 2) === "1" && prevIntKey === "0") return `0${key}`;
    }

    return !flag ? `0${key}` : calculatedValue.slice(1, 2) + key;
  };

  const clampDatePartial = (date: Date): Date => {
    if (!min && !max) return date;
    const d = new Date(date);
    //   if (min && d < min) return new Date(min);
    //   if (max && d > max) return new Date(max);
    return d;
  };

  const handleBlur = () => {
    if (!date) return;
    const clampedDate = date;
    //   if (min && isBefore(clampedDate, min)) clampedDate = new Date(min);
    //   if (max && isAfter(clampedDate, max)) clampedDate = new Date(max);
    onDateChange?.(clampedDate);
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") return;
    e.preventDefault();
    if (e.key === "ArrowRight") onRightFocus?.();
    if (e.key === "ArrowLeft") onLeftFocus?.();
    if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      const step = e.key === "ArrowUp" ? 1 : -1;
      const newValue = getArrowByType(calculatedValue, step, picker);
      if (flag) setFlag(false);
      const tempDate = date ? new Date(date) : new Date();
      // Clamp uniquement si fin de saisie
      const clamped = flag ? setDateByType(tempDate, newValue, picker, period) : clampDatePartial(setDateByType(tempDate, newValue, picker, period));
      onDateChange?.(clamped);
    }
    if (e.key >= "0" && e.key <= "9") {
      // console.log("key", e.key);
      if (picker === "12hours") setPrevIntKey(e.key);
      const newValue = calculateNewValue(e.key);
      if (flag) onRightFocus?.();
      setFlag((prev) => !prev);
      const tempDate = date ? new Date(date) : new Date();
      // Pareil, clamp uniquement à la fin
      // console.log("flag", flag);
      const clamped = !flag ? clampDatePartial(setDateByType(tempDate, newValue, picker, period)) : setDateByType(tempDate, newValue, picker, period);
      onDateChange?.(clamped);
    }
  };

  return (
    <Input
      ref={inputRef}
      id={id || picker}
      name={name || picker}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground w-[48px] text-center font-mono text-base tabular-nums caret-transparent [&::-webkit-inner-spin-button]:appearance-none",
        className
      )}
      value={value || calculatedValue}
      onChange={(e) => {
        e.preventDefault();
        onChange?.(e);
      }}
      onBlur={handleBlur}
      type={type}
      inputMode="decimal"
      onKeyDown={(e) => {
        onKeyDown?.(e);
        handleKeyDown(e);
      }}
      data-slot="time-picker-input"
      {...props}
    />
  );
}

interface TimePickerProps extends Omit<React.ComponentPropsWithoutRef<"div">, "onChange"> {
  date?: Date;
  onChange?: (date: Date) => void;
  hourCycle?: 12 | 24;
  granularity?: "day" | "hour" | "minute" | "second";
  min?: Date;
  max?: Date;
  timePickerRef?: React.RefObject<TimePickerRef>;
}

interface TimePickerRef {
  minuteRef: HTMLInputElement | null;
  hourRef: HTMLInputElement | null;
  secondRef: HTMLInputElement | null;
  periodRef: HTMLButtonElement | null;
}

function TimePicker({
  date,
  onChange,
  hourCycle = 24,
  granularity = "second",
  min,
  max,
  timePickerRef,
  ...props
}: TimePickerProps) {
  const minuteRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);
  const periodRef = useRef<HTMLButtonElement>(null);
  const [period, setPeriod] = useState<Period>(
    date && date.getHours() >= 12 ? "PM" : "AM"
  );

  useImperativeHandle(
    timePickerRef,
    () => ({
      minuteRef: minuteRef.current,
      hourRef: hourRef.current,
      secondRef: secondRef.current,
      periodRef: periodRef.current,
    }),
    [minuteRef, hourRef, secondRef]
  );

  // Clamp avant setPeriod (dans onDateChange)
  const handleDateChange = (value: Date) => {
    if (!value) {
      return;
    }
    const clampedValue = value;
    //   if (min && isBefore(clampedValue, min)) clampedValue = new Date(min);
    //   if (max && isAfter(clampedValue, max)) clampedValue = new Date(max);

    onChange?.(clampedValue);
    setPeriod(clampedValue.getHours() >= 12 ? "PM" : "AM");
  };

  return (
    <div className="flex items-center justify-center gap-2" data-slot="time-picker" {...props}>
      <label htmlFor="datetime-picker-hour-input" className="cursor-pointer">
        <Clock className="mr-2 h-4 w-4" />
      </label>
      <TimePickerInput
        picker={hourCycle === 24 ? "hours" : "12hours"}
        date={date}
        id="datetime-picker-hour-input"
        onDateChange={handleDateChange}
        inputRef={hourRef}
        period={period}
        onRightFocus={() => minuteRef?.current?.focus()}
        min={min}
        max={max}
      />
      {(granularity === "minute" || granularity === "second") && (
        <>
          :
          <TimePickerInput
            picker="minutes"
            date={date}
            onDateChange={handleDateChange}
            inputRef={minuteRef}
            onLeftFocus={() => hourRef?.current?.focus()}
            onRightFocus={() => secondRef?.current?.focus()}
            min={min}
            max={max}
          />
        </>
      )}
      {granularity === "second" && (
        <>
          :
          <TimePickerInput
            picker="seconds"
            date={date}
            onDateChange={handleDateChange}
            inputRef={secondRef}
            onLeftFocus={() => minuteRef?.current?.focus()}
            onRightFocus={() => periodRef?.current?.focus()}
            min={min}
            max={max}
          />
        </>
      )}
      {hourCycle === 12 && (
        <div className="grid gap-1 text-center">
          <TimePeriodSelect
            period={period}
            setPeriod={setPeriod}
            date={date}
            onDateChange={(date) => {
              handleDateChange(date);
            }}
            buttonRef={periodRef}
            onLeftFocus={() => secondRef?.current?.focus()}
          />
        </div>
      )}
    </div>
  );
}

interface DateTimePickerProps extends Omit<React.ComponentPropsWithoutRef<typeof Popover>, "value" | "onChange"> {
  locale?: Locale;
  defaultPopupValue?: Date;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  onMonthChange?: (date: Date) => void;
  hourCycle?: 12 | 24;
  yearRange?: number;
  disabled?: boolean;
  displayFormat?: {
    hour24?: string;
    hour12?: string;
  };
  granularity?: "day" | "hour" | "minute" | "second";
  placeholder?: string;
  min?: Date;
  max?: Date;
  className?: string;
  dateTimePickerRef?: React.RefObject<DateTimePickerRef>;
  /** Affiche un bouton X pour effacer la valeur */
  clearable?: boolean;
}

interface DateTimePickerRef {
  value?: Date;
}

function DateTimePicker({
  locale = fr,
  defaultPopupValue,
  value,
  onChange,
  onMonthChange,
  hourCycle = 24,
  yearRange = 50,
  disabled = false,
  displayFormat,
  granularity = "second",
  placeholder = "Pick a date",
  min,
  max,
  className,
  dateTimePickerRef,
  clearable = false,
  ...props
}: DateTimePickerProps) {
  const now = useMemo(() => new Date(), []);

  // Valider la date passée
  const validValue = value && !isNaN(value.getTime()) ? value : undefined;
  const initialDate = validValue ?? defaultPopupValue ?? now;

  const [month, setMonth] = useState<Date>(initialDate);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [displayDate, setDisplayDate] = useState<Date | undefined>(validValue);

  const effectiveOnMonthChange = onMonthChange ?? onChange;

  useEffect(() => {
    const validatedValue = value && !isNaN(value.getTime()) ? value : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs display state with controlled value prop
    setDisplayDate(validatedValue);
  }, [value]);

  useImperativeHandle(
    dateTimePickerRef,
    () => ({
      ...buttonRef.current,
      value: displayDate,
    }),
    [displayDate]
  );

  function clampDateLocal(date: Date): Date {
    if (!min && !max) return date;
    const d = new Date(date);
    //   if (min && d < min) return new Date(min);
    //   if (max && d > max) return new Date(max);
    return d;
  }

  const handleMonthChange = (newDay: Date) => {
    if (!newDay) {
      return;
    }
    if (!defaultPopupValue) {
      newDay.setHours(
        month.getHours(),
        month.getMinutes(),
        month.getSeconds()
      );
      const clamped = clampDateLocal(newDay);
      effectiveOnMonthChange?.(clamped);
      setMonth(clamped);
      return;
    }
    const diff = newDay.getTime() - defaultPopupValue.getTime();
    const diffInDays = diff / (1000 * 60 * 60 * 24);
    const newDateFull = add(defaultPopupValue, { days: Math.ceil(diffInDays) });
    newDateFull.setHours(
      month.getHours(),
      month.getMinutes(),
      month.getSeconds()
    );
    const clamped = clampDateLocal(newDateFull);
    effectiveOnMonthChange?.(clamped);
    setMonth(clamped);
  };

  const onSelect = (newDay: Date) => {
    if (!newDay) {
      return;
    }
    const clamped = clampDateLocal(newDay);
    onChange?.(clamped);
    setMonth(clamped);
    setDisplayDate(clamped);
  };

  const initHourFormat = {
    hour24:
      displayFormat?.hour24 ?? `PPP HH:mm${!granularity || granularity === "second" ? ":ss" : ""}`,
    hour12:
      displayFormat?.hour12 ?? `PP hh:mm${!granularity || granularity === "second" ? ":ss" : ""} b`,
  };

  let loc: Locale = fr;
  if (locale) {
    const { options, localize, formatLong } = locale;
    if (options && localize && formatLong) {
      loc = {
        ...fr,
        options,
        localize,
        formatLong,
      };
    }
  }

  return (
    <ButtonGroup className={cn("w-full", className)}>
      <Popover {...props}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button
            variant="outline"
            className={cn(
              "flex-1 justify-start text-left font-normal",
              !displayDate && "text-muted-foreground"
            )}
            ref={buttonRef}
            data-slot="datetime-picker-trigger"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayDate ? (
              format(
                displayDate,
                hourCycle === 24 ? initHourFormat.hour24 : initHourFormat.hour12,
                {
                  locale: loc,
                }
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" data-slot="datetime-picker-content">
          <Calendar
            mode="single"
            selected={displayDate}
            month={month}
            onSelect={(newDate) => {
              if (newDate) {
                newDate.setHours(
                  month?.getHours?.() ?? 0,
                  month?.getMinutes?.() ?? 0,
                  month?.getSeconds?.() ?? 0
                );
                onSelect(newDate);
              }
            }}
            onMonthChange={handleMonthChange}
            yearRange={yearRange}
            locale={locale}
            min={min}
            max={max}
          />
          {granularity !== "day" && (
            <div className="border-border border-t p-3">
              <TimePicker
                onChange={(value) => {
                  const clampedValue = clampDate(value, min, max);
                  onChange?.(clampedValue);
                  setDisplayDate(clampedValue);
                  if (clampedValue) {
                    setMonth(clampedValue);
                  }
                }}
                date={month}
                hourCycle={hourCycle}
                granularity={granularity}
                min={min}
                max={max}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
      {clearable && displayDate && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            onChange?.(undefined);
            setDisplayDate(undefined);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </ButtonGroup>
  );
}

export { DateTimePicker, TimePickerInput, TimePicker };