/**
 * Agrégateur SIDE-EFFECT : importe les `fns.ts` de chaque entité costum pour enregistrer leurs descripteurs
 * + fns (par clé) dans les registres (`specRegistries.ts`) AVANT le 1er rendu d'une `EntityModalSpec`.
 * Importé par `EntityFormModal`. Jumeau de `registerWidgets.tsx`.
 *
 * (Se remplit au fil des migrations : poi-équipement puis tiers-lieu.)
 */
import "./costum/equipements-sportifs/fns";
import "./costum/tiers-lieux/fns";
