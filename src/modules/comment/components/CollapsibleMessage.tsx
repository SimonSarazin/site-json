import { useCallback, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

export interface CollapsibleMessageProps {
  readonly children: ReactNode;
  /** Un message en cours d'envoi n'est jamais replié : on vient de l'écrire. */
  readonly disabled?: boolean;
}

/**
 * Borne la hauteur d'un message long, et propose de le dérouler.
 *
 * Discord s'en passe parce que ses messages sont brefs ; ici un fil d'appel à projets porte
 * des récapitulatifs de comité qui noient tout le reste du fil.
 *
 * **La hauteur est bornée, pas le nombre de lignes.** Le texte reste entier dans le DOM, donc
 * trouvable par `Ctrl+F` et lisible par un lecteur d'écran — ce que `-webkit-line-clamp` ne
 * permet pas, puisqu'il masque sans que le navigateur puisse révéler ce qu'il trouve.
 *
 * Le bouton n'apparaît que si le contenu dépasse RÉELLEMENT : la mesure se fait par une
 * callback ref (et non dans un effet), qui est l'idiome React pour observer le DOM et évite
 * la pose d'état en effet — celle-là même qui avait causé un défaut au J7.
 */
export function CollapsibleMessage({ children, disabled = false }: CollapsibleMessageProps) {
  const t = useT("modules/comment");
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /**
   * La hauteur réelle du contenu. Elle sert de CIBLE à la transition : `max-height` ne
   * s'interpole pas vers `none`, et viser une grande valeur arbitraire rendrait la vitesse
   * apparente dépendante de la longueur du message.
   */
  const [hauteur, setHauteur] = useState(0);
  // La mesure ne vaut que replié : déplié, la boîte fait par définition la taille du contenu.
  // Une ref, et non l'état, parce que l'observateur est installé une fois pour toutes.
  const expandedRef = useRef(false);

  const mesurer = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    // On compare le contenu à la hauteur bornée : inutile de connaître le seuil en pixels,
    // c'est le CSS qui le porte — en `rem`, donc à la taille de police du lecteur.
    const lire = () => {
      if (!expandedRef.current) setOverflows(el.scrollHeight > el.clientHeight + 1);
      // `bail out` de React si la valeur est identique : poser la hauteur modifie la boîte,
      // donc rappelle l'observateur, et une valeur neuve à chaque tour boucherait la boucle.
      setHauteur(h => (h === el.scrollHeight ? h : el.scrollHeight));
    };
    lire();
    // Garde et non confort : sans `ResizeObserver`, un `new` direct LÈVE et emporte toute la
    // ligne de message — ce qui s'est vu tout de suite sur 23 tests. Là où il manque, la seule
    // mesure au montage suffit : le markdown du fil ne se redispose qu'au redimensionnement.
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(lire);
    obs.observe(el);
    // React 19 accepte une fonction de nettoyage en retour d'une callback ref.
    return () => obs.disconnect();
  }, []);

  const basculer = () => {
    expandedRef.current = !expanded;
    setExpanded(!expanded);
  };

  if (disabled) return <div className="wrap-break-word">{children}</div>;

  return (
    <>
      <div
        ref={mesurer}
        data-comment-body=""
        data-collapsed={overflows && !expanded}
        className={cn(
          "wrap-break-word",
          overflows && !expanded && "comment-collapsed",
          overflows && expanded && "comment-expanding",
        )}
        style={overflows && expanded && hauteur > 0 ? { maxHeight: `${hauteur}px` } : undefined}
      >
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          data-comment-expand=""
          aria-expanded={expanded}
          onClick={basculer}
          className="mt-0.5 flex items-center gap-1 rounded-sm text-xs font-medium text-primary
                     hover:underline focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
        >
          {expanded
            ? <ChevronUp className="size-3.5" aria-hidden />
            : <ChevronDown className="size-3.5" aria-hidden />}
          {expanded ? t("thread.showLess") : t("thread.showMore")}
        </button>
      )}
    </>
  );
}
