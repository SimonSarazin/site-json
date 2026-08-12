import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";
import { Link } from "react-router";

interface AacCommunCardProps {
  commun: CommunCard;
  className?: string;
}

/**
 * Le legacy formate par `toLocaleString("fr-FR")` puis colle une icône `fa-eur`.
 * D'où un formateur DÉCIMAL suivi d'un « € » — et non `style:"currency"`, qui
 * insère une espace insécable étroite et ne rendrait pas la même chose.
 */
const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Tags affichés avant le repli dans la pastille « … » (`nbTagToShow` du legacy). */
const VISIBLE_TAGS = 2;

/**
 * Carte d'un commun dans l'annuaire.
 *
 * Portage fidèle du gabarit legacy `federationDesCae_index.js` (rendu de
 * `.aac-card`) et de sa feuille `themes/CO2/assets/css/default/directory.css`.
 * Les mesures viennent de là : le thème CO2 pose `1rem = 10px`, donc `1.75rem`
 * → 17,5 px, `5.8rem` → 58 px, `min-height: 56rem` → 560 px.
 *
 * Le point de design à ne pas perdre : **le rythme vertical est FIGÉ**. Titre,
 * description, tags et montant occupent chacun une hauteur verrouillée, remplie
 * au besoin par du vide. C'est ce qui fait que, d'une carte à l'autre, les barres
 * de progression et les pieds de carte tombent sur la même ligne. Un `flex-grow`
 * donnerait une grille en dents de scie : c'est un choix de mise en page, pas une
 * commodité d'implémentation.
 *
 * Les couleurs passent par les jetons du thème (`primary` pour la `color1` du
 * costum, `accent` pour sa `color3`) : la carte suit la palette du site, elle ne
 * la redéfinit pas.
 */
export function AacCommunCard({ commun, className }: AacCommunCardProps) {
  const t = useT("modules/aac");

  const hiddenTags = commun.tags.slice(VISIBLE_TAGS);
  // La barre est bornée VISUELLEMENT à 100 % alors que le pourcentage affiché ne
  // l'est pas : un commun sur-financé doit se lire « 110 % » sans déborder.
  const barWidth = Math.min(100, Math.max(0, commun.progressPercent));
  const isPending = commun.isSelected === false;

  return (
    <article
      className={cn(
        // Le padding enveloppe TOUT le contenu, image comprise — elle n'est pas
        // à fond perdu. La feuille partagée ne le porte pas (`.commun-card` y est
        // à `padding: 0`) : chaque bloc CMS le surcharge dans son propre `<style>`
        // scopé, comme le fait `communSlider.php`. La valeur vient donc du rendu
        // de référence, pas de `directory.css`.
        "relative min-h-140 rounded-[10px] border bg-card p-5",
        // `isSelected === null` ⇒ indécidable (étape d'évaluation absente de la
        // réponse) ⇒ carte NORMALE, jamais « en attente » par défaut.
        isPending ? "border-accent" : "border-primary",
        className
      )}
    >
      {isPending && (
        <span className="absolute top-0 left-0 z-10 rounded-ss-lg rounded-ee-[11px] bg-accent/80 px-1.25 py-0.5 text-[11px] font-semibold text-accent-foreground shadow-[1px_2px_7px_0_rgba(82,79,82,0.7)] backdrop-blur-[10px]">
          {String(t("directory.card.pending"))}
        </span>
      )}

      <div className="relative block">
        {commun.imageUrl ? (
          <img
            src={commun.imageUrl}
            alt=""
            loading="lazy"
            className="h-40 w-full rounded-[10px] object-contain"
          />
        ) : (
          // Aplat neutre — jamais `thumbnail-default.jpg`, l'asset legacy
          // n'existe pas dans site-json.
          <div className="h-40 w-full rounded-[10px] bg-muted" />
        )}
      </div>

      <div className="relative block pt-3">
        <div className="pb-px">
          <Link to={`/aac/commun/${commun.id}`}>
            <h3 className="line-clamp-2 h-14.25 text-[17.5px] leading-[28.5px] font-medium text-primary">
              {commun.hasTitle ? commun.title : String(t("directory.card.untitled"))}
            </h3>
          </Link>
        </div>

        {/* Jamais vide : le legacy retombe sur « (Pas de description) » pour que
            la zone conserve sa hauteur et que le rythme tienne. */}
        {/* Semi-gras : `directory.css` dit `font-weight: 400`, mais les deux
            rendus de référence montrent une description grasse — encore une
            surcharge de bloc. La référence tranche. */}
        <p className="mb-1.25 line-clamp-3 h-18 text-sm leading-6 font-semibold text-foreground">
          {commun.description || String(t("directory.card.noDescription"))}
        </p>

        {/* Zone de tags TOUJOURS rendue, même sans tag (le legacy y pose un
            `&nbsp;`) : c'est une gouttière de hauteur fixe, pas un bloc optionnel. */}
        <div className="h-14.5 overflow-hidden">
          {commun.tags.slice(0, VISIBLE_TAGS).map((tag) => (
            <span
              key={tag}
              className="mr-1.25 mb-1.25 inline-block min-w-23 rounded-lg border border-accent bg-accent px-0.5 py-px text-center text-xs whitespace-nowrap text-accent-foreground"
            >
              {tag}
            </span>
          ))}
          {hiddenTags.length > 0 && (
            <span
              className="mr-1.25 mb-1.25 inline-block min-w-5 cursor-default rounded-lg border border-accent bg-accent px-0.5 py-px text-center text-xs text-accent-foreground"
              title={hiddenTags.join(", ")}
            >
              …
            </span>
          )}
        </div>

        <div className="pb-1.25 text-center">
          {commun.hasFundingRequest ? (
            <span className="block truncate text-[31px] font-semibold">
              {amount.format(commun.totalFunded)}
              <span aria-hidden="true">€</span>
            </span>
          ) : (
            // Réserve exactement la place du montant absent (`.collect-empty`).
            <span className="block h-11.07" aria-hidden="true" />
          )}
          <span className="block text-[14.5px] font-semibold">
            {String(
              t(
                commun.hasFundingRequest
                  ? "directory.card.collected"
                  : "directory.card.noFunding"
              )
            )}
          </span>
        </div>

        <div
          className="h-5 overflow-hidden rounded bg-muted shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
          role="progressbar"
          aria-valuenow={commun.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={String(t("directory.card.collected"))}
        >
          <div
            className="h-full bg-primary text-center text-xs leading-5 text-primary-foreground transition-[width] duration-500"
            style={{ width: `${barWidth}%` }}
          >
            {commun.progressPercent}%
          </div>
        </div>

        <div className="mt-6.25 flex items-center justify-between">
          <div className="text-base font-normal text-primary">
            <span className="block">
              {commun.usersCount}{" "}
              {String(
                t(commun.usersCount > 1 ? "directory.card.users" : "directory.card.user")
              )}
            </span>
            <span className="block">
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

          <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border-4 border-primary text-primary">
            {/* Flèche courbe du legacy, reprise telle quelle : aucune icône Lucide
                ne correspond à ce tracé (viewBox 24, pivoté de 180°). */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="rotate-180"
              aria-hidden="true"
            >
              <g
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              >
                <path d="m8 5l-5 5l5 5" />
                <path d="M3 10h8c5.523 0 10 4.477 10 10v1" />
              </g>
            </svg>
          </span>
        </div>
      </div>
    </article>
  );
}

export default AacCommunCard;
