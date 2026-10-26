import { createContext, type ReactNode } from "react";
import type { DepenseEntry } from "../utils/depense";

/**
 * Une ligne du champ « liste de dépenses » (`MilestoneListField`), telle que le FORMULAIRE la
 * tient : sa liste est locale, éditée avant d'être enregistrée. Une ligne peut ne pas exister
 * encore au document, et sa position ne dit rien de sa clé enregistrée — à qui s'en sert de le
 * vérifier (`resolveSavedDepenseKey`).
 */
export interface MilestoneLine {
  /** La réponse que le formulaire édite — absente tant qu'elle n'est pas enregistrée. */
  readonly answerId?: string;
  /** La clé de l'input dans le formulaire (`depense`), sans préfixe de type. */
  readonly fieldName: string;
  /**
   * La liste en cours de saisie, NORMALISÉE comme le champ l'affiche : une entrée qui n'est pas un
   * objet en est écartée. `index` s'y rapporte — pas au document.
   */
  readonly lines: readonly DepenseEntry[];
  /** La position de la ligne dans `lines`. */
  readonly index: number;
  /** L'intitulé de la ligne tel qu'on le lit dans le formulaire — pas forcément enregistré. */
  readonly name: string;
}

/**
 * Ce qu'un hôte pose dans l'en-tête de chaque ligne. `null` : rien pour celle-ci.
 *
 * Appelée comme une FONCTION pendant le rendu du champ, une fois par ligne affichée : pas de hook
 * dedans — elle rend un composant, qui porte les siens.
 */
export type MilestoneLineSlot = (line: MilestoneLine) => ReactNode;

/**
 * L'emplacement qu'un HÔTE du formulaire peut remplir sur chaque ligne de dépense — la fiche d'un
 * commun y pose le bouton de discussion du palier.
 *
 * Un contexte, pas une propriété : le champ est rendu par le moteur générique du formulaire, quatre
 * composants plus bas que celui qui sait quoi y mettre. Vide par défaut : le champ n'affiche alors
 * rien de plus, et ne sait rien de ce qu'on y poserait. Il se lit par `useMilestoneLineSlot`.
 */
export const MilestoneLineSlotContext = createContext<MilestoneLineSlot | null>(null);
