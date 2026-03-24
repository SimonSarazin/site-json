import type { z } from "zod";
import { LOCALES } from "@/types/locale-schema";
import { Section } from "@/types/site-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Def = Record<string, any>;

function def(schema: z.ZodTypeAny): Def {
  return schema._def as Def;
}


export interface ResolvedType {
  innerSchema: z.ZodTypeAny;
  isOptional: boolean;
  defaultValue?: unknown;
}

export function resolveType(schema: z.ZodTypeAny): ResolvedType {
  let isOptional = false;
  let defaultValue: unknown;
  let current = schema;

  while (true) {
    const d = def(current);
    if (d.type === "optional") {
      isOptional = true;
      current = d.innerType;
    } else if (d.type === "default") {
      defaultValue = d.defaultValue;
      current = d.innerType;
    } else if (d.type === "nullable") {
      isOptional = true;
      current = d.innerType;
    } else {
      break;
    }
  }

  return { innerSchema: current, isOptional, defaultValue };
}


const LOCALE_SET = new Set<string>(LOCALES);

export function isLocalizedString(schema: z.ZodTypeAny): boolean {
  const d = def(schema);
  if (d.type !== "object") return false;
  const keys = Object.keys(d.shape);
  return keys.length > 0 && keys.every((k) => LOCALE_SET.has(k));
}


export function getUnionLiteralValues(
  schema: z.ZodTypeAny
): unknown[] | false {
  const d = def(schema);
  if (d.type !== "union") return false;
  const options = d.options as z.ZodTypeAny[] | undefined;
  if (!Array.isArray(options)) return false;
  if (!options.every((o) => def(o).type === "literal")) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return options.map((o) => (o as z.ZodLiteral<any>).value);
}


export type FieldKind =
  | "localizedString"
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "unionLiterals"
  | "array"
  | "object"
  | "unsupported";

export interface FieldInfo {
  kind: FieldKind;
  schema: z.ZodTypeAny;
  isOptional: boolean;
  defaultValue?: unknown;
  enumOptions?: string[];
  literalValues?: unknown[];
  elementSchema?: z.ZodTypeAny;
}

export function classifyField(rawSchema: z.ZodTypeAny): FieldInfo {
  const { innerSchema, isOptional, defaultValue } = resolveType(rawSchema);
  const t = def(innerSchema).type;

  if (isLocalizedString(innerSchema))
    return { kind: "localizedString", schema: innerSchema, isOptional, defaultValue };

  if (t === "string")
    return { kind: "string", schema: innerSchema, isOptional, defaultValue };
  if (t === "number")
    return { kind: "number", schema: innerSchema, isOptional, defaultValue };
  if (t === "boolean")
    return { kind: "boolean", schema: innerSchema, isOptional, defaultValue };

  if (t === "enum") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enumSchema = innerSchema as z.ZodEnum<any>;
    return {
      kind: "enum",
      schema: innerSchema,
      isOptional,
      defaultValue,
      enumOptions: enumSchema.options as string[],
    };
  }

  const litVals = getUnionLiteralValues(innerSchema);
  if (litVals)
    return {
      kind: "unionLiterals",
      schema: innerSchema,
      isOptional,
      defaultValue,
      literalValues: litVals,
    };

  if (t === "array")
    return {
      kind: "array",
      schema: innerSchema,
      isOptional,
      defaultValue,
      elementSchema: (innerSchema as z.ZodArray<z.ZodTypeAny>).element,
    };

  if (t === "object")
    return { kind: "object", schema: innerSchema, isOptional, defaultValue };

  return { kind: "unsupported", schema: innerSchema, isOptional, defaultValue };
}


const schemaMap = new Map<string, z.ZodTypeAny>(
  Section.options.map((opt: z.ZodTypeAny) => {
    const d = def(opt);
    const typeVal = (d.shape.type as z.ZodLiteral<string>).value;
    return [typeVal, d.shape.props as z.ZodTypeAny] as const;
  })
);

export function getSectionPropsSchema(
  sectionType: string
): z.ZodTypeAny | null {
  return schemaMap.get(sectionType) ?? null;
}


export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}


export function createDefaultValue(schema: z.ZodTypeAny): unknown {
  const { innerSchema, defaultValue } = resolveType(schema);
  if (defaultValue !== undefined) return defaultValue;

  const d = def(innerSchema);
  const t = d.type;

  if (isLocalizedString(innerSchema)) return { fr: "" };
  if (t === "string") return "";
  if (t === "number") return 0;
  if (t === "boolean") return false;
  if (t === "enum") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enumSchema = innerSchema as z.ZodEnum<any>;
    return (enumSchema.options as string[])[0];
  }
  if (t === "array") return [];

  if (t === "object") {
    const shape = d.shape as Record<string, z.ZodTypeAny>;
    const obj: Record<string, unknown> = {};
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const { isOptional } = resolveType(fieldSchema);
      if (!isOptional) {
        obj[key] = createDefaultValue(fieldSchema);
      }
    }
    return obj;
  }

  return undefined;
}
