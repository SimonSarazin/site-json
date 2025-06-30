import { z } from "zod";

/*───────────────────────────────────────────────────────────────*/
/* 1. Locales & textes                                           */
/*───────────────────────────────────────────────────────────────*/
export const LOCALES = ["fr", "en", "es", "de"] as const; // extensible
export type Locale = (typeof LOCALES)[number];

export const LocalizedString = z.record(z.enum(LOCALES), z.string().min(1));
export type LocalizedString = z.infer<typeof LocalizedString>;