import { createContext, useContext } from "react";
import { CoFormContext } from "./CoFormContext";

/**
 * La clé de l'étape dont un rendu montre les questions (`aapStep1`, l'`id` d'une étape de formulaire),
 * posée par les rendus qui en montrent PLUSIEURS à la fois (`DynamicCoForm`, `CoFormReadOnly`). C'est
 * elle qui distingue deux questions de même clé dans deux étapes.
 */
export const FormStepKeyContext = createContext<string | null>(null);

/**
 * L'étape de la question rendue ici : celle que pose son rendu, sinon l'étape courante du formulaire
 * par étapes (`CoFormContext`), sinon `null` — la clé de la question suffit alors.
 */
export function useFormStepKey(): string | null {
  const posee = useContext(FormStepKeyContext);
  const parEtapes = useContext(CoFormContext).currentSubFormId;
  return posee ?? parEtapes ?? null;
}
