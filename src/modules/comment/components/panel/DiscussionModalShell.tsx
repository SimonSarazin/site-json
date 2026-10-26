import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { swallowEchoClick } from "../../lib/echoClick";

export interface DiscussionModalShellProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Le nom accessible de la modale, et ce qu'elle contient — lus, jamais affichés. */
  readonly title: string;
  readonly description: string;
  readonly className?: string;
  /**
   * Où poser le focus à l'ouverture. Par défaut, le premier élément atteignable au clavier ;
   * `"dialog"` le pose sur le dialogue lui-même, pour un contenu dont le premier bouton n'est pas
   * un bon point de départ.
   */
  readonly initialFocus?: "first" | "dialog";
  /** Le panneau à emballer. Il reçoit la croix de fermeture, à poser dans SA barre de titre. */
  readonly children: (headerEnd: ReactNode) => ReactNode;
}

/**
 * La coquille commune aux modales du module : le panneau général (`DiscussionModal`) et l'espace
 * d'un commun (`SpaceModal`) n'ont pas le même contenu, mais le même cadre, la même croix et le
 * même arbitrage d'Échap — écrits une fois.
 *
 * Elle avale aussi l'ÉCHO d'un double clic (`swallowEchoClick`) aux deux moments où elle change ce
 * qu'il y a sous le curseur : quand elle apparaît — le second clic tombait sur son voile et la
 * refermait, ou sur une rangée et changeait de fil — et quand un clic la ferme — il atteignait la
 * page qu'elle couvrait.
 *
 * Dans son propre fichier, et c'est voulu : chaque modale se charge en différé, et celle de
 * l'espace n'a pas à emporter le panneau général qu'elle ne rend jamais — ce qu'elle faisait tant
 * que la coquille vivait à côté de lui.
 */
export function DiscussionModalShell({
  open, onOpenChange, title, description, className, initialFocus = "first", children,
}: DiscussionModalShellProps) {
  const t = useT("modules/comment");

  // À l'ouverture, sans point : la coquille ne sait pas d'où on l'a ouverte (un bouton de la
  // fiche, celui d'un palier, une adresse). Fermée dans l'intervalle, elle désarme.
  useEffect(() => (open ? swallowEchoClick() : undefined), [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        /* La croix par défaut est en `absolute top-4 right-4`, pile sur l'en-tête de la
           colonne du fil. On la repose DANS la barre de titre, comme chez Discord. */
        showCloseButton={false}
        onOpenAutoFocus={initialFocus === "dialog"
          ? event => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }
          : undefined}
        /**
         * L'arbitrage d'Échap, et son unique point d'accroche.
         *
         * Radix écoute la touche sur `document` en phase de CAPTURE : un `preventDefault` posé
         * dans un gestionnaire React — qui, lui, bulle — arrive après que la modale a décidé
         * de se fermer. C'est ici, et nulle part ailleurs, qu'on peut l'en empêcher.
         *
         * La règle est portée par le DOM plutôt que par un état partagé, parce que les pièces
         * concernées ne se parlent pas : chacune pose `data-comment-escape` quand elle
         * revendique la touche (le champ de recherche quand il a quelque chose à effacer, le
         * formulaire de création, le composeur quand une mention est en cours ou qu'il a une
         * édition à annuler), et son PROPRE gestionnaire fait ensuite son travail. Sans
         * revendication, Échap ferme la modale — le comportement attendu.
         *
         * Ce gestionnaire-là reçoit la touche DÉJÀ neutralisée par la ligne ci-dessous : il ne
         * doit pas s'y fier. Celui du composeur la traite donc en capture, sur son conteneur —
         * l'éditeur, lui, ignore une touche neutralisée (`EditorSurface`).
         *
         * Sur la page `/discussions` il n'y a pas de `Dialog` du tout : seuls ces gestionnaires
         * s'appliquent, ce qui donne le même résultat.
         */
        onEscapeKeyDown={event => {
          const cible = event.target as HTMLElement | null;
          if (cible?.closest?.("[data-comment-escape]")) event.preventDefault();
        }}
        // Un appui sur le voile ferme : son écho, au même endroit, viserait la page dessous.
        onPointerDownOutside={event => {
          const { clientX, clientY } = event.detail.originalEvent;
          swallowEchoClick({ clientX, clientY });
        }}
        className={cn(
          // `DialogContent` est un `grid gap-4 p-6 sm:max-w-lg` : tout est à écraser, le
          // panneau gère lui-même sa mise en page et ses bordures.
          "flex max-h-none w-full gap-0 overflow-hidden p-0 sm:max-w-none",
          // Le dialogue peut recevoir le focus lui-même (`initialFocus`) : ce n'est pas une
          // commande, il n'a pas d'anneau à montrer.
          "outline-none",
          // La largeur maximale est posée en `md:`, pas sans variante : `sm:max-w-none` — qu'il
          // faut pour retirer le `sm:max-w-lg` de la base — l'emportait sur elle dès 640 px, et
          // la modale prenait toute la largeur de l'écran, sans marge.
          "h-[min(46rem,calc(100dvh-3rem))] md:max-w-[min(84rem,calc(100vw-4rem))]",
          // Sous 48 rem, la modale prend l'écran : une marge de 16 px autour d'un panneau qui
          // n'affiche qu'une colonne ne sert à rien, et coûte la largeur du fil.
          "max-md:h-dvh max-md:max-w-none max-md:rounded-none max-md:border-0",
          className,
        )}
      >
        {/* Une modale doit avoir un nom accessible ; celui-ci n'a pas à être vu, le panneau
            porte déjà ses propres titres de colonnes. Sa DESCRIPTION dit ce qu'elle contient au
            lecteur d'écran — elle était escamotée par `aria-describedby={undefined}` (revue du
            29/09). */}
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children(
          <button
            type="button"
            onClick={event => {
              // À la souris seulement : au clavier (`detail` nul) il n'y a pas de second appui.
              if (event.detail > 0) swallowEchoClick({ clientX: event.clientX, clientY: event.clientY });
              onOpenChange(false);
            }}
            aria-label={String(t("panel.close"))}
            title={String(t("panel.close"))}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring
                       grid size-7 place-items-center rounded-md transition-colors
                       focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden />
          </button>,
        )}
      </DialogContent>
    </Dialog>
  );
}
