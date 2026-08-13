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

  /**
   * Sur une page de PROFIL : `own` = seulement le profil de l'utilisateur connecté, `other` = seulement
   * celui d'un tiers, `any` (ou absent) = les deux. Sans effet hors profil.
   *
   * Comble un écart de sémantique : `auth` et `permissions` sont évalués contre `me`, jamais contre le
   * profil consulté — une entrée « Référencer ma structure » conditionnée `auth:"required"` s'affichait
   * donc sur le profil de n'importe quel citoyen. Les ONGLETS savaient déjà l'exprimer
   * (`ProfileTabConditionSchema.userContext`) ; c'est la même clé, mêmes valeurs.
   */
  userContext: z.enum(["own", "other", "any"]).optional(),
}).optional();

export type VisibilityCondition = z.infer<typeof VisibilityConditionSchema>;
