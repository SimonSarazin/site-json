import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FormFieldMapping } from "../types";

// Import dynamique pour éviter les erreurs SSR avec les imports CSS
const MDEditor = lazy(() => import("@uiw/react-md-editor").then(mod => ({ default: mod.default })));

/**
 * Composant pour afficher un indice/info avec support markdown
 */
function HintText({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground -mt-1 mb-1 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

interface FormFieldProps {
  field: FormFieldMapping;
  register?: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

/**
 * Composant pour afficher un champ texte simple
 */
export function TextField({ field, register, errors }: FormFieldProps) {
  const hasError = !!errors[field.name];
  
  return (
    <div className={cn("space-y-2", field.width)}>
      <Label 
        htmlFor={field.name}
        className="text-sm font-medium text-foreground"
      >
        {field.label}
        {field.isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.info && <HintText text={field.info} />}
      <div className={cn(
        "relative",
        "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-b-md",
        "after:origin-left after:scale-x-0 after:transition-transform after:duration-300 after:ease-out",
        hasError 
          ? "after:scale-x-100 after:bg-destructive" 
          : "focus-within:after:scale-x-100 after:bg-primary"
      )}>
        <Input
          id={field.name}
          type={field.inputType || "text"}
          placeholder={field.placeholder}
          {...(register ? register(field.name) : {})}
          className="border border-input focus-visible:ring-0 focus-visible:border-input"
        />
      </div>
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

/**
 * Composant pour afficher un champ textarea (avec support markdown optionnel)
 */
export function TextAreaField({ field, register, errors, value, onChange }: FormFieldProps) {
  const hasError = !!errors[field.name];
  const isMarkdown = field.markdown === true;
  const textValue = typeof value === "string" ? value : "";
  
  return (
    <div className={cn("space-y-2", field.width)}>
      <Label 
        htmlFor={field.name}
        className="text-sm font-medium text-foreground"
      >
        {field.label}
        {field.isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.info && <HintText text={field.info} />}

      {isMarkdown ? (
        <div data-color-mode="light">
          <Suspense fallback={<div className="min-h-50 border rounded-md p-4 bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">Chargement de l'éditeur...</div>}>
            <MDEditor
              value={textValue}
              onChange={(val) => onChange?.(val || "")}
              height={200}
              preview="edit"
            />
          </Suspense>
        </div>
      ) : (
        <div className={cn(
          "relative",
          "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-b-md",
          "after:origin-left after:scale-x-0 after:transition-transform after:duration-300 after:ease-out",
          hasError 
            ? "after:scale-x-100 after:bg-destructive" 
            : "focus-within:after:scale-x-100 after:bg-primary"
        )}>
          <Textarea
            id={field.name}
            placeholder={field.placeholder}
            {...(register ? register(field.name) : {})}
            className="min-h-25 border border-input focus-visible:ring-0 focus-visible:border-input"
          />
        </div>
      )}

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

/**
 * Composant pour afficher des boutons radio
 */
export function RadioField({ field, errors, value, onChange }: FormFieldProps) {
  const options = field.options || [];
  const isRow = field.positionType === "row";
  const selectedValue = typeof value === "string" ? value : "";
  const hasError = !!errors[field.name];

  return (
    <div className={cn("space-y-4", field.width)}>
      <Label className="text-sm font-medium text-foreground">
        {field.label}
        {field.isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.info && <HintText text={field.info} />}
      
      <RadioGroup
        value={selectedValue}
        onValueChange={onChange}
        className={cn(
          isRow ? "flex flex-row flex-wrap gap-4" : "flex-col space-y-0.5"
        )}
      >
        {options.map((option, index) => (
          <div 
            key={index} 
            className="flex items-center space-x-2.5 cursor-pointer"
          >
            <RadioGroupItem value={option} id={`${field.name}-${index}`} />
            <Label 
              htmlFor={`${field.name}-${index}`} 
              className="font-normal cursor-pointer flex-1"
            >
              {option}
            </Label>
          </div>
        ))}
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

/**
 * Composant pour afficher des cases à cocher
 */
export function CheckboxField({ field, errors, value = [], onChange }: FormFieldProps) {
  const options = field.options || [];
  const isRow = field.positionType === "row";
  const selectedValues = Array.isArray(value) ? value as string[] : [];
  const hasError = !!errors[field.name];

  const handleCheckboxChange = (option: string, checked: boolean) => {
    if (checked) {
      onChange?.([...selectedValues, option]);
    } else {
      onChange?.(selectedValues.filter((v: string) => v !== option));
    }
  };

  return (
    <div className={cn("space-y-4", field.width)}>
      <Label className="text-sm font-medium text-foreground">
        {field.label}
        {field.isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.info && <HintText text={field.info} />}

      <div
        className={cn(
          isRow ? "flex flex-row flex-wrap gap-4" : "flex-col space-y-0.5"
        )}
      >
        {options.map((option, index) => {
          const isChecked = selectedValues.includes(option);
          return (
            <div 
              key={index} 
              className="flex items-center space-x-2.5 py-1 cursor-pointer"
            >
              <Checkbox
                id={`${field.name}-${index}`}
                checked={isChecked}
                onCheckedChange={(checked) => handleCheckboxChange(option, checked as boolean)}
              />
              <Label 
                htmlFor={`${field.name}-${index}`} 
                className="font-normal cursor-pointer flex-1"
              >
                {option}
              </Label>
            </div>
          );
        })}
      </div>

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
