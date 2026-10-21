import { Fragment } from "react";
import { segmenterCorrespondances } from "../../lib/searchDiscussions";

export interface SurligneProps {
  readonly texte: string;
  /** Les mots DÉJÀ repliés, tels que `motsDeRequete` les rend. Vide : rien n'est marqué. */
  readonly mots: readonly string[];
}

/**
 * Marque les correspondances d'une recherche à l'intérieur d'un libellé.
 *
 * **Ce n'est pas le contrat « marquer sans réduire »**, qui a été écarté : la liste est bel et
 * bien réduite, et le marquage n'est là que pour dire POURQUOI une rangée a été retenue. Cela
 * compte surtout quand la correspondance porte sur une étiquette voisine — un fil peut
 * remonter par son libellé de type sans que son titre contienne quoi que ce soit de la requête.
 *
 * **Jamais de HTML construit à la main.** Le découpage rend des segments, React les assemble :
 * il n'y a donc aucune chaîne de balisage à échapper, et une requête pleine de chevrons reste
 * du texte. Le découpage travaille sur le texte REPLIÉ mais rend les tranches du texte
 * d'origine — accents compris.
 */
export function Surligne({ texte, mots }: SurligneProps) {
  if (mots.length === 0) return <>{texte}</>;
  return (
    <>
      {segmenterCorrespondances(texte, mots).map((segment, index) => (
        <Fragment key={index}>
          {segment.marque
            ? <mark className="bg-primary/20 text-inherit rounded-[0.2em] px-px">{segment.texte}</mark>
            : segment.texte}
        </Fragment>
      ))}
    </>
  );
}
