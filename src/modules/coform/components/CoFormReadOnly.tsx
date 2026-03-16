import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n";
import { parseCoFormFields, normalizeAnswerData } from "../utils/formParser";
import type { CoFormData, AllStepsData, SubFormFields, FormFieldMapping, FormFieldValue, MultiCheckboxPlusValue } from "../types";

interface CoFormReadOnlyProps {
  formData: CoFormData;
  answerData: AllStepsData;
  authorName?: string;
  submittedAt?: number;
  updatedAt?: number;
  className?: string;
}

/**
 * Composant d'affichage d'une réponse CoForm en mode lecture seule.
 * Affiche les réponses organisées par étape/section, avec les labels des champs.
 */
export function CoFormReadOnly({
  formData,
  answerData,
  authorName,
  submittedAt,
  updatedAt,
  className,
}: CoFormReadOnlyProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const subFormsFields = useMemo(() => parseCoFormFields(formData), [formData]);

  // Normaliser les données de réponse (déplacer les champs root-level dans leurs subforms)
  const normalizedAnswers = useMemo(
    () => normalizeAnswerData(answerData, subFormsFields) as AllStepsData,
    [answerData, subFormsFields]
  );

  if (!subFormsFields.length) {
    return (
      <div className="text-muted-foreground text-center py-8">
        {t("coform.errors.formNotFound")}
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp * 1000).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(timestamp);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Bannière du formulaire */}
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

      {/* Métadonnées */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {authorName && (
          <Badge variant="secondary" className="gap-1.5">
            {authorName}
          </Badge>
        )}
        {submittedAt && (
          <span>{t("coform.answer.submittedAt", undefined, { date: formatDate(submittedAt) })}</span>
        )}
        {updatedAt && updatedAt !== submittedAt && (
          <span className="text-xs">
            ({t("coform.answer.updatedAt", undefined, { date: formatDate(updatedAt) })})
          </span>
        )}
      </div>

      {/* Sections (une card par étape) */}
      {subFormsFields.map((step) => (
        <ReadOnlySection
          key={step.subFormId}
          step={step}
          data={normalizedAnswers[step.subFormId] ?? {}}
        />
      ))}
    </div>
  );
}

// ─── Section lecture seule (une étape) ────────────────────────────

function ReadOnlySection({
  step,
  data,
}: {
  step: SubFormFields;
  data: Record<string, FormFieldValue>;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{step.subFormName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-12 gap-x-6 gap-y-4">
          {step.fields.map((field) => (
            <ReadOnlyField
              key={field.name}
              field={field}
              value={data[field.name]}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Champ lecture seule ──────────────────────────────────────────

function ReadOnlyField({
  field,
  value,
}: {
  field: FormFieldMapping;
  value: FormFieldValue;
}) {
  const widthClass = field.width ?? "col-span-12";

  // Rendu spécifique pour les checkbox (tableaux)
  const isMultipleValues = Array.isArray(value);
  const isEmpty = value === null || value === undefined || value === "" || (isMultipleValues && value.length === 0);
  const isTextarea = field.componentType === "textarea";
  const isMultiCheckboxPlus = field.componentType === "multiCheckboxPlus";

  // Extraire les données multiCheckboxPlus
  const multiCheckboxPlusData = isMultiCheckboxPlus && isMultipleValues 
    ? (value as unknown as MultiCheckboxPlusValue).map(item => {
        const key = Object.keys(item)[0];
        return key ? { label: key, ...item[key] } : null;
      }).filter(Boolean).sort((a, b) => (a?.rank ?? 0) - (b?.rank ?? 0))
    : null;

  return (
    <div className={cn(widthClass, "space-y-1.5")}>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {field.label}
      </dt>
      <dd className="text-sm text-foreground leading-relaxed">
        {isEmpty ? (
          <span className="text-muted-foreground/50 italic">—</span>
        ) : isMultiCheckboxPlus && multiCheckboxPlusData ? (
          <div className="space-y-2">
            {multiCheckboxPlusData.map((opt, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/40"
              >
                {/* Badge de rang si activé */}
                {opt?.rank && field.multiCheckboxPlusConfig?.rank && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    #{opt.rank}
                  </Badge>
                )}
                <div className="flex-1">
                  <span className="font-medium">{opt?.label}</span>
                  {/* Texte supplémentaire si présent */}
                  {opt?.textsup && (
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {opt.textsup}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : isMultipleValues ? (
          <div className="flex flex-wrap gap-1.5">
            {value.filter(Boolean).map((item, idx) => (
              <Badge 
                key={idx} 
                variant="secondary" 
                className="font-normal text-xs px-2 py-0.5"
              >
                {String(item)}
              </Badge>
            ))}
          </div>
        ) : typeof value === "boolean" ? (
          <Badge variant={value ? "default" : "outline"} className="font-normal text-xs">
            {value ? "Oui" : "Non"}
          </Badge>
        ) : isTextarea ? (
          <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg bg-muted/30 px-4 py-3 border border-border/40 [&>p:last-child]:mb-0 [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {String(value)}
            </ReactMarkdown>
          </div>
        ) : (
          <span>{String(value)}</span>
        )}
      </dd>
    </div>
  );
}
export default CoFormReadOnly;
