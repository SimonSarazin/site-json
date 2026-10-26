import { Search, X } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface DiscussionSearchProps {
  readonly value: string;
  readonly onChange: (valeur: string) => void;
  /** Nombre d'espaces retenus, affiché dans le résumé. */
  readonly holders: number;
  /** Nombre de fils retenus. `null` tant que le périmètre transverse charge. */
  readonly threads: number | null;
  /**
   * Validation du résultat unique.
   *
   * Le panneau décide s'il y a bien UN seul résultat, les deux listes confondues : lui seul
   * les connaît toutes les deux.
   */
  readonly onSubmit?: () => void;
  readonly className?: string;
}

/**
 * La barre de recherche du panneau, posée AU-DESSUS des trois colonnes.
 *
 * **Une seule barre, et pas une par colonne.** La mesure tranche : la colonne des fils tient
 * en cinq lignes pour 96 % des porteurs qui ont du contenu, elle n'a rien à filtrer ; c'est le
 * rail qui déborde (353 comptes au-delà de 20 espaces, 2 429 au maximum). Trois champs, ce
 * serait trois portées que l'utilisateur oublie — il tape dans le mauvais, conclut « il n'y a
 * rien », et abandonne.
 *
 * **Elle n'est pas dans un en-tête de colonne**, pour deux raisons mesurées : le titre y porte
 * `flex-1` et sert de cible de focus au changement d'étape ; et entre 48 et 64 rem de panneau
 * le CSS réduit la colonne des espaces à 3.5 rem — un champ posé là n'existerait pas sur toute
 * une classe d'écrans.
 *
 * **Elle ne cherche pas dans les messages**, et son libellé le dit : aucun texte de message ne
 * transite par l'endpoint `discussions`, et la base n'a aucun index texte. Promettre le
 * contraire par un simple « Rechercher… » serait un mensonge d'interface.
 */
export function DiscussionSearch({
  value, onChange, holders, threads, onSubmit, className,
}: DiscussionSearchProps) {
  const t = useT("modules/comment");
  const actif = value.trim() !== "";

  const resume = threads === null
    ? String(t("panel.searching"))
    : String(t("panel.searchSummary", undefined, {
      holders: String(t("panel.holderCount", undefined, { count: holders })),
      threads: String(t("panel.threadCount", undefined, { count: threads })),
    }));

  return (
    <div
      data-search-row
      className={cn("flex h-12 shrink-0 items-center gap-2 border-b px-3", className)}
    >
      <div className="relative flex min-w-0 flex-1 items-center @[48rem]/panneau:max-w-sm">
        <Search
          className="text-muted-foreground pointer-events-none absolute start-3 size-4"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={String(t("panel.search"))}
          aria-label={String(t("panel.search"))}
          /**
           * Radix écoute Échap sur `document` en phase de CAPTURE : un `preventDefault` posé
           * dans un gestionnaire de bullage arriverait après la fermeture de la modale. Cet
           * attribut est la déclaration « je revendique cette touche », que `DiscussionModal`
           * lit sur la cible de l'événement pour empêcher la fermeture. Il n'est posé que
           * lorsqu'il y a réellement quelque chose à effacer.
           */
          data-comment-escape={actif ? "" : undefined}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit?.();
              return;
            }
            if (event.key === "Escape" && actif) {
              // Le focus RESTE dans le champ : rien n'a disparu sous lui, il n'y a rien à rendre.
              event.stopPropagation();
              onChange("");
            }
          }}
          /* La croix native de `type="search"` n'existe que sur WebKit : on la masque pour ne
             pas afficher deux croix là où elle est rendue, et une seule ailleurs. */
          className="h-8 ps-9 pe-8 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {actif && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={String(t("panel.searchClear"))}
            title={String(t("panel.searchClear"))}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring
                       absolute end-1.5 grid size-6 place-items-center rounded-md transition-colors
                       focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {/**
        * `role="status"` annonce poliment. Un rafraîchissement qui ne change aucun compte rend
        * exactement la même chaîne : React ne touche pas au nœud texte, donc rien n'est
        * réannoncé. Seul un compte réellement différent l'est — ce qui est le comportement voulu.
        */}
      {actif && (
        <span
          role="status"
          data-search-count
          className="text-muted-foreground shrink-0 text-xs tabular-nums"
        >
          {resume}
        </span>
      )}
    </div>
  );
}
