import { useCallback, useState } from "react";

/**
 * Mémoire locale des écritures réussies d'un champ « écriture directe ».
 *
 * Quatre champs du coform — `chooseProposal`, `selection`, `pourContre`,
 * `aapEvaluation` — écrivent au serveur par chemin ciblé, sans passer par la
 * soumission du formulaire. Leur valeur AFFICHÉE, en revanche, vient de
 * l'instantané du formulaire : `stepState.stepsData` en mode wizard (un
 * `useState` initialisé UNE SEULE FOIS, jamais resynchronisé) ou la prop
 * `defaultValues` en mode simple. Après un enregistrement réussi, le champ
 * restait donc sur l'ancienne valeur — « j'ai cliqué, rien ne bouge ».
 *
 * ⚠️ **On ne corrige surtout pas ça en invalidant le cache depuis le
 * formulaire.** Un refetch de la réponse pendant que le formulaire est ouvert
 * n'apporte rien ici — l'instantané ne se resynchronise pas — et ferait dépendre
 * une saisie en cours d'un aller-retour réseau. Une donnée de formulaire n'a pas
 * à piloter le rafraîchissement de ce qui vit hors du formulaire : le champ garde
 * localement ce qu'il vient d'écrire, et ce qui est en dehors se rafraîchit sur
 * ses propres événements de bord (fermeture de modale, `onDone`…).
 *
 * Pourquoi accumuler plutôt que lire `mutation.variables` : un évaluateur note
 * PLUSIEURS critères à la suite, et `variables` ne retient que le dernier appel.
 * Une entrée par clé écrite est donc nécessaire.
 *
 * La mémoire vit le temps du montage. Au remontage, le serveur reprend la main —
 * c'est voulu : l'écriture locale n'est qu'un écho de ce qu'on vient d'envoyer,
 * jamais une source de vérité.
 */
export function useEcrituresLocales<T>() {
  const [ecrites, setEcrites] = useState<Record<string, T>>({});

  /** À appeler APRÈS un enregistrement réussi, jamais de façon optimiste. */
  const noter = useCallback((cle: string, valeur: T) => {
    setEcrites((prev) => ({ ...prev, [cle]: valeur }));
  }, []);

  /** Valeur à afficher : ce qu'on a écrit ici, sinon ce que porte le serveur. */
  const lire = useCallback(
    (cle: string, valeurServeur: T): T => (cle in ecrites ? ecrites[cle] : valeurServeur),
    [ecrites]
  );

  return { noter, lire };
}
