import type { UseFormRegister, FieldErrors } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FormFieldMapping } from "../types";
import { MarkdownEditor } from "./MarkdownEditor";

/**
 * Détecte si une chaîne est du HTML déjà rendu (ex: Parsedown PHP) ou du markdown brut.
 * Utilise dangerouslySetInnerHTML pour le HTML, ReactMarkdown pour le markdown brut.
 */
export function ProseContent({ text, className, forceMarkdown = false }: { text: string; className?: string; forceMarkdown?: boolean }) {
  const isHtml = !forceMarkdown && /<[a-zA-Z][^>]*>/.test(text);
  return isHtml ? (
    <div className={className} dangerouslySetInnerHTML={{ __html: text }} />
  ) : (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{text}</ReactMarkdown>
    </div>
  );
}

/**
 * Composant pour afficher un indice/info avec support markdown
 */
function HintText({ text }: { text: string }) {
  return (
    <ProseContent
      text={text}
      className="text-xs text-muted-foreground -mt-1 mb-1 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0"
    />
  );
}

/**
 * Message d'erreur de champ avec ARIA — id stable pour `aria-describedby`
 * et `role="alert"` pour annonce SR immédiate. Réutilisé par tous les
 * composants de champs CoForm (export pour usage cross-fichier).
 */
export function FieldError({ name, message }: { name: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p
      id={`${name}-error`}
      role="alert"
      className="text-xs text-destructive flex items-center gap-1 mt-1"
    >
      <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
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
      {field.label && (
        <Label
          htmlFor={field.name}
          className="text-sm font-medium text-foreground"
        >
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {field.info && <HintText text={field.info} />}
      <div className={cn(
        // `overflow-hidden rounded-md` : clippe la sous-ligne `after:` au
        // même radius que l'<Input> (rounded-md). Sans ça, le trait rouge
        // (état erreur) ou bleu (focus) déborde aux deux coins inférieurs.
        "relative overflow-hidden rounded-md",
        "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full",
        "after:origin-left after:scale-x-0 after:transition-transform after:duration-300 after:ease-out",
        hasError
          ? "after:scale-x-100 after:bg-destructive"
          : "focus-within:after:scale-x-100 after:bg-primary"
      )}>
        <Input
          id={field.name}
          type={field.inputType || "text"}
          placeholder={field.placeholder}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${field.name}-error` : undefined}
          aria-required={field.isRequired || undefined}
          {...(register ? register(field.name) : {})}
          className="border border-input focus-visible:ring-0 focus-visible:border-input"
        />
      </div>
      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
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
      {field.label && (
        <Label
          htmlFor={field.name}
          className="text-sm font-medium text-foreground"
        >
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {field.info && <HintText text={field.info} />}

      {isMarkdown ? (
        <MarkdownEditor
          value={textValue}
          onChange={(val) => onChange?.(val || "")}
          height={200}
          preview="edit"
        />
      ) : (
        <div className={cn(
          // Cf. TextField : `overflow-hidden rounded-md` clippe la sous-ligne
          // `after:` au même radius que le <Textarea>, sinon le trait
          // rouge/bleu déborde aux coins inférieurs.
          "relative overflow-hidden rounded-md",
          "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full",
          "after:origin-left after:scale-x-0 after:transition-transform after:duration-300 after:ease-out",
          hasError
            ? "after:scale-x-100 after:bg-destructive"
            : "focus-within:after:scale-x-100 after:bg-primary"
        )}>
          <Textarea
            id={field.name}
            placeholder={field.placeholder}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? `${field.name}-error` : undefined}
            aria-required={field.isRequired || undefined}
            {...(register ? register(field.name) : {})}
            className="min-h-25 border border-input focus-visible:ring-0 focus-visible:border-input"
          />
        </div>
      )}

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}

/**
 * Séparateur de section avec titre (tpls.forms.sectionTitle)
 * Affiche un titre h2 + barre séparatrice + info optionnel.
 * N'enregistre aucune valeur dans react-hook-form.
 */
export function SectionTitleField({ field }: { field: FormFieldMapping }) {
  const cfg = field.sectionTitleConfig ?? {
    showBar: true,
    barPosition: "between" as const,
    align: "center" as const,
    textDecoration: "uppercase" as const,
  };

  const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[cfg.align];

  return (
    <div className={cn("col-span-12 my-4", alignClass, field.width)}>
      {cfg.showBar && cfg.barPosition === "above" && (
        <hr className="mb-2 border-border" />
      )}
      {field.label && (
        <h2
          className="text-lg font-semibold text-foreground"
          style={{
            textTransform: cfg.textDecoration === "none" ? undefined : cfg.textDecoration,
            borderBottom: cfg.showBar && cfg.barPosition === "between" ? "1px solid hsl(var(--border))" : "none",
            paddingBottom: cfg.showBar && cfg.barPosition === "between" ? "0.5rem" : undefined,
            marginBottom: "0.25rem",
          }}
        >
          {field.label}
        </h2>
      )}
      {field.info && (
        <ProseContent
          text={field.info}
          className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none mt-1"
        />
      )}
      {cfg.showBar && cfg.barPosition === "below" && (
        <hr className="mt-2 border-border" />
      )}
    </div>
  );
}

/**
 * Bloc de description de section (tpls.forms.sectionDescription)
 * Affiche un label optionnel + texte de description.
 * N'enregistre aucune valeur dans react-hook-form.
 */
export function SectionDescriptionField({ field }: { field: FormFieldMapping }) {
  return (
    <div className={cn("col-span-12 my-1", field.width)}>
      {field.label && (
        <ProseContent
          text={field.label}
          forceMarkdown
          className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none mb-1"
        />
      )}
      {field.info && (
        <ProseContent
          text={field.info}
          forceMarkdown
          className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
        />
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
      {field.label && (
        <Label className="text-sm font-medium text-foreground">
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {field.info && <HintText text={field.info} />}
      
      <RadioGroup
        value={selectedValue}
        onValueChange={onChange}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${field.name}-error` : undefined}
        aria-required={field.isRequired || undefined}
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

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
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
      {field.label && (
        <Label className="text-sm font-medium text-foreground">
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {field.info && <HintText text={field.info} />}

      <div
        role="group"
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${field.name}-error` : undefined}
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

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}
