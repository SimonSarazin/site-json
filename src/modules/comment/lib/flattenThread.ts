import { CONTEXT_QUOTE_LENGTH, GROUP_WINDOW_SECONDS, MAX_VISUAL_DEPTH } from "../constants/display";
import type { CommentNode } from "../types";

/**
 * Aplatit l'arbre de commentaires en une liste de lignes prêtes à rendre.
 *
 * C'est ici que vit la grammaire visuelle empruntée à Discord — et elle vit dans une fonction
 * **pure**, pas dans les composants : le groupement, les séparateurs de date et la règle des
 * non-lus se testent alors sans DOM, et se comportent identiquement dans le fil et le panneau.
 */

export type ThreadRow =
  /** Change de jour : « Aujourd'hui », « Hier », ou la date. */
  | { readonly kind: "date"; readonly key: string; readonly at: number }
  /** La ligne rouge « nouveaux messages », posée une seule fois, avant le premier non-lu. */
  | { readonly kind: "unread"; readonly key: string; readonly count: number }
  | {
      readonly kind: "message";
      readonly key: string;
      readonly node: CommentNode;
      /** `true` quand le message se fond dans le bloc précédent (ni avatar ni en-tête). */
      readonly grouped: boolean;
      /** Retrait visuel effectif, borné. */
      readonly depth: number;
      /** Profondeur réelle dans l'arbre, non bornée — sert aux tests et au repli. */
      readonly realDepth: number;
      /**
       * Renseigné quand le message dépasse le retrait maximal : on cite alors son parent
       * au lieu de l'indenter davantage.
       */
      readonly contextParent: { readonly id: string; readonly author: string; readonly excerpt: string } | null;
      /**
       * Le message ne tombe pas sous le séparateur de jour qui le précède à l'écran.
       *
       * C'est le cas d'une réponse écrite un autre jour que la racine qui la porte : elle reste
       * sous son parent, donc aucun séparateur ne la précède. Sans ce drapeau, la ligne
       * afficherait « 11:08 » au milieu d'un fil daté du 23 septembre — une heure sans jour,
       * qu'on lit forcément comme celle du jour affiché. La ligne rend alors la date entière.
       */
      readonly dayShift: boolean;
    };

export interface FlattenOptions {
  /** Retrait maximal. Le même à toutes les largeurs : c'est le CSS qui resserre, pas la structure. */
  readonly maxDepth?: number;
  /** Fenêtre de regroupement, en secondes. */
  readonly groupWindow?: number;
  /** Identifiants des messages dont les réponses sont repliées. */
  readonly collapsed?: ReadonlySet<string>;
  /** Fuseau utilisé pour décider du changement de jour (par défaut, celui du navigateur). */
  readonly timeZone?: string;
}

