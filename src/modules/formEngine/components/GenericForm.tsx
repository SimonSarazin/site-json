/**
 * GenericForm — moteur de rendu d'un FormDescriptor (§8 du design).
 * RHF + zodResolver (Zod dérivé du descripteur), conditionnel réactif (champ caché = non rendu,
 * et non validé via zodGen), valeurs calculées (`computedFrom`), layout pluggable.
 *
 * RENDU + VALIDATION uniquement. Le READ (defaultValues) et le WRITE (save) sont fournis par
 * l'appelant domaine (cf. doc §6/§9) → `onSubmit(values)` rend les valeurs de form prêtes à mapper.
 */
import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useForm, type FieldValues, type Resolver, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";

import type { FormDescriptor, FormValues } from "../types";
import { buildZodSchema } from "../engine/zodGen";
import { check } from "../engine/conditional";
import { getCompute, applyTransform, resolveValidate } from "../engine/transforms";
import { getWidget } from "../widgets/registry";
import { getLayout, type LayoutProps } from "../layouts";

export interface GenericFormProps {
  descriptor: FormDescriptor;
  defaultValues: FieldValues;
  onSubmit: (values: FieldValues) => void | Promise<void>;
  /** Appelé au submit INVALIDE (validation échoue). Le moteur ne hardcode rien :
   *  l'appelant décide (ex. toast "corrigez les champs", cf. ancien form). */
  onInvalid?: () => void;
  t: (key: string) => string;
  submitLabel: string;
  submitting?: boolean;
  onCancel?: () => void;
  /** Rapporte l'état "dirty" (RHF `formState.isDirty`) au parent — garde de fermeture (modifs non enregistrées). */
  onDirtyChange?: (dirty: boolean) => void;
  /** options runtime par champ (ex. serverData.lists) — fallback sur `field.enum`. */
  listsOptions?: Record<string, string[]>;
  /** widgetProps runtime par champ (ex. `{ _imageFile: { existingUrl } }` en édition),
   *  fusionnés au `field.widgetProps` du descripteur — le descripteur restant statique. */
  fieldProps?: Record<string, Record<string, unknown>>;
  /** rendu des sections custom (`$slot:id`), ex. panneau doublons. */
  slots?: Record<string, ReactNode>;
  /** Schéma de validation EXTERNE (ex. `getProfileSchema(entityType)` existant) à utiliser à la place
   *  de celui dérivé du descripteur (zodGen). Le moteur y greffe quand même `descriptor.validate`
   *  (validation cross-champ). Utile pour réutiliser un schéma métier déjà écrit sans le re-déclarer. */
  schema?: z.ZodTypeAny;
  /** libellés de navigation (déjà traduits) — le moteur ne hardcode aucune clé i18n.
   *  `stepLabel(i, n)` → ex. « Étape 1 / 4 » (optionnel ; fallback « 1 / 4 »). */
  texts?: { next: string; previous: string; cancel: string; stepLabel?: (index: number, total: number) => string };
}

