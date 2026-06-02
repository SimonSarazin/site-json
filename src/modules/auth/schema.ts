import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

//──────────────── Sections auth (rendues via SectionRenderer, usage config custom)

export const LoginFormSectionSchema = z.object({
  type: z.literal("loginForm"),
  id: z.string().optional(),
  props: z.object({}),
});
export type LoginFormSection = z.infer<typeof LoginFormSectionSchema>;
export type LoginFormSectionProps = z.infer<typeof LoginFormSectionSchema>["props"];

export const RegisterFormSectionSchema = z.object({
  type: z.literal("registerForm"),
  id: z.string().optional(),
  props: z.object({}),
});
export type RegisterFormSection = z.infer<typeof RegisterFormSectionSchema>;
export type RegisterFormSectionProps = z.infer<typeof RegisterFormSectionSchema>["props"];

export const RecoverPasswordFormSectionSchema = z.object({
  type: z.literal("recoverPasswordForm"),
  id: z.string().optional(),
  props: z.object({}),
});
export type RecoverPasswordFormSection = z.infer<typeof RecoverPasswordFormSectionSchema>;
export type RecoverPasswordFormSectionProps = z.infer<typeof RecoverPasswordFormSectionSchema>["props"];

//──────────────── Config auth du site (section "auth")

const AuthPageTextSchema = z.object({
  title: LocalizedString.optional(),
  subtitle: LocalizedString.optional(),
});

export const AuthConfigSchema = z.object({
  // Variant de design résolu par `resolveAuthVariant` (registry). Absent → "default".
  variant: z.string().optional(),
  // Layout des pages auth (mode page /login /register /recover-password) :
  // affichage conditionnel du header / footer, comme `hideHeader` des pages.
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
  // Textes (titre / sous-titre) par page auth ; le sous-titre sert aussi de
  // description SEO (cf. AuthSeo).
  login: AuthPageTextSchema.optional(),
  register: AuthPageTextSchema.optional(),
  recover: AuthPageTextSchema.optional(),
});
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
