import { useT } from "@/hooks/useT";
import { DiscussionPanel } from "../components/panel/DiscussionPanel";
import "../i18n";

/**
 * Page plein écran du panneau — route `/discussions`.
 *
 * Elle monte le MÊME composant que le panneau contextuel : les deux vues partagent donc
 * leurs colonnes, leurs clés de cache et leur lecture de l'URL. Il n'y a qu'une
 * implémentation à corriger si quelque chose cloche.
 *
 * ⚠️ On ne teste PAS la session pour choisir quoi rendre. Un `me?.id ? … : …` paraissait plus
 * accueillant, mais il produisait une **erreur d'hydratation** vue au navigateur : au rendu
 * serveur la session est absente, au rendu client elle est là, et les deux arbres divergent.
 * L'endpoint refusant déjà les appels non connectés, le message de connexion remonte
 * naturellement par l'erreur de la requête — un seul chemin, et aucun écart serveur/client.
 */
export default function DiscussionsPage() {
  const t = useT("modules/comment");

  return (
    // `100dvh` et non `100vh` : sur mobile, `vh` ignore la barre d'adresse rétractable et la
    // dernière ligne du fil passe sous elle. `min-h` évite qu'un écran très bas n'écrase le
    // panneau au point de ne plus rien montrer. `100rem` : à `max-w-7xl` (80rem), la colonne
    // du fil restait étroite sur un grand écran alors qu'il y avait la place.
    //
    // `h-dvh` et non `calc(100dvh - 8rem)` : cette page n'a ni en-tête ni pied de site (mesuré
    // le 28/09), les 8 rem réservés restaient vides. Et sous 48 rem, PLEIN ÉCRAN : marges et
    // bordure de carte coûtaient 58 px de large et ~176 px de haut sur un téléphone de 390 px.
    <main className="mx-auto flex h-dvh min-h-[28rem] w-full max-w-[100rem] flex-col gap-4 px-4 py-6 max-md:p-0">
      <h1 className="sr-only">{String(t("panel.title"))}</h1>
      <DiscussionPanel className="min-h-0 flex-1 max-md:rounded-none max-md:border-0" />
    </main>
  );
}