export function GenericForm(props: GenericFormProps) {
  const { descriptor, defaultValues, onSubmit, onInvalid, t, submitLabel, submitting, onCancel, listsOptions, fieldProps, slots } = props;
  const texts = props.texts ?? { next: "Next", previous: "Previous", cancel: "Cancel" };

  // Schéma : dérivé du descripteur (zodGen, qui inclut déjà descriptor.validate) OU externe fourni
  // (auquel cas on y greffe descriptor.validate pour conserver la validation cross-champ).
  const schema = useMemo(() => {
    if (!props.schema) return buildZodSchema(descriptor);
    const ext = props.schema;
    const validate = resolveValidate(descriptor.validate);
    return validate
      ? ext.superRefine((values, ctx) => {
          for (const issue of validate(values as FormValues))
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.path], message: issue.message });
        })
      : ext;
  }, [props.schema, descriptor]);
  // read : valeur serveur → valeur de form (pré-remplissage), par champ déclarant `read`.
  const seededDefaults = useMemo(() => {
    const hasRead = Object.values(descriptor.fields).some((f) => f.read);
    if (!hasRead) return defaultValues;
    const out: FieldValues = { ...defaultValues };
    for (const [name, field] of Object.entries(descriptor.fields)) {
      if (field.read) out[name] = applyTransform(field.read, out[name], out);
    }
    return out;
  }, [descriptor, defaultValues]);
  // cast : le schéma peut être externe (input `unknown`) ; le form est typé FieldValues (plat).
  const form = useForm<FieldValues>({ resolver: zodResolver(schema as never) as Resolver<FieldValues>, defaultValues: seededDefaults, mode: "onBlur" });

  // write : valeur de form → valeur de payload, par champ déclarant `write`, avant onSubmit.
  const submitWithWrites = (vals: FieldValues) => {
    const out: FieldValues = { ...vals };
    for (const [name, field] of Object.entries(descriptor.fields)) {
      if (field.write) out[name] = applyTransform(field.write, out[name], out);
    }
    return onSubmit(out);
  };

  const values = form.watch();

  // Rapporte l'état "dirty" au parent (garde « modifs non enregistrées » à la fermeture).
  const isDirty = form.formState.isDirty;
  useEffect(() => { props.onDirtyChange?.(isDirty); }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps
  // Au démontage (fermeture/submit réussi → modale fermée), on rapporte "propre" : évite qu'un dirty
  // résiduel survive dans la garde de l'hôte (fausse alerte à la réouverture si le form reste monté).
  useEffect(() => () => props.onDirtyChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Valeurs calculées (computedFrom) — recalcul quand les deps changent.
  const computedDepsKey = JSON.stringify(
    Object.values(descriptor.fields).flatMap((f) => f.computedFrom?.deps.map((d) => form.getValues(d)) ?? []),
  );
  useEffect(() => {
    for (const field of Object.values(descriptor.fields)) {
      const cf = field.computedFrom;
      if (!cf) continue;
      const fn = getCompute(cf.fn);
      if (!fn) continue;
      const next = fn(cf.deps.map((d) => form.getValues(d)));
      const cur = form.getValues(field.name);
      if (JSON.stringify(cur ?? null) !== JSON.stringify(next ?? null)) {
        form.setValue(field.name, next, { shouldDirty: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedDepsKey]);

  const renderField = (name: string): ReactNode => {
    const field = descriptor.fields[name];
    if (!field) return null;
    if (!check(field.visibleIf, values)) return null; // caché → ni rendu ni validé
    // options `{value,label}` : enum statique (value≠label, label traduit) sinon runtime string[]
    // (serverData.lists → value=label, gardé string[] + filtré comme getListOptions).
    const raw = listsOptions?.[field.optionsKey ?? name];
    const options = field.enum
      ? field.enum.map((e) => ({ value: e.value, label: t(e.label) }))
      : Array.isArray(raw)
        ? raw.filter((v): v is string => typeof v === "string").map((v) => ({ value: v, label: v }))
        : [];
    // widgetProps runtime par champ (ex. existingUrl en édition) fusionnés au descripteur statique.
    const fp = fieldProps?.[name];
    const fieldR = fp ? { ...field, widgetProps: { ...field.widgetProps, ...fp } } : field;
    const Widget = getWidget(field.widget);
    return <Widget field={fieldR} form={form as UseFormReturn<FieldValues>} t={t} options={options} />;
  };

  const renderSlot = (id: string): ReactNode => slots?.[id] ?? null;

  const Layout = getLayout(descriptor.layout.kind);
  const layoutProps: LayoutProps = {
    descriptor, form: form as UseFormReturn<FieldValues>, t, renderField, renderSlot, submitLabel, texts, submitting, onCancel,
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitWithWrites, onInvalid)} className="flex flex-1 flex-col min-h-0">
        <Suspense fallback={<div className="flex flex-1 items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <Layout {...layoutProps} />
        </Suspense>
      </form>
    </Form>
  );
}
