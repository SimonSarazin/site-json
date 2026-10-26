import { useMemo, useState } from "react";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { CARRIER_NONE, carrierKey } from "../../lib/discussions";
import { compactWhen } from "../../lib/formatWhen";
import { initialesDe } from "../../lib/initiales";
import { motsDeRequete } from "../../lib/searchDiscussions";
import { Surligne } from "./Surligne";
import { PANEL_GROUP_LABEL, PANEL_LIST, PANEL_NAME, PANEL_ROW, PANEL_ROW_BAR } from "./rowStyles";
import type { DiscussionCarrier } from "../../types";

export interface CarrierRailProps {
  readonly carriers: readonly DiscussionCarrier[];
  /** Clé du porteur sélectionné (`type:id`, ou `none` pour les fils orphelins). */
  readonly selected: string | null;
  readonly onSelect: (carrier: DiscussionCarrier) => void;
  readonly isLoading?: boolean;
  /**
   * Le rail est plié : le nom n'est plus lisible, une infobulle le rend au survol.
   *
   * ⚠️ Elle DOIT être portalisée — c'est le rôle du `Tooltip` de Radix. Une infobulle posée
   * en `position: absolute` dans le rail est rendue mais reste INVISIBLE : le rail défile
   * (`overflow-y: auto`) et le panneau est en `overflow: hidden`, donc elle est rognée.
   * Mesuré sur la maquette : opacité 1, texte correct, rien à l'écran.
   */
  readonly collapsed?: boolean;
  /**
   * La requête de recherche en cours, telle qu'elle est tapée.
   *
   * La colonne ne filtre PAS : le panneau lui passe déjà la liste réduite. Elle s'en sert pour
   * marquer les correspondances, déplier d'office la section « Sans discussion » et dire
   * ce qui ne correspond pas plutôt que « aucun espace ».
   */
  readonly query?: string;
  /** La liste des espaces sans discussion a été coupée côté serveur : on le DIT. */
  readonly truncated?: boolean;
  readonly className?: string;
}

/**
 * Première colonne : les porteurs.
 *
 * Elle n'affiche QUE ce que le mode `rail` rend — nom, image, compteurs — et jamais un titre
 * de fil : c'est ce qui permet au serveur de ne charger que ce périmètre.
 *
 * Elle ne parle pas aux autres colonnes : elle écrit l'URL, et la colonne suivante se recharge
 * seule parce que sa clé de requête a changé.
 *
 * **Une liste, pas une pile de pastilles** : rangées pleine largeur séparées d'un filet, comme
 * la liste de salons de Discord et comme `NotificationRow`, qui est déjà l'idiome du dépôt
 * pour une liste dense bornée.
 */
