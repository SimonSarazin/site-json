import z from "zod";

/**
 * Où lire chaque rôle de la carte dans une réponse CoForm : `<étape>.<id>`,
 * SANS le préfixe `answers.` (ajouté à la requête).
 */
export const AmpliPathSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    address: z.string().min(1),
    image: z.string().optional(),
    finder: z.string().optional(),
    tags: z.string().optional(),
});

export type AmpliPath = z.infer<typeof AmpliPathSchema>;

/** Chaîne non vide après `trim`, sinon `undefined` — jamais d'échec. */
const softString = z.string().trim().min(1).optional().catch(undefined);

/**
 * Tags d'une entrée. Tableau en temps normal, mais un tableau PHP à trous
 * (après un `unset`) revient sérialisé en OBJET : on en prend les valeurs, plutôt
 * que de rejeter l'ampli entier pour une liste de tags mal formée.
 */
const tagList = z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .transform((raw) => {
        const values = Array.isArray(raw) ? raw : Object.values(raw);
        const tags = values
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim())
            .filter((tag) => tag !== "");
        return [...new Set(tags)];
    })
    .optional()
    .catch(undefined);

/**
 * Une entrée `costum.ampli.<slug>` telle que Co la stocke.
 *
 * Donnée BACKEND, lue avec `safeParse` : seul `path` est bloquant (sans lui,
 * aucune section ne sait quoi afficher). Les autres champs se dégradent — un
 * `coform` absent ou qui n'est pas un ObjectId donne un ampli LISTÉ mais « non
 * configuré », plutôt qu'un ampli qui disparaît sans explication.
 */
export const CostumAmpliEntrySchema = z.object({
    slug: softString,
    name: softString,
    description: softString,
    tags: tagList,
    coform: z.string().regex(/^[0-9a-f]{24}$/i).optional().catch(undefined),
    path: AmpliPathSchema,
});

export type CostumAmpliEntry = z.infer<typeof CostumAmpliEntrySchema>;
