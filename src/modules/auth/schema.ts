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

// Bloc « mot de passe oublié » : textes + MÉCANISME. Le défaut (mode absent) est "legacy" — le
// comportement de la PROD actuelle : le backend legacy régénère un mot de passe aléatoire et
// l'envoie par e-mail (SendEmailAction, en clair), SANS lien ni page de saisie. L'opt-in
// `mode:"node"` bascule sur le flux à CODE du backend Node : e-mail d'un lien /recover/:user/:code
// → page ResetPasswordPage → endpoint PASSWORD_RESET (Node uniquement, cf. cocolight-backend/docs/23
// étage C). À n'activer que sur un déploiement servi par le backend Node.
const AuthRecoverConfigSchema = AuthPageTextSchema.extend({
  mode: z.enum(["legacy", "node"]).optional(),
});
export type AuthRecoverConfig = z.infer<typeof AuthRecoverConfigSchema>;

// Présentation du widget de compte dans les headers (`AuthMenu`). Pilote la
// densité « selon les besoins » côté config ; le `tone`/variant restent couplés
// au design du header (props), pas ici.
const AuthMenuConfigSchema = z.object({
  density: z.enum(["compact", "normal"]).optional(),
  showName: z.boolean().optional(),
  showDropdownHeader: z.boolean().optional(),
  loginLabel: LocalizedString.optional(),
  // Entrée « Kanban » : lien (nouvel onglet) vers la vue actions de la plateforme
  // (`<serverUrl>/#@<costumSlug>.view.actions`). Opt-in ; réservé aux admins du costum —
  // gate : `isKanbanEntryVisible` (modules/admin/lib/adminEntry), indépendant de `config.admin`.
  kanban: z.boolean().optional(),
});
export type AuthMenuConfig = z.infer<typeof AuthMenuConfigSchema>;

export const AuthConfigSchema = z.object({
  // Variant de design résolu par `resolveAuthVariant` (registry). Absent → "default".
  variant: z.string().optional(),
  // Présentation du widget de compte (densité compact/normal, libellé, etc.).
  menu: AuthMenuConfigSchema.optional(),
  // Layout des pages auth (mode page /login /register /recover-password) :
  // affichage conditionnel du header / footer, comme `hideHeader` des pages.
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
  // Textes (titre / sous-titre) par page auth ; le sous-titre sert aussi de
  // description SEO (cf. AuthSeo).
  login: AuthPageTextSchema.optional(),
  register: AuthPageTextSchema.optional(),
  // textes + `mode` du flux « mot de passe oublié » (défaut legacy, cf. AuthRecoverConfigSchema).
  recover: AuthRecoverConfigSchema.optional(),
});
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
