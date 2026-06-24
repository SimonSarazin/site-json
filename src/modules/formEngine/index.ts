/**
 * Module formEngine — moteur de formulaire générique (descriptor-driven).
 * cf. doc/moteur-formulaire-generique.md.
 */
export type {
  FormDescriptor, FieldDescriptor, SectionDescriptor, LayoutSpec,
  Predicate, PredicateOp, EnumOption, WidgetKind, FieldType, FormValues, FormCollection,
} from "./types";
export { GenericForm, type GenericFormProps } from "./components/GenericForm";
export { registerWidget, getWidget, type WidgetProps } from "./widgets/registry";
export { FormMessage, type FormMessageProps } from "./components/FormMessage";
export { registerLayout, getLayout, type LayoutProps } from "./layouts";
export { evaluatePredicate, check } from "./engine/conditional";
export { seedFromEntity, valuesToPayload, clearValue } from "./engine/fieldPipeline";
export { seedEntity, buildPayload, buildEditPayload, type FormSpec, type EntityLike } from "./engine/entityForm";
export { buildZodSchema } from "./engine/zodGen";
export { registerTransform, getTransform, applyTransform, registerCompute, getCompute,
  registerValidate, getValidate, resolveValidate, type ValidateFn } from "./engine/transforms";
// Coercions génériques (`coerce:*`) : ce ré-export exécute le module → ENREGISTRE les transforms au chargement.
export { coerceString, coerceNumber, coerceBool, coerceStringArray, coerceDateYMD } from "./engine/coercions";
export { JsonFormConfigSchema, configToDescriptor, formDescriptorToConfig, descriptorToTsSource, defaultWidgetForType, INPUT_TYPE_TO_WIDGET,
  mergeRenderPipeline, costumToConfig, descriptorToConfig, type CostumExtensionsArtifact,
  type JsonFormConfig, type JsonFormFieldConfig, type JsonFormLabel, type ConfigToDescriptorOpts } from "./config";
