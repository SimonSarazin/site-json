import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { ProseContent } from "@/components/shared/ProseContent";
import { initiales } from "@/lib/initiales";
import { useResourceData } from "../../../hooks/useResourceData";
import { SearchCardProps } from "../../../schema";

/**
 * Design « portrait » de la card resource — une PERSONNE présentée EN ENTIER, en ligne d'annuaire : photo
 * ronde à gauche ; à droite le nom, la fonction (`subtitleField`) en petites capitales, puis la présentation
 * markdown (`descriptionField`) et ses liens. Les entrées sont séparées par un filet, sans cadre de carte.
 *
 * Choix assumés :
 *  - NON cliquable : tout est déjà affiché, une preview ne ferait que répéter le texte ; les seuls éléments
 *    interactifs sont les liens de la présentation ;
 *  - largeur portée par le design : entrée `max-w-5xl` centrée, texte sur toute la place à droite de la
 *    photo. Plus étroit (essayé : `max-w-3xl` + texte `max-w-prose`), une présentation de 2 000 caractères
 *    faisait ~400 px de haut en moyenne et l'écran ne montrait qu'une ou deux personnes ; plus large, les
 *    lignes deviendraient trop longues à suivre ;
 *  - polices et couleurs du THÈME : la fonction prend `secondary-foreground`, une couleur de TEXTE garantie
 *    lisible, et non `primary`, qui est souvent un fond de marque (parent62 : marine en clair, alors que ses
 *    liens de contenu — `index-parent62.css` — sont justement en `secondary-foreground`) ;
 *  - photo en DÉCOR (`alt` vide) : le nom est écrit juste à côté, le répéter le ferait lire deux fois ;
 *    initiales à défaut ;
 *  - pas de date — celle d'une fiche est sa date de SAISIE, sans intérêt pour le visiteur.
 */
export default function CardResourcePortrait({ item, list }: SearchCardProps) {
  const data = useResourceData(item, list?.resource);

  return (
    <article className="mx-auto flex w-full max-w-5xl items-start gap-4 border-t border-border py-5 sm:gap-5">
      {/* Photo réduite sous `sm` : à 80 px, un écran de 360 px ne laissait que 220 px au texte. */}
      <div className="size-14 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted text-base sm:size-20 sm:text-xl">
        {data.image ? (
          <OptimizedImage src={data.image} alt="" width={80} className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden className="grid h-full w-full place-items-center font-semibold text-muted-foreground">
            {initiales(data.title)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="text-xl leading-tight text-foreground">{data.title}</h3>
        {data.subtitle && (
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-foreground">{data.subtitle}</p>
        )}
        {data.description.trim() && (
          // Même rendu que le corps d'article et que l'aperçu de l'éditeur markdown : HTML brut accepté, assaini.
          <ProseContent
            text={data.description}
            forceMarkdown
            className="prose prose-sm prose-theme max-w-none text-muted-foreground [--tw-prose-body:var(--muted-foreground)] [&_p]:leading-relaxed"
          />
        )}
      </div>
    </article>
  );
}
