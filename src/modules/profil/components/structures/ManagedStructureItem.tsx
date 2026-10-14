import { useQueryClient } from "@tanstack/react-query";
import { EyeOff, Plus } from "lucide-react";
import { Suspense, useMemo, useRef, useState, type Ref } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { lazy } from "vite-preload";
import type { Organization, SearchEntity } from "@communecter/cocolight-api-client";

import { AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";
import { getEntityIcon } from "@/lib/entityIcons";
import { cn } from "@/lib/utils";
import { buildFinderDefaultValues, finderFieldName } from "@/modules/coform/utils/finderPrefill";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants/queryKeys";
import { statusKey } from "@/modules/search/lib/coformAnswer";

import { useManagedAnswers } from "../../hooks/useManagedAnswers";
import { useReturnFocus } from "../../hooks/useReturnFocus";
import {
  ANSWER_OWNER_FIELDS,
  managedAnswersParams,
  slotsSummaryLabels,
  structureAnswersFilters,
  structureModeration,
  summarizeSlots,
} from "../../lib/managedStructures";
import type { StructuresTabProps } from "../../schema";
import { TOUCH_BUTTON } from "./constants";
import { CreneauRow } from "./CreneauRow";
import { GroupTrigger } from "./GroupTrigger";
import { RetryAlert } from "./RetryAlert";
import { SlotDetail } from "./SlotDetail";
import { STATUS_TONE } from "./statusTone";

// Monté au premier « Ajouter un créneau » seulement (et préchauffé au survol/focus du bouton) : le
// chunk coform n'est jamais tiré par qui consulte ses structures sans rien déposer.
const CoFormModal = lazy(() => import("@/modules/coform/components/CoFormModal"));

/** Logo de la structure — l'icône de type en repli, comme `EntityCard`, si l'image manque ou casse. */
function StructureLogo({ src }: { src?: string }) {
  const [ko, setKo] = useState(false);
  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
      {src && !ko ? (
        <OptimizedImage src={src} alt="" width={40} className="size-full object-cover" onError={() => setKo(true)} />
      ) : (
        // Teinte neutre du site, pas la couleur de type de `getEntityIcon` (hors palette).
        getEntityIcon("organizations", { className: "size-5 text-muted-foreground" })
      )}
    </span>
  );
}

interface ManagedStructureItemProps {
  structure: Organization;
  structureId: string;
  userId: string;
  answers: StructuresTabProps["answers"];
  /** Champ de modération des structures (`structureStatusField` de l'onglet) ; absent = rien d'affiché. */
  structureStatusField?: string;
  /** Dépliée : ses créneaux se chargent. Repliée, la requête dort (le cache reste affiché). */
  isOpen: boolean;
  /** Après un ajout : l'onglet déplie la structure pour montrer le créneau déposé. */
  onAdded: (structureId: string) => void;
  /** Sentinelle du défilement infini de la liste des structures. */
  itemRef?: (node: HTMLDivElement | null) => void;
}

/**
 * Une structure administrée : en-tête (logo, nom, statut de modération s'il n'est pas « Validé »,
 * commune et compteurs par statut, actions) et, dépliée, ses créneaux. « Ajouter un créneau » ouvre
 * le formulaire avec le champ structure PRÉREMPLI et MASQUÉ — la structure est déjà dite par
 * l'endroit d'où l'on dépose.
 */
