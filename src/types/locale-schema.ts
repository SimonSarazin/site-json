import { z } from "zod";

/*───────────────────────────────────────────────────────────────*/
/* 1. Locales & textes                                           */
/*───────────────────────────────────────────────────────────────*/
export const LOCALES = ["fr", "en", "es", "de"] as const; // extensible
export type Locale = (typeof LOCALES)[number];

// export const LocalizedString = z.record(z.enum(LOCALES), z.string().min(1));

export function createLocalizedStringSchema(defaultLang: Locale) {
  // 1) On génère dynamiquement un objet { fr: z.string().min(1).optional(), en: …, es: …, de: … }
  const shape = LOCALES.reduce((acc, locale) => {
    acc[locale] = z.string().min(1).optional();
    return acc;
  }, {} as Record<Locale, z.ZodOptional<z.ZodString>>);

  // 2) On en fait un objet Zod, qu'on rend “partiel”, puis on raffine
  return z
    .object(shape)
    .partial()  // ici, chaque clé est maintenant facultative
    .refine(obj => Boolean(obj[defaultLang]), {
      message: `Le libellé doit inclure la langue par défaut (${defaultLang})`,
      path: [defaultLang],
    });
}

export const LocalizedString = createLocalizedStringSchema("fr");
export type LocalizedString = z.infer<typeof LocalizedString>;