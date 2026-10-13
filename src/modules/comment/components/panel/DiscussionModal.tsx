import { useT } from "@/hooks/useT";
import { DiscussionModalShell } from "./DiscussionModalShell";
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
    <DiscussionModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={String(t("panel.title"))}
      description={String(t("panel.description"))}
      className={className}
    >
      {headerEnd => <DiscussionPanel param={param} className="rounded-none border-0" headerEnd={headerEnd} />}
    </DiscussionModalShell>
  );
}
