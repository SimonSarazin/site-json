/**
 * Fusion A TROIS des listes de `card/update` sur un board-lien (BLUEPRINT §11,
 * protocole `card/update`) — pure, testee par `tests/unit/cardMerge.test.ts`.
 *
 * Le probleme : la modale de carte envoie la liste qu'elle a vue a l'OUVERTURE,
 * modifiee par la personne. Remplacer la liste en base par celle-la effacerait
 * ce que Kanban gestion, ou un autre onglet, a ecrit entre-temps : une
 * sous-tache ajoutee avec ses contributeurs et ses credits, une coche, un
 * assigne, un tag. Le client joint donc la BASE (la valeur vue a l'ouverture) a
 * la CIBLE (la valeur voulue), et l'on n'applique que la DIFFERENCE base ->
 * cible a la valeur ACTUELLE.
 *
 * Regles et vecteurs : `lib/__fixtures__/merge-cases.json`, COPIE des vecteurs
 * de co-kanban, rejoues aussi par le selftest du module PHP : c'est ce qui
 * garantit que le serveur et l'affichage optimiste de `updateCard` fusionnent
 * de la meme facon. Une correction d'un cote se reporte dans les trois copies.
 *
 * Copie de co-kanban, ou son backend factice importe ce fichier sous Node : d'ou
 * l'absence d'import par alias `@/` et l'extension `.ts` explicite, gardees ici
 * pour que les deux copies restent comparables ligne a ligne.
 */
import { phpLowercase } from './phpLowercase.ts';

/** Point de checklist tel que l'echange la modale : `id` nul = point neuf. */
export interface MergeChecklistItem {
  id: string | null;
  label: string;
  done: boolean;
}

/** Point fusionne : il a toujours un identifiant (celui d'origine, ou un neuf). */
export interface MergedChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

/**
 * Cle de comparaison d'un tag : bords retires, minuscules comme PHP. Retirer
 * « web » retire donc « Web », et ajouter « Agenda » ne double pas « agenda ».
 */
export function tagMergeKey(tag: string): string {
  return phpLowercase(tag.trim());
}

/**
 * Fusion d'un ENSEMBLE ordonne : les elements actuels non retires (dans leur
 * ordre), puis les ajouts absents de l'actuel (dans l'ordre de la cible).
 *
 * L'actuel n'est PAS dedoublonne : « Web » et « web » sont deux tags distincts
 * en base, et seule une demande explicite de la personne doit y toucher.
 */
function mergeOrderedSet(
  base: readonly string[],
  next: readonly string[],
  current: readonly string[],
  keyOf: (value: string) => string,
): string[] {
  const baseKeys = new Set(base.map(keyOf));
  const nextKeys = new Set(next.map(keyOf));
  const removed = new Set([...baseKeys].filter((key) => !nextKeys.has(key)));
  const present = new Set(current.map(keyOf));

  const merged = current.filter((value) => !removed.has(keyOf(value)));
  for (const value of next) {
    const key = keyOf(value);
    // Deja dans la base : ce n'est pas un ajout. Deja present (ecriture
    // concurrente identique, ou ajout en double dans la cible) : pas de doublon.
    if (baseKeys.has(key) || present.has(key)) continue;
    present.add(key);
    merged.push(value);
  }
  return merged;
}

/** Assignes : compares a l'identique (ce sont des ObjectId). */
export function mergeAssignees(
  base: readonly string[],
  next: readonly string[],
  current: readonly string[],
): string[] {
  return mergeOrderedSet(base, next, current, (value) => value);
}

/** Tags : compares par `tagMergeKey` ; la graphie gardee est celle de l'actuel, ou de la cible pour un ajout. */
export function mergeTags(base: readonly string[], next: readonly string[], current: readonly string[]): string[] {
  return mergeOrderedSet(base, next, current, tagMergeKey);
}

/**
 * Fabrique de l'identifiant d'un point AJOUTE. `taken` contient tous les
 * identifiants deja pris (actuels et ajouts precedents) : le resultat doit en
 * etre absent. Le serveur forge le sien ; l'optimiste du front garde celui du
 * client tant qu'il est libre.
 */
export type ChecklistIdFactory = (item: MergeChecklistItem, taken: ReadonlySet<string>) => string;

/**
 * Fusion d'une checklist, PAR IDENTIFIANT :
 *  - supprimes : ids de la base absents de la cible, retires de l'actuel ;
 *  - modifies : ids de la base ET de la cible ; seuls les champs (`label`,
 *    `done`) qui different ENTRE base et cible sont appliques au point actuel
 *    de meme id, s'il existe encore — sinon la suppression concurrente gagne ;
 *  - ajoutes : points de la cible sans id, ou d'id inconnu de la base, mis a
 *    la fin dans l'ordre de la cible.
 * L'ordre de l'actuel est conserve : un reordonnancement fait dans la modale
 * n'est pas applique (Kanban gestion ne range pas les sous-taches).
 */
export function mergeChecklist(
  base: readonly MergeChecklistItem[],
  next: readonly MergeChecklistItem[],
  current: readonly MergedChecklistItem[],
  newId: ChecklistIdFactory,
): MergedChecklistItem[] {
  const baseById = new Map<string, MergeChecklistItem>();
  for (const item of base) {
    if (item.id !== null && !baseById.has(item.id)) baseById.set(item.id, item);
  }

  const targetById = new Map<string, MergeChecklistItem>();
  const added: MergeChecklistItem[] = [];
  for (const item of next) {
    if (item.id !== null && baseById.has(item.id)) {
      // Un id de la base vu deux fois dans la cible : seule la premiere
      // occurrence compte, la seconde n'est pas un ajout deguise.
      if (!targetById.has(item.id)) targetById.set(item.id, item);
    } else {
      added.push(item);
    }
  }

  const merged: MergedChecklistItem[] = [];
  for (const item of current) {
    const before = baseById.get(item.id);
    if (before === undefined) {
      // Inconnu de la modale (ajoute ailleurs depuis l'ouverture) : intact.
      merged.push(item);
      continue;
    }
    const after = targetById.get(item.id);
    if (after === undefined) continue; // supprime dans la modale
    merged.push({
      id: item.id,
      label: after.label !== before.label ? after.label : item.label,
      done: after.done !== before.done ? after.done : item.done,
    });
  }

  const taken = new Set(current.map((item) => item.id));
  for (const item of added) {
    const id = newId(item, taken);
    taken.add(id);
    merged.push({ id, label: item.label, done: item.done });
  }
  return merged;
}
