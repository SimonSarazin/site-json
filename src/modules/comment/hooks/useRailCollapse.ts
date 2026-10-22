import { useCallback, useState, useSyncExternalStore } from "react";

const CLE = "comment.panel.rail";
/**
 * Les deux seuils de `styles.css`, qui découpent trois zones — et les confondre est le défaut
 * qui a valu un rail de 56 px sur un écran de 390 px.
 *
 *  · `< 48 rem`   UNE seule colonne à l'écran : le pli n'a pas d'objet, il n'y a rien à côté à
 *                 qui rendre de la place. Ni pli imposé, ni pli choisi, ni bouton.
 *  · `48–64 rem`  les trois colonnes tiennent, mais pas larges : le rail est plié D'OFFICE et
 *                 le bouton retiré, puisqu'il serait sans effet.
 *  · `≥ 64 rem`   le pli est libre, et c'est la préférence de l'utilisateur qui décide.
 */
const SEUIL_UNE_COLONNE_REM = 48;
const SEUIL_PLI_REM = 64;

/** Là où se trouve le panneau parmi les trois zones ci-dessus. */
type Zone = "une-colonne" | "pli-impose" | "libre";

type Preference = "collapsed" | "expanded" | null;

/**
 * La préférence de pli est une donnée EXTERNE à React : elle survit au démontage et se
 * partage entre les onglets. `useSyncExternalStore` est ce qui la lit sans divergence
 * d'hydratation — au rendu serveur, `getServerSnapshot` rend « aucune préférence », ce qui
 * est la vérité.
 *
 * Elle vit dans `localStorage` et pas dans l'URL : c'est un réglage d'affichage, pas un état
 * de navigation. Une adresse partagée ne doit pas imposer son pli au destinataire.
 */
const abonnes = new Set<() => void>();
function abonner(notifier: () => void) {
  abonnes.add(notifier);
  return () => { abonnes.delete(notifier); };
}
function lirePreference(): Preference {
  try {
    const v = localStorage.getItem(CLE);
    return v === "collapsed" || v === "expanded" ? v : null;
  } catch {
    // Navigation privée, stockage refusé : pas de préférence, et surtout pas d'exception.
    return null;
  }
}
function lireAuServeur(): Preference {
  return null;
}
function ecrirePreference(v: Preference) {
  try {
    if (v === null) localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, v);
  } catch { /* sans persistance, la bascule vaut au moins pour la session */ }
  for (const notifier of abonnes) notifier();
}

export interface RailCollapse {
  /** Le rail est-il plié, à la main ou parce que le panneau est trop étroit ? */
  readonly collapsed: boolean;
  /** La valeur à poser sur `data-rail` — le CSS y ajoute son propre forçage par largeur. */
  readonly attribute: "collapsed" | "expanded";
  /** Faux quand la largeur impose déjà le pli : le bouton serait sans effet. */
  readonly canToggle: boolean;
  readonly toggle: () => void;
  /** À poser sur la racine du panneau : c'est ELLE qu'on mesure, pas l'écran. */
  readonly measureRef: (el: HTMLElement | null) => void;
}

/**
 * Pli du rail : la préférence de l'utilisateur, et le forçage par la largeur du panneau.
 *
 * La mesure passe par une **callback ref** et non par un effet — c'est l'idiome React pour
 * observer le DOM, et il évite la pose d'état en effet qui avait causé un défaut au J7.
 *
 * Le layout, lui, est fait par le CSS (`styles.css`) : cette mesure ne sert qu'à ce que le
 * JavaScript ne peut pas déduire d'une règle de style — décider si l'infobulle Radix a lieu
 * d'être, puisqu'elle serait redondante avec un libellé visible.
 */
export function useRailCollapse(): RailCollapse {
  const preference = useSyncExternalStore(abonner, lirePreference, lireAuServeur);
  const [zone, setZone] = useState<Zone>("libre");

  const measureRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const lire = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const largeur = el.getBoundingClientRect().width;
      // Un panneau non encore disposé ne prouve rien : on garde la zone précédente plutôt que
      // d'en conclure quoi que ce soit.
      if (largeur <= 0) return;
      setZone(largeur < SEUIL_UNE_COLONNE_REM * rem ? "une-colonne"
        : largeur < SEUIL_PLI_REM * rem ? "pli-impose"
          : "libre");
    };
    lire();
    // Sans `ResizeObserver`, un `new` direct lèverait et emporterait tout le panneau.
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(lire);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return {
    // En une colonne, le nom de chaque espace est lisible : poser une infobulle par rangée
    // serait redondant, et elle s'ouvrirait au toucher par-dessus ce qu'elle répète.
    collapsed: zone === "pli-impose" || (zone === "libre" && preference === "collapsed"),
    /**
     * ⚠️ `attribute` reste la préférence SEULE, sans correction par la zone — et c'est
     * délibéré. La mesure n'existe ni au rendu serveur ni au premier rendu client : la corriger
     * ici ferait apparaître un rail replié une fraction de seconde avant qu'il ne s'ouvre. Le
     * bornage par largeur appartient au CSS, qui est juste dès le premier octet (`styles.css`,
     * bloc `@container panneau (min-width: 48rem)`).
     */
    attribute: preference === "collapsed" ? "collapsed" : "expanded",
    canToggle: zone === "libre",
    toggle: () => ecrirePreference(preference === "collapsed" ? "expanded" : "collapsed"),
    measureRef,
  };
}