/** Clé de jour local — c'est le changement de cette clé qui insère un séparateur. */
function dayKey(unixSeconds: number, timeZone?: string): string {
  const d = new Date(unixSeconds * 1000);
  if (!timeZone) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  // `en-CA` rend déjà AAAA-MM-JJ, ce qui évite d'avoir à réordonner les parties.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * `![description](adresse)` → sa description : une citation se lit, elle n'affiche pas d'adresse. Une
 * adresse peut porter des parenthèses appariées (`…/a(1).png`) : un niveau est lu.
 */
const IMAGE_ECRITE = /!\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g;

function excerpt(text: string): string {
  const compact = text.replace(IMAGE_ECRITE, "$1").replace(/\s+/g, " ").trim();
  return compact.length <= CONTEXT_QUOTE_LENGTH ? compact : `${compact.slice(0, CONTEXT_QUOTE_LENGTH - 1)}…`;
}

/**
 * Parcourt l'arbre dans l'ordre de lecture (un message, puis ses réponses) et produit les lignes.
 *
 * Le marqueur de non-lus n'est posé qu'une fois, avant le premier message non lu : c'est une
 * frontière de lecture, pas une décoration par message.
 */
export function flattenThread(tree: readonly CommentNode[], options: FlattenOptions = {}): readonly ThreadRow[] {
  const maxDepth = options.maxDepth ?? MAX_VISUAL_DEPTH;
  const groupWindow = options.groupWindow ?? GROUP_WINDOW_SECONDS;
  const collapsed = options.collapsed ?? new Set<string>();

  const rows: ThreadRow[] = [];
  let lastDay: string | null = null;
  let previous: { authorId: string; at: number; depth: number; day: string } | null = null;
  let unreadPlaced = false;

  // Le compte des non-lus est calculé d'avance : le marqueur annonce « N nouveaux messages ».
  const countUnreadFrom = (nodes: readonly CommentNode[]): number =>
    nodes.reduce((n, node) => n + (node.unread ? 1 : 0) + countUnreadFrom(node.replies), 0);
  const totalUnread = countUnreadFrom(tree);

  const walk = (nodes: readonly CommentNode[], realDepth: number, parent: CommentNode | null) => {
    for (const node of nodes) {
      const day = dayKey(node.createdAt, options.timeZone);

      /**
       * Le séparateur de jour n'est posé qu'à la RACINE — et c'est la correction d'un défaut
       * mesuré, pas une économie.
       *
       * Le fil est un arbre parcouru en profondeur : ce parcours n'est pas chronologique, il
       * revient en arrière à chaque fois qu'on remonte d'une branche. Sur le fil de démonstration
       * (trois racines du 23 septembre, deux réponses du 28), poser un séparateur à chaque
       * changement de jour en produisait CINQ, dont trois disant « 23 septembre » — une
       * alternance qui n'informe de rien. Seul le niveau racine avance dans le temps ; c'est
       * donc le seul où un séparateur signifie quelque chose.
       *
       * La clé est ancrée sur le message qui suit. Elle était `date-${day}` : le même jour
       * revenant plusieurs fois, plusieurs lignes portaient la MÊME clé React, et les
       * séparateurs s'accumulaient à l'écran à chaque repli ou dépli d'une branche. Ancrée
       * ainsi, elle est unique par construction et non par chance — même si les horodatages
       * arrivent dans le désordre.
       */
      if (realDepth === 0 && day !== lastDay) {
        rows.push({ kind: "date", key: `date-${day}-${node.id}`, at: node.createdAt });
        lastDay = day;
        previous = null;               // un séparateur rompt toujours le groupement
      }

      /** Aucun séparateur ne précède ce message à l'écran : il porte sa date lui-même. */
      const dayShift = day !== lastDay;

      if (!unreadPlaced && node.unread && totalUnread > 0) {
        rows.push({ kind: "unread", key: "unread-marker", count: totalUnread });
        unreadPlaced = true;
        previous = null;               // le marqueur aussi rompt le groupement
      }

      const depth = Math.min(realDepth, maxDepth);
      const grouped =
        // Une racine ouvre un SUJET : elle n'est jamais fondue dans le bloc précédent. Le
        // groupement vient de Discord, dont le fil est plat ; appliqué à un arbre, il collait
        // « Second sujet, sans rapport » sous la racine d'avant, sans en-tête.
        realDepth > 0 &&
        previous !== null &&
        previous.authorId === node.author.id &&
        previous.depth === depth &&
        // Deux messages de jours différents ne se fondent jamais l'un dans l'autre : le second
        // doit montrer sa date, ce qu'une ligne groupée ne fait pas. La fenêtre de groupement
        // l'interdit déjà de fait, mais par un réglage — ici c'est une règle.
        previous.day === day &&
        node.createdAt - previous.at <= groupWindow &&
        node.createdAt >= previous.at;   // un message antérieur ne se groupe pas

      // Au-delà du retrait maximal, on cite le parent plutôt que d'indenter davantage.
      const contextParent = realDepth > maxDepth && parent
        ? { id: parent.id, author: parent.author.name, excerpt: excerpt(parent.text) }
        : null;

      rows.push({ kind: "message", key: node.id, node, grouped, depth, realDepth, contextParent, dayShift });
      previous = { authorId: node.author.id, at: node.createdAt, depth, day };

      if (node.replies.length > 0 && !collapsed.has(node.id)) {
        walk(node.replies, realDepth + 1, node);
      }
    }
  };

  walk(tree, 0, null);
  return rows;
}

/**
 * Une branche doit-elle rester dépliée malgré un repli automatique ?
 * Oui si elle contient un NON-LU : replier ce qu'on vient de signaler comme nouveau serait
 * contradictoire.
 *
 * Une mention de soi n'y suffit plus (28/09). Tant qu'elle n'est pas vue, elle est non lue, et
 * la règle la couvre ; une fois vue, elle cesse d'être une nouvelle — exactement comme son fond
 * disparaît de la ligne. La garder ouverte pour toujours contredisait ce fond.
 */
export function shouldStayExpanded(node: CommentNode): boolean {
  const concerne = (n: CommentNode): boolean => n.unread || n.replies.some(concerne);
  return node.replies.some(concerne);
}
