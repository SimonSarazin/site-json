import { useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextField, TextAreaField, RadioField, CheckboxField } from "./FormFields";
import { MultiCheckboxPlusField } from "./MultiCheckboxPlusField";
import { EvaluationField } from "./EvaluationField";
import { FinderField } from "./FinderField";
import type { CoFormData, SubFormData, AddedOptionsMap, EvaluationValue, FinderValue } from "../types";
import { parseCoFormFields, generateZodSchema, generateDefaultValues } from "../utils/formParser";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

import "../i18n/i18n";

interface DynamicCoFormProps {
  formData: CoFormData;
  onSubmit: (data: SubFormData, addedOptions?: AddedOptionsMap) => void | Promise<void>;
  submitButtonText?: string;
  isLoading?: boolean;
  /** Valeurs par défaut pour pré-remplir le formulaire (mode édition) */
  defaultValues?: SubFormData;
}

/**
 * Composant principal pour afficher un formulaire CoForm dynamique
 * Gère automatiquement la validation Zod et l'intégration react-hook-form
 */
export function DynamicCoForm({
  formData,
  onSubmit,
  submitButtonText,
  isLoading = false,
  defaultValues: externalDefaults,
}: DynamicCoFormProps) {
  const t = useT("modules/coform");
  useLoadNamespace("modules/coform");

  const resolvedSubmitText = submitButtonText ?? t("coform.navigation.submit");
  const subFormsFields = parseCoFormFields(formData);
  const zodSchema = generateZodSchema(subFormsFields);
  const generatedDefaults = generateDefaultValues(subFormsFields);

  // Fusionner : valeurs externes (mode édition) écrasent les défauts générés
  const defaultValues = externalDefaults
    ? { ...generatedDefaults, ...externalDefaults }
    : generatedDefaults;

  type FormValues = z.infer<typeof zodSchema>;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // State pour collecter les options ajoutées par champ
  const [addedOptionsMap, setAddedOptionsMap] = useState<AddedOptionsMap>({});

  // Callback pour mettre à jour les options ajoutées d'un champ
  const handleAddedOptionsChange = useCallback((fieldName: string, addedOptions: string[]) => {
    setAddedOptionsMap(prev => ({
      ...prev,
      [fieldName]: addedOptions,
    }));
  }, []);

  const handleFormSubmit = async (data: FormValues) => {
    // Inclure les options ajoutées si il y en a
    const hasAddedOptions = Object.keys(addedOptionsMap).some(k => addedOptionsMap[k].length > 0);
    await onSubmit(data as SubFormData, hasAddedOptions ? addedOptionsMap : undefined);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Bannière du formulaire avec titre en overlay */}
      {formData.useBannerImg && formData.profilBannerUrl ? (
        <div className="relative w-full overflow-hidden rounded-lg">
          <img
            src={formData.profilBannerUrl}
            alt={t("coform.banner.alt")}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
          {formData.name && (
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                {formData.name}
              </h1>
            </div>
          )}
        </div>
      ) : formData.name ? (
        <div className="w-full rounded-lg bg-linear-to-r from-primary/10 via-primary/5 to-background p-8 border">
          <h1 className="text-4xl font-bold text-foreground">
            {formData.name}
          </h1>
        </div>
      ) : null}

      {subFormsFields.map((subForm) => (
        <Card key={subForm.subFormId} className="shadow-sm">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl">{subForm.subFormName}</CardTitle>
            {formData.inputs?.[subForm.subFormId]?.info && (
              <CardDescription className="text-base">
                {formData.inputs[subForm.subFormId].info}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-6">
              {subForm.fields.map((field) => {
                // Rendu conditionnel selon le type de champ
                switch (field.componentType) {
                case "text":
                  return (
                    <TextField
                      key={field.name}
                      field={field}
                      register={register}
                      errors={errors}
                    />
                  );

                case "textarea":
                  if (field.markdown) {
                    return (
                      <Controller
                        key={field.name}
                        name={field.name}
                        control={control}
                        render={({ field: controllerField }) => (
                          <TextAreaField
                            field={field}
                            errors={errors}
                            value={controllerField.value}
                            onChange={controllerField.onChange}
                          />
                        )}
                      />
                    );
                  }
                  return (
                    <TextAreaField
                      key={field.name}
                      field={field}
                      register={register}
                      errors={errors}
                    />
                  );

                case "radio":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <RadioField
                          field={field}
                          register={register}
                          errors={errors}
                          value={controllerField.value}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "checkbox":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <CheckboxField
                          field={field}
                          errors={errors}
                          value={controllerField.value}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "multiCheckboxPlus":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <MultiCheckboxPlusField
                          field={field}
                          errors={errors}
                          value={controllerField.value as import("../types").MultiCheckboxPlusValue}
                          onChange={controllerField.onChange}
                          onAddedOptionsChange={(opts) => handleAddedOptionsChange(field.name, opts)}
                        />
                      )}
                    />
                  );

                case "evaluation":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <EvaluationField
                          field={field}
                          errors={errors}
                          value={controllerField.value as EvaluationValue}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "finder":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <FinderField
                          field={field}
                          errors={errors}
                          value={controllerField.value as FinderValue}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                default:
                  return (
                    <TextField
                      key={field.name}
                      field={field}
                      register={register}
                      errors={errors}
                    />
                  );
              }
            })}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end pt-4">
        <Button 
          type="submit" 
          disabled={isSubmitting || isLoading}
          size="lg"
          className="gap-2 min-w-40"
        >
          {isSubmitting || isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t("coform.status.submitting")}
            </>
          ) : (
            <>
              {resolvedSubmitText}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
