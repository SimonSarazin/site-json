import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode, Ref } from "react";

interface GroupTriggerProps {
  /** Tuile de 40 px à gauche : logo de la structure, ou icône du groupe. */
  tile: ReactNode;
  title: string;
  /** Pastille à côté du titre (statut d'une structure non validée). Dans le déclencheur : son mot
   *  fait partie du nom accessible. */
  badge?: ReactNode;
  /** Ligne sous le titre : commune, résumé des créneaux. */
  summary?: string;
  triggerRef?: Ref<HTMLButtonElement>;
}

/**
 * Déclencheur d'un groupe de l'onglet « Structures » — une structure, ou les créneaux déposés
 * ailleurs : tuile, titre, pastille éventuelle, résumé, chevron. Le Header Radix rend un h3 (h2 =
 * l'onglet). Les actions restent HORS du déclencheur, chez l'appelant : un bouton dans un bouton
 * n'est ni valide ni atteignable au clavier.
 */
export function GroupTrigger({ tile, title, badge, summary, triggerRef }: GroupTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex min-w-0 flex-1">
      <AccordionPrimitive.Trigger
        ref={triggerRef}
        className="group flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tile}
        <span className="min-w-0">
          {/* Sur mobile, un nom long prend sa ligne et la pastille passe dessous. */}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* Deux lignes plutôt qu'une coupée : sur mobile les actions passent dessous, la place
                existe, et un nom tronqué n'avait aucun moyen d'être lu en entier. */}
            <span className="line-clamp-2 min-w-0 break-words text-base font-semibold text-foreground group-hover:underline">
              {title}
            </span>
            {badge}
          </span>
          {/* `font-sans` : le Header est un h3, que le site force en police de titre. */}
          {summary && <span className="block truncate font-sans text-sm font-normal text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}
