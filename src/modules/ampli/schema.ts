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
 * Donnée BACKEND, lue avec `safeParse` : AUCUN champ n'est bloquant. Une entrée
 * incomplète — celle qu'écrit l'outil legacy de Co, `{ name, description, tags,
 * pages, home }`, sans `coform` ni `path` — donne un ampli LISTÉ mais « non
 * configuré », jamais un ampli qui disparaît.
 *
 * Ce n'est pas qu'un confort d'affichage : une entrée écartée est invisible pour
 * la garde anti-collision de la création (`AmpliCreateDialog`), et le serveur
 * ÉCRASE sans prévenir une entrée dont le slug est déjà pris.
 */
export const CostumAmpliEntrySchema = z.object({
    slug: softString,
    name: softString,
    description: softString,
    tags: tagList,
    coform: z.string().regex(/^[0-9a-f]{24}$/i).optional().catch(undefined),
    /** Mapping des rôles de carte. Absent des entrées anciennes de Co. */
    path: AmpliPathSchema.optional().catch(undefined),
});

export type CostumAmpliEntry = z.infer<typeof CostumAmpliEntrySchema>;