export function CarrierRail({
  carriers, selected, onSelect, isLoading, collapsed = false, query, truncated, className,
}: CarrierRailProps) {
  const t = useT("modules/comment");
  // Les dates suivent la langue de l'interface — elles sortaient toujours en français.
  const { currentLocale } = useLocalization();
  /**
   * Le pli de la section « sans discussion » est un état de SESSION, volontairement non
   * persisté : on la déplie pour aller lancer une discussion, après quoi le porteur rejoint
   * la liste active. Persister ce pli le figerait sur un état qui n'a plus lieu d'être.
   */
  const [emptyOpen, setEmptyOpen] = useState(false);

  const filtre = (query ?? "").trim() !== "";
  const mots = useMemo(() => motsDeRequete(query ?? ""), [query]);

  /**
   * Pendant un filtre, la section est dépliée D'OFFICE — et ce n'est pas un confort.
   *
   * Sur un compte à 257 espaces, 253 sont derrière ce pli : un filtre qui ne le traverserait
   * pas répondrait « aucun espace » sur exactement ce que l'utilisateur cherche. C'est une
   * dérivation pure : `emptyOpen` garde sa valeur, on retrouve son pli en vidant la requête.
   */
  const ouvert = filtre || emptyOpen;

  if (isLoading) {
    // Squelette calé sur les paddings RÉELS de la rangée : sinon la liste saute au
    // chargement, ce qui se voit d'autant plus que le rail est étroit.
    return (
      <div className={cn("flex flex-col", className)} aria-busy="true">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (carriers.length === 0) {
    // « Aucun espace avec des discussions » serait FAUX sous un filtre : il y en a, ils ne
    // correspondent simplement pas. Deux situations, deux phrases.
    return (
      <p className={cn("text-muted-foreground p-4 text-sm", className)}>
        {String(filtre ? t("panel.noHolderMatch", undefined, { query }) : t("panel.noHolder"))}
      </p>
    );
  }

  const rangee = (carrier: DiscussionCarrier) => {
    const key = carrierKey(carrier);
    const isSelected = key === selected;
    const orphans = key === CARRIER_NONE;
    const when = carrier.last === null ? null : compactWhen(carrier.last, { locale: currentLocale });
    const whenLabel = when === null ? null : when.key === null ? when.text : String(t(`dates.${when.key}`));
    const name = orphans ? String(t("panel.noCarrier")) : (carrier.name ?? String(t("panel.untitled")));
    // Le nom accessible, phrase ENTIÈRE par langue : coller « nom, N non lus » imposait l'ordre
    // et la ponctuation du français à toutes les langues.
    const nomAccessible = carrier.unread > 0
      ? String(t("panel.carrierUnread", undefined, { name, count: carrier.unread }))
      : name;
    const sub = carrier.threads === 0
      ? String(t("panel.startThread"))
      : String(t("panel.threadCount", undefined, { count: carrier.threads }));

    const bouton = (
      <button
        type="button"
        onClick={() => onSelect(carrier)}
        aria-current={isSelected ? "true" : undefined}
        /* Le nom reste dans le nom accessible même quand le rail est plié et que le libellé
           disparaît à l'œil — sans quoi la rangée n'aurait tout simplement plus de nom. */
        title={name}
        /* Les non-lus vont DANS le nom accessible : l'`aria-label` remplace tout le contenu du
           bouton, pastille comprise — le lecteur d'écran ne les annonçait jamais. */
        aria-label={nomAccessible}
        data-carrier-row
        data-selected={isSelected}
        data-unread={carrier.unread > 0}
        data-empty={carrier.threads === 0}
        className={cn(PANEL_ROW, PANEL_ROW_BAR, "items-center gap-2.5")}
      >
        {/* `rounded-full` et non `rounded-md` : sur les 4 sites sans `theme.borderRadius`,
            `--radius` est indéfini et un avatar « arrondi » sortirait carré (B5). */}
        <Avatar className="bg-card size-8 shrink-0 rounded-full">
          {carrier.image && <AvatarImage src={carrier.image} alt="" className="object-cover" />}
          <AvatarFallback className="bg-muted text-muted-foreground rounded-full text-xs font-semibold">
            {orphans ? <MessagesSquare className="size-4" aria-hidden /> : initialesDe(carrier.name)}
          </AvatarFallback>
        </Avatar>

        <span className="min-w-0 flex-1" data-carrier-label>
          <span className={cn("block truncate", PANEL_NAME)}>
            <Surligne texte={name} mots={mots} />
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {sub}
            {whenLabel && <> · {whenLabel}</>}
          </span>
        </span>

        {/* `shrink-0` : sans lui la pastille se comprime face à un nom long. `min-w-5`
            aligne verticalement les pastilles d'une liste, à un ou deux chiffres. */}
        {carrier.unread > 0 && (
          <span
            data-unread-badge
            aria-hidden="true"
            className="bg-primary text-primary-foreground min-w-5 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[0.6875rem] leading-none font-semibold tabular-nums"
          >
            {carrier.unread > 99 ? "99+" : carrier.unread}
          </span>
        )}
      </button>
    );

    return (
      <li key={key}>
        {collapsed
          ? (
            <Tooltip>
              <TooltipTrigger asChild>{bouton}</TooltipTrigger>
              <TooltipContent side="right">{name}</TooltipContent>
            </Tooltip>
          )
          : bouton}
      </li>
    );
  };

  /**
   * Trier ne suffit pas : un compte à 218 projets verrait cinq porteurs actifs noyés sous
   * 213 vides. Les porteurs où personne n'a encore écrit vont donc dans une section repliée,
   * d'où l'on déplie pour aller lancer la discussion. Tout est déjà dans la réponse du
   * serveur : le pli ne coûte aucune requête.
   */
  const actifs = carriers.filter(c => c.threads > 0);
  const vierges = carriers.filter(c => c.threads === 0);

  return (
    <ScrollArea className={className}>
      {actifs.length > 0 && (
        <ul className={PANEL_LIST} aria-label={String(t("panel.holders"))}>
          {actifs.map(rangee)}
        </ul>
      )}

      {vierges.length > 0 && (
        <div data-empty-group data-open={ouvert} className="border-t">
          {/* Le compte est celui des espaces RETENUS, jamais le total : « Sans discussion
              (253) » au-dessus de deux rangées visibles serait un mensonge. Il tombe juste
              tout seul, la liste arrivant déjà filtrée du panneau. */}
          {filtre
            /* Sous filtre, la section ne se replie plus : un bouton dont le clic n'a aucun
               effet visible est un bouton mort. On rend le même libellé, sans interaction. */
            ? (
              <p className={PANEL_GROUP_LABEL}>
                <span data-carrier-label className="truncate">
                  {String(t("panel.withoutThread", undefined, { count: vierges.length }))}
                </span>
              </p>
            )
            : (
              <button
                type="button"
                aria-expanded={emptyOpen}
                onClick={() => setEmptyOpen(o => !o)}
                title={String(t("panel.withoutThread", undefined, { count: vierges.length }))}
                className={PANEL_GROUP_LABEL}
              >
                <ChevronRight
                  className={cn("size-3 shrink-0 transition-transform", emptyOpen && "rotate-90")}
                  aria-hidden
                />
                {/* Même accroche que le nom d'un porteur : le rail plié les masque ensemble. */}
                <span data-carrier-label className="truncate">
                  {String(t("panel.withoutThread", undefined, { count: vierges.length }))}
                </span>
              </button>
            )}
          {/* Le contenu reste MONTÉ : c'est ce qui permet d'animer sa hauteur. `inert` le
              rend alors réellement inerte quand il est replié — hors tabulation et hors
              arbre d'accessibilité — là où `visibility: hidden` seul ne le garantit qu'en
              présence du CSS. */}
          <div className="comment-collapsible" data-open={ouvert} inert={!ouvert}>
            <div>
              <ul className={PANEL_LIST}>{vierges.map(rangee)}</ul>
            </div>
          </div>
        </div>
      )}

      {/* La liste des espaces vierges a été coupée côté serveur. Sans filtre, l'information
          est secondaire ; sous filtre, elle est décisive — « aucun résultat » ne doit pas
          être confondu avec « le serveur n'a pas tout envoyé ». */}
      {truncated && filtre && (
        <p data-search-partial className="text-muted-foreground border-t px-4 py-3 text-xs">
          {String(t("panel.searchPartial"))}
        </p>
      )}
    </ScrollArea>
  );
}
