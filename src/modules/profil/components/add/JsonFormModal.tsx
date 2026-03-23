import { useState, useMemo, createElement, type ComponentType } from "react";
import { useForm } from "react-hook-form";
import * as LucideIcons from "lucide-react";
import { ChevronLeft, ChevronRight, Check, X, ChevronsUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import type { ModalProps } from "./ModalRegistry";
import type { JsonFormModalField, JsonFormModalStep } from "@/types/site-schema";
import type { LocalizedString } from "@/types/locale-schema";
import { cn } from "@/lib/utils";
import { useLocalization } from "@/hooks/useLocalization";
import { toast } from "sonner";

const lucideIconCache = new Map<string, ComponentType<{ className?: string }> | null>();

function getLucideIcon(name?: string): ComponentType<{ className?: string }> | null {
  if (!name) return null;
  if (lucideIconCache.has(name)) return lucideIconCache.get(name)!;
  const key = name.charAt(0).toUpperCase() + name.slice(1).replace(/-./g, (x) => x[1].toUpperCase());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const icon = (LucideIcons as any as Record<string, ComponentType<{ className?: string }>>)[key] || null;
  lucideIconCache.set(name, icon);
  return icon;
}

function FieldRenderer({
  field,
  value,
  onChange,
  t,
}: {
  field: JsonFormModalField;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (val: any) => void;
  t: (v: LocalizedString) => string;
}) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          placeholder={field.placeholder ? t(field.placeholder) : ""}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[100px]"
        />
      );

    case "select":
      return (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue
              placeholder={field.placeholder ? t(field.placeholder) : `${t(field.label)}...`}
            />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multiselect": {
      const selected: string[] = Array.isArray(value) ? value : [];
      const toggleOption = (optValue: string) => {
        if (selected.includes(optValue)) {
          onChange(selected.filter((v) => v !== optValue));
        } else {
          onChange([...selected, optValue]);
        }
      };
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal h-auto min-h-10"
            >
              <div className="flex flex-wrap gap-1 flex-1 text-left">
                {selected.length > 0 ? (
                  selected.map((val) => {
                    const opt = field.options?.find((o) => o.value === val);
                    return (
                      <Badge key={val} variant="secondary" className="text-xs">
                        {opt ? t(opt.label) : val}
                        <span
                          role="button"
                          tabIndex={0}
                          className="ml-1 hover:text-destructive cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(selected.filter((v) => v !== val));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              onChange(selected.filter((v) => v !== val));
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-muted-foreground">
                    {field.placeholder ? t(field.placeholder) : `${t(field.label)}...`}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-2" align="start">
            <div className="max-h-60 overflow-y-auto space-y-1">
              {field.options?.map((opt) => {
                const isChecked = selected.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent",
                      isChecked && "bg-accent"
                    )}
                    onClick={() => toggleOption(opt.value)}
                  >
                    <Checkbox checked={isChecked} className="pointer-events-none" />
                    <span className="text-sm">{t(opt.label)}</span>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    case "checkbox":
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
          <Label className="text-sm">{t(field.label)}</Label>
        </div>
      );

    case "radio":
      return (
        <RadioGroup value={value || ""} onValueChange={onChange}>
          {field.options?.map((opt) => (
            <div key={opt.value} className="flex items-center space-x-2">
              <RadioGroupItem value={opt.value} id={`${field.name}-${opt.value}`} />
              <Label htmlFor={`${field.name}-${opt.value}`} className="text-sm">
                {t(opt.label)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "file":
      return (
        <Input
          type="file"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      );

    default:
      return (
        <Input
          type={field.type || "text"}
          placeholder={field.placeholder ? t(field.placeholder) : ""}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function StepIndicator({
  steps,
  currentStep,
  t,
}: {
  steps: JsonFormModalStep[];
  currentStep: number;
  t: (v: LocalizedString) => string;
}) {
  return (
    <div className="py-4 px-4">
      <div className="flex items-start justify-center">
        {steps.map((step, index) => {
          const StepIcon = getLucideIcon(step.icon);
          return (
            <div key={index} className="flex items-center">
              <div className="flex flex-col items-center" style={{ width: "100px" }}>
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                    currentStep > index + 1
                      ? "bg-primary border-primary text-primary-foreground"
                      : currentStep === index + 1
                        ? "border-primary text-primary"
                        : "border-muted text-muted-foreground"
                  )}
                >
                  {currentStep > index + 1 ? (
                    <Check className="h-5 w-5" />
                  ) : StepIcon ? (
                    <StepIcon className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-2 text-xs font-medium text-center",
                    currentStep >= index + 1 ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {t(step.title)}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-12 -mt-6",
                    currentStep > index + 1 ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderLucideIcon(name?: string, className?: string) {
  const Icon = getLucideIcon(name);
  if (!Icon) return null;
  return createElement(Icon, { className });
}

export function JsonFormModal({ open, onOpenChange, formConfig }: ModalProps) {
  const { t } = useLocalization();
  const [currentStep, setCurrentStep] = useState(1);

  const hasStepper = !!formConfig?.steps && formConfig.steps.length > 0;
  const steps = useMemo(() => formConfig?.steps || [], [formConfig?.steps]);
  const totalSteps = hasStepper ? steps.length : 1;

  const allFields = useMemo(() => {
    if (!formConfig) return [];
    if (hasStepper) {
      return steps.flatMap((s) => s.fields);
    }
    return formConfig.fields || [];
  }, [formConfig, hasStepper, steps]);

  const defaultValues = useMemo(() => {
    const vals: Record<string, unknown> = {};
    for (const f of allFields) {
      if (f.type === "checkbox") vals[f.name] = false;
      else if (f.type === "multiselect") vals[f.name] = [];
      else vals[f.name] = "";
    }
    return vals;
  }, [allFields]);

  const form = useForm({ defaultValues });

  if (!formConfig) return null;

  const currentFields = hasStepper ? steps[currentStep - 1]?.fields || [] : formConfig.fields || [];
  const currentStepConfig = hasStepper ? steps[currentStep - 1] : null;

  const hasLocationField = currentFields.some((f) => f.type === "location");

  const handleClose = () => {
    form.reset();
    setCurrentStep(1);
    onOpenChange(false);
  };

  const validateCurrentStep = (): boolean => {
    const errors: string[] = [];
    for (const field of currentFields) {
      if (field.type === "location") continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = form.getValues(field.name) as any;
      if (field.required) {
        const isEmpty = Array.isArray(value) ? value.length === 0 : (!value || value === "");
        if (isEmpty) {
          errors.push(`${t(field.label)} est requis`);
        }
      }
      if (field.validation && value) {
        if (field.validation === "email") {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push("Adresse e-mail invalide");
          }
        } else if (field.validation === "tel") {
          if (!/^[\d\s()+-]+$/.test(value)) {
            errors.push("Numéro de téléphone invalide");
          }
        } else {
          try {
            if (!new RegExp(field.validation).test(value)) {
              errors.push(`Format invalide pour ${t(field.label)}`);
            }
          } catch { /* ignore invalid regex */ }
        }
      }
    }
    if (errors.length > 0) {
      toast.error("Erreurs de validation", { description: errors.join(", ") });
      return false;
    }
    return true;
  };

  const goToNextStep = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const _submitViaFetch = async (data: Record<string, unknown>) => {
    if (!formConfig.action) throw new Error("No action URL configured");
    const response = await fetch(formConfig.action, {
      method: formConfig.method || "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("Erreur serveur");
    }
  };
  void _submitViaFetch;

  const onSubmit = async (data: Record<string, unknown>) => {
    console.log(data)
  };

  const renderFields = (fields: JsonFormModalField[]) => (
    <div className="space-y-4">
      {fields.map((field) => {
        if (field.type === "location") {
          return <EditLocationTab key={field.name} form={form} />;
        }
        if (field.type === "checkbox") {
          return (
            <FormField
              key={field.name}
              control={form.control}
              name={field.name}
              render={({ field: formField }) => (
                <FormItem>
                  <FormControl>
                    <FieldRenderer
                      field={field}
                      value={formField.value}
                      onChange={formField.onChange}
                      t={t}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          );
        }
        return (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {t(field.label)}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <FieldRenderer
                    field={field}
                    value={formField.value}
                    onChange={formField.onChange}
                    t={t}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {renderLucideIcon(formConfig.icon, "h-5 w-5")}
            {t(formConfig.title)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t(formConfig.title)}
          </DialogDescription>
        </DialogHeader>

        {hasStepper && (
          <StepIndicator steps={steps} currentStep={currentStep} t={t} />
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-1 py-4">
              {currentStepConfig && (
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold">{t(currentStepConfig.title)}</h3>
                  {currentStepConfig.description && (
                    <p className="text-sm text-muted-foreground">{t(currentStepConfig.description)}</p>
                  )}
                </div>
              )}

              {hasLocationField
                ? renderFields(currentFields)
                : renderFields(currentFields)
              }
            </div>

            <DialogFooter className="mt-6 pt-4 border-t border-border flex-row justify-between">
              <div>
                {hasStepper && currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPreviousStep}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Précédent
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                >
                  Annuler
                </Button>
                {hasStepper && currentStep < totalSteps && (
                  <Button type="button" onClick={goToNextStep}>
                    Suivant
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
