import getValueByPath from "@/helpers/getValueByPath";

/**
 * Compteurs de l'encart « Réserver en ligne » d'une fiche tiers-lieu (salles de réunion, postes de
 * travail, places d'hébergement) — une seule logique pour les trois.
 *
 * Ce que `type` décide, et c'est tout l'enjeu : on ne compte pas la même chose selon les cas. Le
 * défaut (`single`) additionne une CAPACITÉ saisie ; `answer` compte des OFFRES — choisir `answer`
 * pour l'hébergement afficherait « 1 » sur un lieu qui déclare 10 places dans son unique offre.
 */
export type ModeDeComptage = "single" | "array" | "answer";

/** Ce qu'une config décrit pour un type de ressource (`roomPath`, `coworkingPath`, `bedRoomPath`). */
export interface CheminDeRessource {
  /** Identifiant du formulaire CoForm dont on lit les réponses. Sans lui, rien n'est compté. */
  id?: string;
  /** Chemin du champ à lire dans la réponse. Alias historiques : `roomPath`/`coworkPath`/`bedRoomPath`. */
  place?: string;
  type?: string;
  [autre: string]: string | undefined;
}

/** Une réponse CoForm, réduite à ce que le comptage lit. */
export interface ReponseComptable {
  serverData?: unknown;
}

/** Les réponses déjà chargées, groupées par formulaire (`useGetAnswersByFormsQuery`). */
export interface FormulaireAvecReponses {
  id: string;
  answers: ReadonlyArray<ReponseComptable>;
}

/** Chemin du champ : `place`, ou l'un des alias qu'on trouve encore dans les configs. */
function cheminDuChamp(conf: CheminDeRessource): string | undefined {
  return conf.place ?? conf.roomPath ?? conf.coworkPath ?? conf.bedRoomPath;
}

/** Valeur du champ dans une réponse (`serverData.answers.<chemin>`). */
function valeurDansReponse(reponse: ReponseComptable, chemin: string): unknown {
  const serveur = reponse.serverData as { answers?: unknown } | undefined;
  const reponses = serveur?.answers;
  if (!reponses || typeof reponses !== "object") return undefined;
  return getValueByPath(reponses as Record<string, unknown>, chemin);
}

/**
 * Nombre à afficher pour une ressource, selon le mode déclaré en config :
 *
 * | `type`             | compte                                                    |
 * |--------------------|-----------------------------------------------------------|
 * | `single` (défaut)  | la SOMME du champ numérique sur toutes les réponses       |
 * | `array`            | la somme des longueurs du tableau, moins 1 par réponse    |
 * | `answer`           | le NOMBRE DE RÉPONSES (des offres, pas une capacité)      |
 *
 * `0` dès qu'il manque l'identifiant de formulaire ou le chemin du champ : l'encart n'affiche la
 * ligne que si un compteur est non nul, une config incomplète ne montre donc rien plutôt qu'un faux.
 */
export function compteRessources(
  conf: CheminDeRessource | undefined,
  formulaires: ReadonlyArray<FormulaireAvecReponses> | undefined,
): number {
  if (!conf?.id) return 0;
  const chemin = cheminDuChamp(conf);
  if (!chemin) return 0;

  const reponses = formulaires?.find((f) => f.id === conf.id)?.answers ?? [];
  const mode = (conf.type ?? "single") as ModeDeComptage;

  if (mode === "answer") return reponses.length;

  return reponses.reduce((total, reponse) => {
    const valeur = valeurDansReponse(reponse, chemin);
    if (mode === "array") {
      // « moins 1 » : la première entrée du tableau est l'en-tête de la saisie, pas une ressource.
      return Array.isArray(valeur) ? total + Math.max(0, valeur.length - 1) : total;
    }
    const nombre = Number(valeur);
    return valeur !== null && valeur !== "" && valeur !== undefined && Number.isFinite(nombre)
      ? total + nombre
      : total;
  }, 0);
}
