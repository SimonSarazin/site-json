import { type ReactNode } from "react";
import { useCoFormCatalogs } from "../hooks/useCoFormCatalogs";
import { CommonTableCatalogsProvider } from "./CommonTableCatalogsProvider";

interface LoaderProps {
  /** Sans lui, AUCUN fetch — et donc aucune ligne de besoin issue des réponses. */
  formId: string | undefined;
  /** Cf. `collectCommonTableInputKeys`. Vide ⇒ aucun appel réseau. */
  inputKeys: string[];
  children: ReactNode;
}

/**
 * Charge les catalogues collaboratifs commonTable d'un formulaire et les pose dans
 * l'arbre — le geste que TOUTE surface montant un commonTable doit faire.
 *
 * Extrait de `SmartCoForm`, où il était inline : la page de réponse
 * (`CoFormAnswerPage`) monte `CoFormReadOnly` en direct, court-circuitant
 * `SmartCoForm`, et n'avait donc aucun catalogue. Symptôme : un tableau de besoins
 * VIDE alors que le legacy en affiche — parce que le legacy fusionne
 * `criteriasFromForms + criteriasFromAnswers` (`commonTableV2.php:50`) tandis que
 * React ne disposait que de la première source, souvent vide.
 *
 * Le fetch est mutualisé par React Query (même clé, même formulaire) : imbriquer
 * deux loaders ne déclenche qu'une requête.
 */
export function CommonTableCatalogsLoader({ formId, inputKeys, children }: LoaderProps) {
  const { catalogs } = useCoFormCatalogs({
    formId: formId ?? "",
    inputKeys,
    enabled: !!formId && inputKeys.length > 0,
  });
  return <CommonTableCatalogsProvider catalogs={catalogs}>{children}</CommonTableCatalogsProvider>;
}
