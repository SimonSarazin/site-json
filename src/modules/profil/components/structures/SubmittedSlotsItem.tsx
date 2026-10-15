import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { useT } from "@/hooks/useT";
import { finderFieldName } from "@/modules/coform/utils/finderPrefill";
import { getAnswerCitedStructures, statusKey } from "@/modules/search/lib/coformAnswer";

import { useManagedAnswers } from "../../hooks/useManagedAnswers";
import { useReturnFocus } from "../../hooks/useReturnFocus";
import {
  ANSWER_OWNER_FIELDS,
  managedAnswersParams,
  slotsSummaryLabels,
  submittedAnswersFilters,
  submittedSlotStructures,
  summarizeSlots,
} from "../../lib/managedStructures";
import type { StructuresTabProps } from "../../schema";
import { CreneauRow } from "./CreneauRow";
import { GroupTrigger } from "./GroupTrigger";
import { RetryAlert } from "./RetryAlert";
import { SlotDetail } from "./SlotDetail";

/** Valeur de l'unique item de l'accordéon du groupe. */
const GROUPE = "submitted-slots";

interface SubmittedSlotsItemProps {
  userId: string;
  answers: StructuresTabProps["answers"];
  /** Structures listées au-dessus : leurs créneaux y sont déjà. Exclusion LOCALE — la clé de requête
   *  ne dépend pas de la liste des structures, qui arrive par pages. */
  listedStructureIds: ReadonlySet<string>;
  /** L'onglet liste-t-il au moins une structure ? « Mes autres créneaux », sinon « Mes créneaux ». */
  afterStructures: boolean;
  /** Repli du focus HORS du groupe (le titre de l'onglet) : le groupe disparaît quand sa dernière
   *  ligne passe sous une structure listée. */
  focusFallbackRef: RefObject<HTMLElement | null>;
}

/**
 * Les créneaux que le compte a DÉPOSÉS hors des structures qu'il administre — sous une structure
 * qu'il ne gère pas, ou sans structure —, tous statuts : sans ce groupe, son créneau en attente
 * n'apparaissait nulle part. Chaque ligne dit sa structure. Pas de bouton « Ajouter » : un créneau
 * s'ajoute depuis SA structure. Rendu seulement s'il a du contenu : la plupart des comptes n'ont
 * rien ici, un squelette apparaîtrait pour disparaître.
 *
 * Le serveur ne montre à l'auteur ses créneaux non validés que si la recherche est bornée à lui
 * (`{form, user: <moi>}`, hook SSBE `isBoundToOwnAnswers`) ; `user` est projeté pour que le détail
 * reconnaisse l'auteur (« Modifier », `canEditCoformAnswer`).
 */
export function SubmittedSlotsItem({ userId, answers, listedStructureIds, afterStructures, focusFallbackRef }: SubmittedSlotsItemProps) {
  const t = useT("modules/profil");
  const [ouvert, setOuvert] = useState<string[]>([GROUPE]);
  const [detail, setDetail] = useState<SearchEntity | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const baseParams = useMemo(
    () => managedAnswersParams(submittedAnswersFilters(answers.formId, userId), ANSWER_OWNER_FIELDS),
    [answers.formId, userId],
  );
  const { data: pages, rows, isLoading, error, refetch, lastItemRef, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useManagedAnswers(userId, baseParams, true);
  const { openerRef, returnFocus } = useReturnFocus([triggerRef, focusFallbackRef], rows);

  const finderKey = finderFieldName(answers.structureFinderPath);
  const sansNom = t("StructuresTab.submitted.unnamedStructure");
  const creneaux = useMemo(
    () =>
      rows.flatMap(({ item, serverData, answer }) => {
        const place = submittedSlotStructures(
          getAnswerCitedStructures(serverData, { finderKey }),
          answer.structure.name,
          listedStructureIds,
        );
        if (!place) return [];
        // Des structures citées mais sans nom restent des structures : un libellé, pas « Sans structure ».
        const structureNames = place.names.length > 0 ? place.names : place.count > 0 ? [sansNom] : [];
        return [{ item, answer, structureNames }];
      }),
    [rows, finderKey, listedStructureIds, sansNom],
  );

  // Page entièrement rangée sous des structures listées alors qu'une autre suit : sans ligne, pas de
  // sentinelle de défilement — la charger avant de conclure que le groupe est vide. Jamais après un
  // échec : `hasNextPage` resterait vrai et l'effet relancerait la requête en boucle.
  useEffect(() => {
    if (!error && creneaux.length === 0 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [error, creneaux.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return null;
  if (error) {
    return (
      <RetryAlert
        message={t("StructuresTab.submitted.loadError")}
        onRetry={() => void refetch()}
        retryLabel={t("StructuresTab.submitted.retryFor")}
      />
    );
  }
  if (creneaux.length === 0) return null;

  const titre = t(afterStructures ? "StructuresTab.submitted.title" : "StructuresTab.submitted.titleAlone");
  const resume = slotsSummaryLabels(
    pages ? summarizeSlots(creneaux.map((c) => statusKey(c.answer.status)), !hasNextPage) : null,
    t,
  ).join(" · ");

  return (
    <Accordion type="multiple" value={ouvert} onValueChange={setOuvert}>
      <AccordionItem value={GROUPE} className="rounded-xl border border-border bg-card last:border-b">
        <div className="flex items-center gap-3 p-3 sm:p-4">
          <GroupTrigger
            triggerRef={triggerRef}
            tile={
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-muted">
                <CalendarDays className="size-5 text-muted-foreground" />
              </span>
            }
            title={titre}
            summary={resume || undefined}
          />
        </div>
        <AccordionContent className="space-y-3 px-3 pt-1 sm:px-4">
          <p className="max-w-prose text-sm text-muted-foreground">{t("StructuresTab.submitted.help")}</p>
          <ul
            aria-label={t(afterStructures ? "StructuresTab.submitted.label" : "StructuresTab.submitted.labelAlone")}
            className="space-y-2"
          >
            {creneaux.map(({ item, answer, structureNames }, i) => (
              <li key={item.id ?? i} ref={i === creneaux.length - 1 ? lastItemRef : undefined}>
                <CreneauRow
                  answer={answer}
                  structureNames={structureNames}
                  onOpen={(opener) => {
                    openerRef.current = opener;
                    setDetail(item);
                  }}
                />
              </li>
            ))}
          </ul>
        </AccordionContent>
        {detail && (
          <SlotDetail
            item={detail}
            editable={!!answers.editButton}
            onClose={() => {
              setDetail(null);
              returnFocus();
            }}
          />
        )}
      </AccordionItem>
    </Accordion>
  );
}
