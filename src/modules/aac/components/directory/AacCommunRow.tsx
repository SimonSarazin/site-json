import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import {
  AAC_VISIBLE_TAGS,
  formatAacAmount,
  progressBarWidth,
} from "../../lib/aacDisplay";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";

interface AacCommunRowProps {
  commun: CommunCard;
  className?: string;
}

/**
 * Un commun sur UNE LIGNE — le mode liste de l'annuaire.
 *
 * Mêmes FAITS que `AacCommunCard`, autre disposition : titre, description, tags,
 * collecte, membres et intéressés. La liste n'est pas une vue appauvrie de la
 * carte, c'est la même information rangée pour être comparée d'une ligne à
 * l'autre — d'où les colonnes de droite, alignées et de largeur fixe : l'œil
 * descend une colonne de montants, pas une suite de blocs décalés.
 *
 * Le principe de mise en page est l'inverse de celui de la carte : là où
 * `AacCommunCard` fige des hauteurs pour aligner ses voisines, la ligne fige la
 * sienne à DEUX lignes de texte et tronque. La densité EST la fonctionnalité.
 * Ce qui est coupé reste atteignable par le `title`, comme dans le legacy.
 *
 * Ce qui tombe quand la place manque, dans cet ordre : les tags (sous `lg`),
 * puis la collecte (sous `sm`). Le nom, ce que c'est, et la traction restent
 * toujours — ce sont eux qui permettent de choisir.
 *
 * Divergence assumée avec la carte : la bordure est NEUTRE au repos (la carte la
 * met en `primary`). Une trentaine de bordures colorées empilées feraient un
 * mur ; la couleur est gardée pour le survol et pour l'état « en attente », les
 * deux moments où elle dit quelque chose.
 */
export function AacCommunRow({ commun, className }: AacCommunRowProps) {
  const t = useT("modules/aac");

  const hiddenTags = commun.tags.slice(AAC_VISIBLE_TAGS);
  const barWidth = progressBarWidth(commun.progressPercent);
  // `isSelected === null` ⇒ indécidable (étape d'évaluation absente de la
  // réponse) ⇒ ligne normale, jamais « en attente » par défaut.
  const isPending = commun.isSelected === false;

  return (
    <article
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 transition-colors sm:flex-nowrap sm:gap-4",
        isPending ? "border-accent" : "border-border hover:border-primary",
        className
      )}
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
        {commun.imageUrl ? (
          <img
            src={commun.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : null}
      </div>

      {/* `min-w-0` est ce qui autorise `truncate` : sans lui, un enfant flex
          refuse de passer sous sa largeur de contenu et la ligne déborde.
          `grow basis-48` plutôt que `flex-1` : le raccourci `flex` remettrait la
          base à 0 et les colonnes ne passeraient jamais à la ligne en étroit. */}
      <div className="min-w-0 grow basis-48">
        <div className="flex items-center gap-2">
          <Link to={`/aac/commun/${commun.id}`} className="min-w-0">
            <h3 className="truncate text-sm font-bold tracking-wide uppercase transition-colors hover:text-primary">
              {commun.hasTitle ? commun.title : String(t("directory.card.untitled"))}
            </h3>
          </Link>

          {isPending ? (
            <span className="shrink-0 rounded-full bg-accent/80 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-accent-foreground">
              {String(t("directory.card.pending"))}
            </span>
          ) : null}
        </div>

        <p
          className="truncate text-[13px] leading-5 text-muted-foreground"
          title={commun.description || undefined}
        >
          {commun.description || String(t("directory.card.noDescription"))}
        </p>
      </div>

      {/* Tags — même rang de repli que la carte, pour qu'un commun se lise
          pareil dans les deux modes. */}
      <div className="hidden shrink-0 items-center gap-1 lg:flex">
        {commun.tags.slice(0, AAC_VISIBLE_TAGS).map((tag) => (
          <span
            key={tag}
            className="max-w-28 truncate rounded-lg border border-accent bg-accent px-1.5 py-px text-[11px] text-accent-foreground"
            title={tag}
          >
            {tag}
          </span>
        ))}
        {hiddenTags.length > 0 ? (
          <span
            className="cursor-default rounded-lg border border-accent bg-accent px-1.5 py-px text-[11px] text-accent-foreground"
            title={hiddenTags.join(", ")}
          >
            …
          </span>
        ) : null}
      </div>

      {/* Collecte. Largeur FIXE : c'est ce qui aligne les montants en colonne. */}
      <div className="hidden w-30 shrink-0 sm:block">
        {commun.hasFundingRequest ? (
          <>
            <span className="block truncate text-right text-sm font-semibold">
              {formatAacAmount(commun.totalFunded)}
              <span aria-hidden="true">€</span>
            </span>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded bg-muted"
              role="progressbar"
              aria-valuenow={commun.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={String(t("directory.card.collected"))}
              title={`${commun.progressPercent}%`}
            >
              <div
                className="h-full bg-primary transition-[width] duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </>
        ) : (
          // Le tiret tient la colonne : sans lui, les lignes sans cofinancement
          // remonteraient et la colonne de montants ne se lirait plus d'un trait.
          <span
            className="block text-right text-sm text-muted-foreground"
            title={String(t("directory.card.noFunding"))}
          >
            —
          </span>
        )}
      </div>

      <div className="ml-auto shrink-0 text-right text-xs text-primary sm:ml-0">
        <span className="block whitespace-nowrap">
          {commun.usersCount}{" "}
          {String(t(commun.usersCount > 1 ? "directory.card.users" : "directory.card.user"))}
        </span>
        <span className="block whitespace-nowrap">
          {commun.interestCount}{" "}
          {String(
            t(
              commun.interestCount > 1
                ? "directory.card.interested_other"
                : "directory.card.interested_one"
            )
          )}
        </span>
      </div>
    </article>
  );
}

export default AacCommunRow;
