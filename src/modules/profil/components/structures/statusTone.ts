import { CircleCheck, CircleDashed, CirclePlay, CircleX } from "lucide-react";

import type { ActivityStatusKey } from "@/modules/search/lib/coformAnswer";

/**
 * Pastille de statut de l'onglet « Structures » (créneaux, et structure non validée) : la couleur du
 * statut en FOND, son texte prévu par le thème en encre (≥ 4,5:1 dans les deux thèmes SSBE, mesuré) ;
 * l'icône suit le texte. Pas la table `STATUS_TONE_CLASS` de l'admin : elle pose
 * `text-primary-foreground` sur ces fonds, 1,85:1 pour « En attente » en clair. L'icône et le mot
 * disent le statut sans la couleur. Une table pour tout l'onglet : un statut a partout la même icône
 * et le même couple fond/encre.
 *
 * Distincte de `getStatusStyle` (search, badges des cartes et du détail) À DESSEIN : celle-ci pose les
 * fonds `bg-badge-*`, que chaque site peut redéfinir dans sa feuille (`--badge-*` de
 * `src/index-<site>.css`, par défaut les jetons sémantiques) ; l'onglet, outil de gestion, garde les
 * jetons SÉMANTIQUES (warning, success…), qui disent l'état partout pareil. Les encres sont les mêmes.
 */
export const STATUS_TONE: Record<ActivityStatusKey, { Icon: typeof CircleCheck; pill: string }> = {
  pending: { Icon: CircleDashed, pill: "bg-warning text-warning-foreground" },
  inProgress: { Icon: CirclePlay, pill: "bg-primary text-primary-foreground" },
  validated: { Icon: CircleCheck, pill: "bg-success text-success-foreground" },
  refused: { Icon: CircleX, pill: "bg-destructive text-destructive-foreground" },
};
