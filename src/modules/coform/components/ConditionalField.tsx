import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Durée de l'ouverture/fermeture. Doit rester alignée sur `duration-200`. */
const DUREE_MS = 200;

interface ConditionalFieldProps {
  /** Le champ satisfait-il ses règles d'affichage conditionnel ? */
  visible: boolean;
  /** Classe de largeur de grille du champ (`col-span-*`), portée par le wrapper. */
  width?: string;
  /**
   * Nom react-hook-form — sert d'ancre à `ErrorSummary` (`scrollToFieldByName`).
   * Omis pour les champs décoratifs (`sectionTitle`, `sectionDescription`), que
   * le chemin non animé n'ancre pas non plus : ils ne portent jamais d'erreur.
   */
  fieldName?: string;
  /**
   * Champ verrouillé — rendu strictement aligné sur le chemin non animé.
   *
   * Celui-ci pose `pointer-events-none opacity-60 *:cursor-not-allowed` sur un
   * wrapper en `display: contents`, où seules les deux premières prennent effet :
   * l'opacité ne s'applique pas à un élément qui ne génère pas de boîte. Comme
   * notre wrapper EST une boîte, reprendre la classe telle quelle donnerait deux
   * rendus différents du verrouillage selon que le champ est conditionnel ou non.
   * On s'en tient donc à ce qui est réellement visible aujourd'hui.
   */
  isLocked?: boolean;
  /**
   * Le champ, en RENDER-PROP et non en `children` déjà construits.
   *
   * ⚠️ C'est le cœur du composant, pas un détail de style : tant que le champ
   * est masqué, cette fonction n'est JAMAIS appelée, donc le champ n'est pas
   * monté. Passer un élément JSX construit par l'appelant monterait en
   * permanence tous les champs conditionnels du formulaire — et certains
   * (`finder`, `commonTable`) déclenchent des requêtes réseau au montage.
   */
  children: () => ReactNode;
}

/**
 * Apparition/disparition animée d'un champ à affichage conditionnel.
 *
 * Sans lui, un champ conditionnel apparaît et disparaît d'un coup (`return null`),
 * et tout ce qui le suit dans le formulaire saute d'autant. C'est ce saut de
 * hauteur — plus que le changement d'opacité — qui rend la bascule brutale.
 *
 * **Comment la hauteur est animée** : le wrapper est une grille dont l'unique
 * piste passe de `0fr` à `1fr`, l'enfant étant en `overflow-hidden min-h-0`.
 * C'est la seule technique qui interpole vers la hauteur NATURELLE du contenu
 * sans avoir à la mesurer (contrairement aux keyframes `accordion-*` du repo,
 * qui dépendent d'une variable calculée par Radix et ne servent qu'à ses
 * primitives).
 *
 * **`overflow-hidden` n'est posé que pendant le mouvement** : en régime établi
 * il rognerait les anneaux de focus, les ombres et tout dépassement légitime
 * d'un champ ouvert.
 *
 * **Cycle de vie** : à l'ouverture le champ est monté fermé, puis ouvert à la
 * frame suivante — sans ce délai d'une frame, le navigateur n'a pas d'état de
 * départ à interpoler et la transition ne joue pas. À la fermeture il reste
 * monté le temps de l'animation, puis est démonté. Un champ déjà visible au
 * premier rendu ne s'anime pas : sinon tout le formulaire s'animerait à
 * l'ouverture de la page.
 */
export function ConditionalField({
  visible,
  width,
  fieldName,
  isLocked,
  children,
}: ConditionalFieldProps) {
  const [monte, setMonte] = useState(visible);
  const [ouvert, setOuvert] = useState(visible);
  const [enMouvement, setEnMouvement] = useState(false);

  // Ajustements pendant le rendu (et non dans un effet) : c'est le patron React
  // pour réagir à un changement de prop, et `react-hooks/set-state-in-effect`
  // interdit la forme effet.
  if (visible && !monte) {
    setMonte(true);
    setEnMouvement(true);
  }
  if (!visible && ouvert) {
    setOuvert(false);
    setEnMouvement(true);
  }

  // Ouverture : une frame après le montage, pour donner au navigateur un état
  // de départ (`0fr`) à interpoler.
  useEffect(() => {
    if (!visible || !monte || ouvert) return;
    const id = requestAnimationFrame(() => {
      // Réarmé ici et pas seulement au montage : dans un onglet en arrière-plan
      // le `setTimeout` continue de courir alors que le rAF est gelé. Sans ce
      // réarmement, `enMouvement` serait déjà retombé au retour sur l'onglet et
      // la hauteur s'animerait sans `overflow-hidden` — le contenu déborderait
      // par-dessus les champs suivants.
      setEnMouvement(true);
      setOuvert(true);
    });
    return () => cancelAnimationFrame(id);
  }, [visible, monte, ouvert]);

  // Fin du mouvement : démontage si on ferme, retrait de `overflow-hidden` si
  // on ouvre. Un timer plutôt qu'un `transitionend` : ce dernier ne se déclenche
  // pas quand l'utilisateur a désactivé les animations, et le champ resterait
  // alors monté indéfiniment.
  useEffect(() => {
    if (!enMouvement) return;
    const id = setTimeout(() => {
      setEnMouvement(false);
      if (!visible) setMonte(false);
    }, DUREE_MS);
    return () => clearTimeout(id);
  }, [enMouvement, visible, ouvert]);

  if (!monte) return null;

  // Parité avec la garde du chemin non animé (`if (!fieldElement) return null`).
  // DÉFENSIVE et non atteinte depuis les call-sites actuels : le switch renvoie
  // toujours un élément JSX, y compris quand le composant de champ rend `null`
  // en interne (`params` admin absents). Elle vaut pour le jour où un `case`
  // renverrait `null` directement — un item de grille vide laisserait alors un
  // trou de `col-span-*` + `gap-6`.
  const contenu = children();
  if (!contenu) return null;

  return (
    <div
      data-field-name={fieldName}
      data-state={ouvert ? "open" : "closed"}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        ouvert ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        width ?? "col-span-12",
        isLocked && "pointer-events-none *:cursor-not-allowed",
      )}
      // Hors du flux de tabulation dès que la fermeture commence : sans cela le
      // champ resterait focusable pendant qu'il se replie.
      inert={!ouvert || undefined}
    >
      <div className={cn("min-h-0", enMouvement && "overflow-hidden")}>{contenu}</div>
    </div>
  );
}
