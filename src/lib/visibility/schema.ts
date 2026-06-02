import { z } from "zod";

/**
 * Condition de visibilité réutilisable pour les éléments UI déclarés en config.
 *
 * Toutes les clés sont optionnelles : une condition vide (ou absente) = "visible
 * pour tous". Les contraintes présentes sont ANDées entre elles.
 *
 * @example
 *   { auth: "required", excludeRoutes: ["/profil/*"], permissions: ["canAddOrganization"] }
 */
export const VisibilityConditionSchema = z.object({
  /**
   * `required` = visible uniquement si connecté.
   * `anonymous` = visible uniquement si NON connecté.
   * `any` (ou absent) = visible pour tous.
   */
  auth: z.enum(["required", "anonymous", "any"]).optional(),

  /**
   * Liste blanche de routes. Si fournie, l'élément n'apparaît QUE sur ces
   * routes. Supporte les wildcards (ex: "/profil/*" matche "/profil/abc").
   * "*" en fin de pattern = match préfixe sur le segment.
   */
  routes: z.array(z.string()).optional(),

  /**
   * Liste noire de routes (prioritaire sur `routes`). Même syntaxe wildcard.
   */
  excludeRoutes: z.array(z.string()).optional(),

  /**
   * Permissions à vérifier via `useUserPermissions(null)`. Toutes doivent être
   * `true` pour que l'élément soit visible. Ex: `["canAddOrganization"]`.
   */
  permissions: z.array(z.string()).optional(),
}).optional();

export type VisibilityCondition = z.infer<typeof VisibilityConditionSchema>;
