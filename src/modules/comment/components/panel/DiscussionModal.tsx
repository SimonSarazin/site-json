import { X } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DiscussionPanel } from "./DiscussionPanel";

export interface DiscussionModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Nom du paramètre d'URL, transmis tel quel au panneau. */
  readonly param?: string;
  readonly className?: string;
}

/**
 * Le panneau en modale large et centrée.
 *
 * **Zéro duplication** : il emballe `DiscussionPanel`, qui reste l'unique implémentation.
 * Et comme le panneau se mesure à son conteneur et non au viewport, il se réorganise ici
 * exactement comme en pleine page — sans une ligne de responsive en plus.
 *
 * **`Dialog` et non `Sheet`, et c'est dirimant.** `dialog.tsx` a reçu le correctif qui retire
 * l'animation de sortie : Radix `Presence` attend `animationend` avant de démonter, et un
 * contenu lourd qui se re-rend pendant la fermeture ne l'émet jamais — le dialogue reste alors
 * `state=closed`, et `react-remove-scroll` laisse `<body>` verrouillé, page non défilable.
 * `sheet.tsx` n'a pas reçu ce correctif, et le panneau est exactement ce contenu lourd : trois
 * requêtes, temps réel, composer, surfaces Radix imbriquées.
 */
export function DiscussionModal({ open, onOpenChange, param, className }: DiscussionModalProps) {
  const t = useT("modules/comment");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        /* La croix par défaut est en `absolute top-4 right-4`, pile sur l'en-tête de la
           colonne du fil. On la repose DANS la barre de titre, comme chez Discord. */
        showCloseButton={false}
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
         * composeur quand il a une liste de mentions ouverte ou une édition à annuler), et son
         * propre gestionnaire de bullage fait ensuite son travail. Sans revendication, Échap
         * ferme la modale — le comportement attendu.
         *
         * Sur la page `/discussions` il n'y a pas de `Dialog` du tout : seuls les
         * gestionnaires de bullage s'appliquent, ce qui donne le même résultat.
         */
        onEscapeKeyDown={event => {
          const cible = event.target as HTMLElement | null;
          if (cible?.closest?.("[data-comment-escape]")) event.preventDefault();
        }}
        className={cn(
          // `DialogContent` est un `grid gap-4 p-6 sm:max-w-lg` : tout est à écraser, le
          // panneau gère lui-même sa mise en page et ses bordures.
          "flex max-h-none w-full gap-0 overflow-hidden p-0 sm:max-w-none",
          "h-[min(46rem,calc(100dvh-3rem))] max-w-[min(84rem,calc(100vw-4rem))]",
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
        <DialogTitle className="sr-only">{String(t("panel.title"))}</DialogTitle>
        <DialogDescription className="sr-only">{String(t("panel.description"))}</DialogDescription>
        <DiscussionPanel
          param={param}
          className="rounded-none border-0"
          headerEnd={(
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={String(t("panel.close"))}
              title={String(t("panel.close"))}
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring
                         grid size-7 place-items-center rounded-md transition-colors
                         focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
