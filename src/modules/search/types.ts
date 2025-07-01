import { LocalizedString } from "@/types/locale-schema";


/* ------------------------------------------------------------------
 * Filter definitions ------------------------------------------------
 * -----------------------------------------------------------------*/
export interface TagsFilter {
  type: "tags";
  /** Libellé du filtre (bouton) */
  name: string | LocalizedString;
  /**
   * Liste des options.
   *  - tableau de chaînes simples          → ["Association", …]
   *  - tableau de LocalizedString          → [{ fr:"A", en:"A" }, …]
   *  - dictionnaire key → LocalizedString  → { association: { fr:"…" } }
   */
  list: (string | LocalizedString | Record<string, LocalizedString>)[] | Record<string, LocalizedString | string>;
}

/* ------------------------------------------------------------------
 * Public props for the SearchPro section ----------------------------
 * -----------------------------------------------------------------*/
export interface SearchProProps {
  /** Placeholder de l'input texte  */
  placeholder: LocalizedString;
  /** Affiche / masque la barre de filtres (def: true) */
  useFilter?: boolean;
  /** Vue carte par défaut          (def: false) */
  showMap?: boolean;

  /** Définition inline des filtres */
  filters?: Record<string, TagsFilter>;

  /** Paramètres passés à organization.searchCostum */
  baseParams?: {
    fediverse?: boolean;
    indexStepList?: number;
    indexStepMap?: number;
    defaultTypes?: string[];
    defaultTags?: string[];
  };

  /**
   * Configuration de la vue liste (optionnelle)
   *
   *  - `columns` définit le nombre de colonnes par breakpoint.
   *    Les clés correspondent aux tailles Tailwind (`sm`, `md`, `lg`) et
   *    génèrent automatiquement les classes `sm:grid-cols-x`, `md:grid-cols-y`, …
   */
  list?: {
    columns?: {
      lg?: number;
      md?: number;
      sm?: number;
    };
    card?: {
      tagLimit?: number;
      showDescription?: boolean;
      shareButton?: boolean;
    };
  };

  /** Configuration de la vue carte (optionnelle) */
  map?: {
    initialZoom?: number;
    cluster?: boolean;
  };
}

/* ------------------------------------------------------------------
 * Helpers -----------------------------------------------------------
 * -----------------------------------------------------------------*/
export type FilterKey = keyof NonNullable<SearchProProps["filters"]>;