export function ManagedStructureItem({
  structure,
  structureId,
  userId,
  answers,
  structureStatusField,
  isOpen,
  onAdded,
  itemRef,
}: ManagedStructureItemProps) {
  const t = useT("modules/profil");
  const queryClient = useQueryClient();
  const { name: nom, slug, profilImageUrl, address } = structure.serverData;
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<SearchEntity | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Le bouton « Ajouter » de l'EN-TÊTE, toujours présent — à la différence de celui de l'état vide.
  const headerAddRef = useRef<HTMLButtonElement>(null);

  // `user` projeté : le détail reconnaît aussi l'AUTEUR d'un créneau (`canEditCoformAnswer`), dans
  // toutes les listes de l'onglet. Le préfixe de cache, PARTAGÉ par les listes du compte, est posé
  // par `useManagedAnswers` ; la structure est dans les filtres, donc dans la clé.
  const baseParams = useMemo(
    () => managedAnswersParams(structureAnswersFilters(answers.formId, answers.structureFinderPath, structureId), ANSWER_OWNER_FIELDS),
    [answers.formId, answers.structureFinderPath, structureId],
  );
  const { data: pages, rows: creneaux, isLoading, error, refetch, lastItemRef, hasNextPage } = useManagedAnswers(
    userId,
    baseParams,
    isOpen,
  );
  // Repli du focus : le déclencheur de la structure, toujours là — une ligne peut quitter la liste au
  // rechargement qui suit une modification (le créneau change de structure).
  const { openerRef, returnFocus } = useReturnFocus([triggerRef], creneaux);

  // En-tête : la commune, puis — une fois les créneaux chargés au moins une fois — leur résumé.
  const resumeCreneaux = pages ? summarizeSlots(creneaux.map((c) => statusKey(c.answer.status)), !hasNextPage) : null;
  const resume = [address?.addressLocality, ...slotsSummaryLabels(resumeCreneaux, t)].filter(Boolean).join(" · ");

  // Statut de modération de la STRUCTURE, signalé hors « Validé » seulement : l'exception est ce qui
  // compte (« pourquoi ma structure n'apparaît-elle pas sur le site ? ») ; une pastille « Validée »
  // sur presque chaque en-tête ne serait que du bruit.
  const moderation = structureStatusField ? structureModeration(structure.serverData, structureStatusField) : null;
  const ton = moderation ? STATUS_TONE[moderation] : null;

  // Figés pour la durée de l'ouverture : `SmartCoForm` normalise `defaultValues` par référence.
  const defaultValues = useMemo(
    () => buildFinderDefaultValues(answers.structureFinderPath, { id: structureId, type: "organizations", name: nom }),
    [answers.structureFinderPath, structureId, nom],
  );
  const hiddenFields = useMemo(() => [finderFieldName(answers.structureFinderPath)], [answers.structureFinderPath]);

  const handleAdded = () => {
    // Le préfixe partagé marque périmées toutes les listes gérées du compte ; seules les actives se
    // rechargent, dont celle-ci, où le créneau se montre « En attente ». Rien de public à rafraîchir :
    // un créneau déposé n'est publié qu'à sa validation, qui invalide alors les listes publiques.
    void queryClient.invalidateQueries({
      queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_QUERY_KEYS.MANAGED_ANSWERS_PREFIX(userId)),
    });
    onAdded(structureId);
    // Ouvert depuis l'état vide, le bouton disparaîtra quand la liste arrivera : le focus ira au
    // bouton de l'en-tête, qui reste.
    openerRef.current = headerAddRef.current;
    toast.success(t("StructuresTab.added"));
  };

  /** Deux exemplaires (en-tête, état vide) : seul celui de l'en-tête porte la ref, toujours monté. */
  const ajouter = (ref?: Ref<HTMLButtonElement>) => (
    <Button
      ref={ref}
      size="sm"
      className={TOUCH_BUTTON}
      onClick={(event) => {
        openerRef.current = event.currentTarget;
        setAdding(true);
      }}
      onPointerEnter={() => void CoFormModal.preload()}
      onFocus={() => void CoFormModal.preload()}
      aria-label={t("StructuresTab.addFor", undefined, { structure: nom })}
    >
      <Plus aria-hidden="true" className="size-4" />
      {t("StructuresTab.add")}
    </Button>
  );

  return (
    <AccordionItem value={structureId} ref={itemRef} className="rounded-xl border border-border bg-card last:border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 sm:p-4">
        <GroupTrigger
          triggerRef={triggerRef}
          tile={<StructureLogo src={profilImageUrl} />}
          title={nom}
          badge={
            moderation && ton ? (
              // `font-sans` : la pastille est dans le h3, que le site force en police de titre.
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-sans text-xs font-medium",
                  ton.pill,
                )}
              >
                <ton.Icon aria-hidden="true" className="size-3.5" />
                {t(`StructuresTab.structureStatus.${moderation}`)}
              </span>
            ) : undefined
          }
          summary={resume || undefined}
        />
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          {slug && (
            <Button asChild variant="ghost" size="sm" className={TOUCH_BUTTON}>
              <Link to={`/profil/${slug}`} aria-label={t("StructuresTab.viewProfileFor", undefined, { structure: nom })}>
                {t("StructuresTab.viewProfile")}
              </Link>
            </Button>
          )}
          {ajouter(headerAddRef)}
        </div>
      </div>

      {/* `pt-1` : l'anneau de focus de la première ligne n'est plus rogné par le contenu de l'accordéon. */}
      <AccordionContent className="px-3 pt-1 sm:px-4">
        {/* L'explication du statut, avant les créneaux : elle n'en dépend pas. Un <p> et non `Alert`,
            dont le `role="alert"` ferait annoncer une information statique à chaque dépliage. */}
        {moderation && (
          <div className="mb-3 flex max-w-prose items-start gap-2 rounded-lg bg-muted px-3 py-2">
            <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {/* Couleur posée sur le <p> lui-même : la base de certains sites force `p { text-foreground }`. */}
            <p className="text-sm text-muted-foreground">{t(`StructuresTab.structureStatusHelp.${moderation}`)}</p>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error ? (
          <RetryAlert
            message={t("StructuresTab.slotsError", undefined, { structure: nom })}
            onRetry={() => void refetch()}
            retryLabel={t("StructuresTab.retryFor", undefined, { structure: nom })}
          />
        ) : creneaux.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("StructuresTab.noSlots")}
            {ajouter()}
          </div>
        ) : (
          <ul aria-label={t("StructuresTab.slotsLabel", undefined, { structure: nom })} className="space-y-2">
            {creneaux.map(({ item, answer }, i) => (
              <li key={item.id ?? i} ref={i === creneaux.length - 1 ? lastItemRef : undefined}>
                <CreneauRow
                  answer={answer}
                  onOpen={(opener) => {
                    openerRef.current = opener;
                    setDetail(item);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </AccordionContent>

      {/* Suspense LOCAL : le formulaire est chargé à la demande ; sans lui, le premier clic suspendait
          jusqu'à la frontière du profil, qui disparaissait derrière un spinner. */}
      {adding && (
        <Suspense fallback={<span role="status" className="sr-only">{t("StructuresTab.addLoading")}</span>}>
          <CoFormModal
            formId={answers.formId}
            open={adding}
            onOpenChange={(open) => {
              setAdding(open);
              if (!open) returnFocus();
            }}
            // Le champ structure est masqué : le titre la nomme, pour qu'on sache où l'on dépose.
            title={t("StructuresTab.addTitle", undefined, { structure: nom })}
            defaultValues={defaultValues}
            hiddenFields={hiddenFields}
            // Clé du brouillon PAR structure : sans elle, un brouillon commencé pour une autre
            // structure serait proposé ici et changerait en silence la valeur du champ masqué.
            elementId={structureId}
            elementType="organizations"
            onAfterSubmit={handleAdded}
          />
        </Suspense>
      )}

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
  );
}
