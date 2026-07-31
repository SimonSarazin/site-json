import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolightOptional } from "@/hooks/useCocolight";
import "../i18n/i18n";
import { parseCoFormFields, normalizeAnswerData } from "../utils/formParser";
import { dayI18nKey, normalizeSlot, toTimeString } from "../utils/timeSlots";
import type { CoFormData, AllStepsData, SubFormFields, FormFieldMapping, FormFieldValue, MultiCheckboxPlusValue, MultiRadioValue, UploaderLegacyValue, SimpleTableValue, EvaluationValue, FinderValue, TimeSlotValue, DynamicFieldsRow } from "../types";
import { ReadOnlyUploaderGallery } from "./ReadOnlyUploaderGallery";
import { SimpleTableField } from "./SimpleTableField";
import { EvaluationField } from "./EvaluationField";
import { FinderField } from "./FinderField";

interface CoFormReadOnlyProps {
  formData: CoFormData;
  answerData: AllStepsData;
  authorName?: string;
  submittedAt?: number;
  updatedAt?: number;
  answerId?: string;
  className?: string;
  /** Masquer la bannière (mode standalone) */
  hideBanner?: boolean;
  /** Masquer les en-têtes d'étape / Card wrapper (mode input standalone) */
  hideStepHeaders?: boolean;
  /** Masquer les métadonnées (auteur, date) */
  hideMetadata?: boolean;
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
  answerId,
  className,
  hideBanner = false,
  hideStepHeaders = false,
  hideMetadata = false,
}: CoFormReadOnlyProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  // Variante optionnelle : le read-only peut être rendu hors CocolightProvider.
  // En lecture seule, on pré-remplit la contribution multi-eval de l'user
  // courant (`_multiEval.{id}`) ; sans user, le champ multi-eval reste vide.
  const currentUserId = useCocolightOptional()?.me?.id ?? null;

  const subFormsFields = useMemo(() => parseCoFormFields(formData), [formData]);

  // Normaliser les données de réponse (déplacer les champs root-level dans leurs subforms)
  const normalizedAnswers = useMemo(
    () => normalizeAnswerData(answerData, subFormsFields, currentUserId) as AllStepsData,
    [answerData, subFormsFields, currentUserId]
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
      // Si le timestamp a plus de 10 chiffres, il est déjà en millisecondes
      const ms = timestamp > 1e10 ? timestamp : timestamp * 1000;
      return new Date(ms).toLocaleDateString(undefined, {
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
      {!hideBanner && formData.useBannerImg && formData.profilBannerUrl ? (
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
      ) : !hideBanner && formData.name ? (
        <div className="w-full rounded-lg bg-linear-to-r from-primary/10 via-primary/5 to-background p-8 border">
          <h1 className="text-4xl font-bold text-foreground">
            {formData.name}
          </h1>
        </div>
      ) : null}

      {/* Métadonnées */}
      {!hideMetadata && (
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
      )}

      {/* Sections (une card par étape). `<dl>` parent obligatoire HTML5 pour
          que les `<dt>/<dd>` rendus par ReadOnlyField soient valides et lus
          correctement par les lecteurs d'écran. */}
      {subFormsFields.map((step) =>
        hideStepHeaders ? (
          <dl key={step.subFormId} className="grid grid-cols-12 gap-x-6 gap-y-4">
            {step.fields.map((field) => (
              <ReadOnlyField
                key={field.name}
                field={field}
                value={(normalizedAnswers[step.subFormId] ?? {})[field.name]}
                formId={formData.id}
                answerId={answerId}
                subFormId={step.subFormId}
              />
            ))}
          </dl>
        ) : (
          <ReadOnlySection
            key={step.subFormId}
            step={step}
            data={normalizedAnswers[step.subFormId] ?? {}}
            formId={formData.id}
            answerId={answerId}
          />
        )
      )}
    </div>
  );
}

// ─── Section lecture seule (une étape) ────────────────────────────

function ReadOnlySection({
  step,
  data,
  formId,
  answerId,
}: {
  step: SubFormFields;
  data: Record<string, FormFieldValue>;
  formId: string;
  answerId?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{step.subFormName}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* `<dl>` parent : oblige HTML5 pour les `<dt>/<dd>` enfants. */}
        <dl className="grid grid-cols-12 gap-x-6 gap-y-4">
          {step.fields.map((field) => (
            <ReadOnlyField
              key={field.name}
              field={field}
              value={data[field.name]}
              formId={formId}
              answerId={answerId}
              subFormId={step.subFormId}
            />
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ─── Champ lecture seule ──────────────────────────────────────────

function ReadOnlyField({
  field,
  value,
  formId,
  answerId,
  subFormId,
}: {
  field: FormFieldMapping;
  value: FormFieldValue;
  formId: string;
  answerId?: string;
  subFormId?: string;
}) {
  const widthClass = field.width ?? "col-span-12";

  // Rendu spécifique pour uploader
  const isUploader = field.componentType === "uploader";
  if (isUploader) {
    const uploaderValue = value as UploaderLegacyValue | undefined;
    const isEmpty = !uploaderValue || (
      typeof uploaderValue === "object" && "updateDate" in uploaderValue
        ? !uploaderValue.files || (Array.isArray(uploaderValue.files) ? uploaderValue.files.length === 0 : typeof uploaderValue.files === "object" && Object.keys(uploaderValue.files).length === 0)
        : Array.isArray(value) && (value as unknown[]).length === 0
    );
    const subKey = subFormId ? `${subFormId}.${field.name}` : field.name;
    return (
      <div className={cn(widthClass, "space-y-1.5")}>
        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {field.label}
        </dt>
        <dd>
          {isEmpty ? (
            <span className="text-muted-foreground/50 italic">—</span>
          ) : (
            <ReadOnlyUploaderGallery
              value={value}
              formId={formId}
              answerId={answerId}
              subKey={subKey}
            />
          )}
        </dd>
      </div>
    );
  }

  // Composants réutilisés en mode readOnly
  if (field.componentType === "simpleTable") {
    return (
      <div className={cn(widthClass, "space-y-1.5")}>
        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {field.label}
        </dt>
        <dd>
          <SimpleTableField field={field} errors={{}} value={value as SimpleTableValue} readOnly hideLabel />
        </dd>
      </div>
    );
  }

  if (field.componentType === "evaluation") {
    return (
      <div className={cn(widthClass, "space-y-1.5")}>
        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {field.label}
        </dt>
        <dd>
          <EvaluationField field={field} errors={{}} value={value as EvaluationValue} readOnly hideLabel />
        </dd>
      </div>
    );
  }

  if (field.componentType === "finder") {
    return (
      <div className={cn(widthClass, "space-y-1.5")}>
        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {field.label}
        </dt>
        <dd>
          <FinderField field={field} errors={{}} value={value as FinderValue} readOnly hideLabel />
        </dd>
      </div>
    );
  }

  if (field.componentType === "timeSlots") {
    return <ReadOnlyTimeSlots field={field} value={value} widthClass={widthClass} />;
  }

  if (field.componentType === "dynamicFields") {
    return <ReadOnlyDynamicFields field={field} value={value} widthClass={widthClass} />;
  }

  // Rendu spécifique pour les checkbox (tableaux)
  const isMultipleValues = Array.isArray(value);
  const isEmpty = value === null || value === undefined || value === "" || (isMultipleValues && value.length === 0);
  const isTextarea = field.componentType === "textarea";
  const isMultiCheckboxPlus = field.componentType === "multiCheckboxPlus";
  const isMultiRadio = field.componentType === "multiRadio";
  const isUrl = field.inputType === "url";

  // Extraire les données multiCheckboxPlus
  const multiCheckboxPlusData = isMultiCheckboxPlus && isMultipleValues 
    ? (value as unknown as MultiCheckboxPlusValue).map(item => {
        const key = Object.keys(item)[0];
        return key ? { label: key, ...item[key] } : null;
      }).filter(Boolean).sort((a, b) => (a?.rank ?? 0) - (b?.rank ?? 0))
    : null;

  // Extraire les données multiRadio
  const multiRadioData = isMultiRadio && value && typeof value === "object" && !Array.isArray(value)
    ? (value as unknown as MultiRadioValue)
    : null;
  const isMultiRadioEmpty = isMultiRadio && (!multiRadioData || !multiRadioData.value);

  return (
    <div className={cn(widthClass, "space-y-1.5")}>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {field.label}
      </dt>
      <dd className="text-sm text-foreground leading-relaxed">
        {(isEmpty || isMultiRadioEmpty) ? (
          <span className="text-muted-foreground/50 italic">—</span>
        ) : isMultiRadio && multiRadioData ? (
          <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/40">
            <div className="flex-1">
              <span className="font-medium">{multiRadioData.value}</span>
              {multiRadioData.textsup && (
                <p className="text-muted-foreground text-xs mt-0.5">
                  {multiRadioData.textsup}
                </p>
              )}
            </div>
          </div>
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
          <div className="prose prose-sm dark:prose-invert max-w-none [&>p:last-child]:mb-0 [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {String(value)}
            </ReactMarkdown>
          </div>
        ) : isUrl ? (
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 wrap-break-word hover:opacity-80 transition-opacity"
          >
            {String(value)}
          </a>
        ) : field.componentType === "select" ? (
          // Pour un select à options associatives legacy, la valeur stockée
          // est la clé ; on affiche le label via `optionLabels` (fallback sur
          // la valeur brute pour les options à liste plate où clé === label).
          <span className="wrap-break-word">
            {field.optionLabels?.[String(value)] ?? String(value)}
          </span>
        ) : (
          <span className="wrap-break-word">{String(value)}</span>
        )}
      </dd>
    </div>
  );
}

// ─── Lecture seule : créneaux horaires (timeSlots) ────────────────

function ReadOnlyTimeSlots({ field, value, widthClass }: { field: FormFieldMapping; value: FormFieldValue; widthClass: string }) {
  const t = useT("modules/coform");
  const slots = (Array.isArray(value) ? (value as TimeSlotValue[]) : []).map(normalizeSlot);
  return (
    <div className={cn(widthClass, "space-y-1.5")}>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {field.label}
      </dt>
      <dd className="text-sm text-foreground">
        {slots.length === 0 ? (
          <span className="text-muted-foreground/50 italic">—</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot, index) => (
              <Badge key={index} variant="secondary" className="font-normal text-xs px-2 py-0.5">
                {t(`coform.timeSlots.days.${dayI18nKey(slot.day)}`)}{" "}
                {toTimeString(slot.startHour, slot.startMinute)} – {toTimeString(slot.endHour, slot.endMinute)}
              </Badge>
            ))}
          </div>
        )}
      </dd>
    </div>
  );
}

// ─── Lecture seule : lignes dynamiques (dynamicFields) ────────────

function ReadOnlyDynamicFields({ field, value, widthClass }: { field: FormFieldMapping; value: FormFieldValue; widthClass: string }) {
  const rows = Array.isArray(value) ? (value as DynamicFieldsRow[]) : [];
  const subFields = field.dynamicFieldsConfig?.fieldsConfig ?? [];
  // Libellé + résolution des clés de select → label affiché (comme le select simple).
  const displayOf = (key: string, raw: string): string => {
    const sub = subFields.find((s) => s.key === key);
    return sub?.options?.[raw] ?? raw;
  };
  const labelOf = (key: string): string => subFields.find((s) => s.key === key)?.label ?? key;
  return (
    <div className={cn(widthClass, "space-y-1.5")}>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {field.label}
      </dt>
      <dd className="text-sm text-foreground">
        {rows.length === 0 ? (
          <span className="text-muted-foreground/50 italic">—</span>
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={index} className="rounded-md bg-muted/30 border border-border/40 p-2 space-y-0.5">
                {Object.entries(row)
                  .filter(([, raw]) => String(raw ?? "").trim() !== "")
                  .map(([key, raw]) => (
                    <p key={key} className="text-xs">
                      <span className="text-muted-foreground">{labelOf(key)} : </span>
                      <span className="font-medium">{displayOf(key, String(raw))}</span>
                    </p>
                  ))}
              </div>
            ))}
          </div>
        )}
      </dd>
    </div>
  );
}

export default CoFormReadOnly;
