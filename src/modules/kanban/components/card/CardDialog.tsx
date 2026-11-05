import { useEffect, useId, useRef, useState } from "react";
import { Archive } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { resolveColumnTitle } from "@/modules/kanban/components/board/kanbanDnd";
import { PriorityDot } from "@/modules/kanban/components/board/PriorityDot";
import { DangerNotice, FailureNotice } from "@/modules/kanban/components/ui/FailureNotice";
import { Field } from "@/modules/kanban/components/ui/Field";
import { fieldDescribedBy } from "@/modules/kanban/components/ui/fieldIds";
import { SELECT_CLASS } from "@/modules/kanban/components/ui/fieldStyles";
import { useCardDetail } from "@/modules/kanban/hooks/useCardDetail";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import { dateZoneFor, hasMilestones, linkParentType } from "@/modules/kanban/lib/boardSource";
import { isCardDone } from "@/modules/kanban/lib/boardStats";
import { formatDateTime, reconcileDateInput, toDateInputValue } from "@/modules/kanban/lib/dates";
import { kanbanErrorField, kanbanErrorText } from "@/modules/kanban/lib/kanbanErrors";
import { formatAmount, formatDuration, parseNumberInput } from "@/modules/kanban/lib/measures";
import { milestoneChoices } from "@/modules/kanban/lib/milestones";
import { parsePriorityInput, PRIORITY_ORDER } from "@/modules/kanban/lib/priority";
import { tagSuggestions } from "@/modules/kanban/lib/tags";
import type { Board, Capabilities, Card, Column, Member, Milestone } from "@/modules/kanban/types";
import { AssigneePicker } from "./AssigneePicker";
import { CardCommentThread } from "./CardCommentThread";
import {
  buildCardPatch,
  can,
  cardDraftFromCard,
  cardFieldLimits,
  cardFieldOfServerField,
  cardFormErrorValues,
  firstInvalidCardField,
  isCardFormDirty,
  validateCardForm,
  type CardFormDraft,
  type CardFormErrors,
  type CardFormField,
  type CardUpdatePatch,
} from "./cardForm";
import { ChecklistEditor } from "./ChecklistEditor";
import { DueDateField } from "./DueDateField";
import { TagsEditor } from "./TagsEditor";

export interface CardDialogProps {
  /** Carte ouverte, lue dans l'instantané ; `null` quand il ne la porte pas (chargement, carte partie). */
  card: Card | null;
  board: Board;
  columns: readonly Column[];
  members: readonly Member[];
  capabilities: Capabilities;
  /** Jalons du projet ; toujours vide sur une organisation (D22). */
  milestones: readonly Milestone[];
  currentUserId: string | null;
  /** Le tableau se charge encore : une carte absente n'est pas (encore) une carte partie. */
  isLoading: boolean;
  /** Fermeture : la fiche est une ROUTE, la fermer quitte l'adresse de la carte. */
  onClose: () => void;
  onSave: (patch: CardUpdatePatch) => Promise<unknown>;
  /**
   * Retrait du tableau sans destruction (`card/archive`), proposé si `canArchiveCards`. OPTIMISTE,
   * comme depuis le tableau : la fiche se ferme aussitôt, un refus est annoncé par la notification
   * de la mutation, qui remet la carte en place. Attendre la réponse laissait la fiche montrer une
   * carte déjà retirée du tableau.
   */
  onArchive?: () => void;
  /** Où rendre le focus à la fermeture : la carte dans le tableau. */
  returnFocus?: () => HTMLElement | null;
}

interface EditingState {
  cardId: string;
  /** Référence de comparaison : ce que le serveur connaît. */
  initial: CardFormDraft;
  draft: CardFormDraft;
}

type PendingAction = "close" | "archive" | null;

/** Valeur de `<option>` de « Aucun jalon » : un `milestoneId` n'est jamais vide. */
const NO_MILESTONE_VALUE = "";

/** Première commande d'un groupe de champs, cible du focus après un refus. */
const FOCUSABLE_IN_FIELD = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';

/**
 * Fiche d'une carte (lot 4), reprise de co-kanban (`components/board/CardDialog.tsx`), pour un
 * tableau RELIÉ, le seul que porte site-json (D11) : ni statut choisi (il découle de la colonne),
 * ni étiquettes du tableau (ce sont des tags libres), ni liens, ni suppression (on archive).
 *
 * Le formulaire n'envoie que ce qui a changé, avec la BASE des listes vue à l'ouverture
 * (`buildCardPatch`) : une écriture faite ailleurs pendant que la fiche est ouverte n'est pas
 * effacée. Les droits sont ceux que le serveur déclare (`capabilities`), jamais déduits ici.
 *
 * Chargée à la demande (`lazyDialogs`) : `export default`.
 */
export default function CardDialog({ card, board, columns, members, capabilities, milestones, currentUserId, isLoading, onClose, onSave, onArchive, returnFocus }: CardDialogProps) {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const formId = useId();
  const titleFieldId = useId();
  const descriptionFieldId = useId();
  const priorityFieldId = useId();
  const startFieldId = useId();
  const milestoneFieldId = useId();
  const creditsFieldId = useId();
  const timeSpentFieldId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [errors, setErrors] = useState<CardFormErrors>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** Champ où porter le focus après un refus ; un objet neuf à chaque demande. */
  const [focusRequest, setFocusRequest] = useState<{ field: CardFormField } | null>(null);

  /*
   * Carte qui sert de BROUILLON et de BASE de fusion : celle de l'instantané, sauf quand sa
   * checklist n'y est pas servie (`checklistTruncated`, budget de `board/get`, §11.9 E29). La fiche
   * attend alors la carte complète de `card/get` : un brouillon fait de la liste vide afficherait
   * une checklist vide, et l'enregistrer partirait d'une base fausse.
   */
  const detail = useCardDetail(board._id, card);
  const truncated = card?.checklistTruncated === true;
  const baseCard = !card || !truncated ? card : detail.data?._id === card._id ? detail.data : null;

  /*
   * Resynchronisation PENDANT le rendu (et non dans un effet) quand la fiche change de carte : un
   * effet afficherait d'abord le brouillon de la carte précédente. On ne la rejoue PAS quand la
   * même carte revient du polling : écraser le brouillon effacerait la saisie en cours.
   */
  if (baseCard && editing?.cardId !== baseCard._id) {
    const draft = cardDraftFromCard(baseCard);
    setEditing({ cardId: baseCard._id, initial: draft, draft });
    setErrors({});
    setFailure(null);
    setPending(null);
  }
  if (!card && editing !== null) setEditing(null);
  // Brouillon de LA carte affichée : pendant qu'une carte tronquée se charge, celui de la
  // précédente ne doit ni s'afficher ni la déclarer « modifiée ».
  const active = editing !== null && editing.cardId === card?._id ? editing : null;

  useEffect(() => {
    // La confirmation qui apparaît reçoit le focus : sinon la personne au clavier reste sur un
    // bouton sorti de la séquence logique.
    if (pending !== null) confirmRef.current?.focus();
  }, [pending]);

  useEffect(() => {
    /*
     * Après un refus (validation ou serveur), le PREMIER champ fautif vient au centre et prend le
     * focus : sans cela, un « Enregistrer » dont l'erreur tombe hors de la vue semble sans effet.
     * Après le rendu, pour centrer le groupe AVEC son message.
     */
    if (focusRequest === null) return;
    const group = formRef.current?.querySelector<HTMLElement>(`[data-card-field="${focusRequest.field}"]`);
    if (!group) return;
    // `scrollIntoView` manque à jsdom : appel optionnel.
    group.scrollIntoView?.({ block: "center" });
    group.querySelector<HTMLElement>(FOCUSABLE_IN_FIELD)?.focus({ preventScroll: true });
  }, [focusRequest]);

  const draft = active?.draft ?? null;
  const source = capabilities.source;
  // Type de l'élément (§12) : il décline « du projet » / « de l'organisation » et retire le jalon
  // à une organisation (D22).
  const linkType = linkParentType({ source, parentType: board.parentType });
  const milestonesAvailable = hasMilestones({ source, parentType: board.parentType });
  // Jour civil des dates : fuseau du navigateur sur un tableau relié, comme Kanban gestion.
  const zone = dateZoneFor(source);
  const limits = cardFieldLimits(source);
  const isEditor = can(capabilities, "canEditCards");
  const canEditCredits = can(capabilities, "canEditCredits");
  const isAssigned = Boolean(currentUserId && card?.assignees.includes(currentUserId));
  // Blueprint §3 : un lecteur assigné coche SA checklist, rien d'autre.
  const canEditChecklistOnly = !isEditor && isAssigned;
  const canEditAnything = isEditor || canEditChecklistOnly;
  const canArchive = onArchive !== undefined && can(capabilities, "canArchiveCards");

  const isDirty = active !== null && isCardFormDirty(active.initial, active.draft, source);

  // Jalons proposés : les ouverts, PLUS celui de la carte s'il est clos — sans quoi la liste le
  // ferait disparaître et l'enregistrement détacherait la carte sans qu'on l'ait demandé.
  const milestoneOptions = milestoneChoices(milestones, active?.initial.milestoneId ?? null);

  // Un refus du SERVEUR qui nomme son champ (`detail.field`) s'affiche SOUS ce champ ; les autres
  // restent dans le bandeau du pied.
  const failureField = failure === null ? null : cardFieldOfServerField(kanbanErrorField(failure));
  const failureText = failure === null ? null : kanbanErrorText(t, failure);
  const errorText = (field: CardFormField): string | undefined => {
    const code = errors[field];
    if (code) return t(`card.errors.${code}`, cardFormErrorValues(field, code, limits));
    return failureField === field && failureText !== null ? failureText : undefined;
  };
  const errorCount = Object.keys(errors).length;

  const column = columns.find((entry) => entry._id === card?.columnId);
  const columnTitle = column ? resolveColumnTitle(column, (key, fallback) => t(key, { defaultValue: fallback })) : t("card.noColumn");

  function setDraft(patch: Partial<CardFormDraft>) {
    setEditing((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
    setFailure(null);
  }

  function requestClose() {
    // Échap pendant une confirmation annule la confirmation ; fermer d'un geste réflexe ne jette
    // pas une saisie non enregistrée.
    if (pending !== null) {
      setPending(null);
      return;
    }
    if (isDirty) {
      setPending("close");
      return;
    }
    onClose();
  }

  async function submit() {
    if (!active || !card) return;
    // Seuls les champs qui PARTENT sont validés : un état hérité de Kanban gestion qu'on n'a pas
    // touché ne bloque rien.
    const validation = validateCardForm(active.initial, active.draft, {
      memberIds: members.map((member) => member.userId),
      labelIds: board.labels.map((label) => label.id),
      source,
      milestoneIds: milestoneOptions.map((milestone) => milestone.milestoneId),
    });
    setErrors(validation);
    const firstInvalid = firstInvalidCardField(validation);
    if (firstInvalid !== null) {
      setFailure(null);
      setFocusRequest({ field: firstInvalid });
      return;
    }

    const patch = buildCardPatch(active.initial, active.draft, source);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    setFailure(null);
    try {
      await onSave(patch);
      // Le brouillon devient la référence AVANT de fermer : rien ne reste « modifié », aucune
      // confirmation de perte ne se déclenchera pendant la fermeture.
      setEditing({ cardId: active.cardId, initial: active.draft, draft: active.draft });
      onClose();
    } catch (error) {
      setFailure(error);
      const field = cardFieldOfServerField(kanbanErrorField(error));
      if (field !== null) setFocusRequest({ field });
    } finally {
      setIsSaving(false);
    }
  }

  /** Archivage confirmé : la carte quitte le tableau (optimiste), la fiche se ferme. */
  function confirmArchive() {
    if (!onArchive) return;
    setPending(null);
    onArchive();
    onClose();
  }

  const creditsHint = draft !== null && draft.timeSpent !== null && draft.timeSpent > 0 ? t("card.timeSpentHint", { duration: formatDuration(draft.timeSpent) }) : undefined;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        // En-tête et pied FIXES, seul le corps défile : « Enregistrer », le résumé d'un refus et les
        // confirmations restent toujours en vue, même sur une longue checklist. `kanban-module` :
        // la boîte est rendue dans un PORTAIL, hors de la racine du module, et y perdait ses
        // variables (`--ck-prio-*`, `--ck-success-ink`, `--ck-warn-ink`, cf. `styles.css`).
        className="kanban-module flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          // La fiche se ferme en quittant sa route : sans cible, le focus tomberait sur `<body>`.
          const target = returnFocus?.();
          if (!target?.isConnected) return;
          event.preventDefault();
          target.focus();
        }}
      >
        <DialogHeader className="border-b border-border px-6 pt-6 pb-4 text-left">
          <DialogTitle>{t("card.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("card.context", { column: columnTitle, board: board.title })}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {card === null && !isLoading ? (
            // Lien vers une carte archivée, ou partie : le dire plutôt qu'un chargement sans fin.
            <p className="text-sm text-muted-foreground">{t("card.notFound")}</p>
          ) : card && truncated && !draft && detail.isError && !detail.isFetching ? (
            // Carte complète illisible : la cause nommée et « Réessayer » (relit `card/get`). Pendant
            // la relecture, le CHARGEMENT et non l'échec précédent (`!isFetching`).
            <div className="flex flex-col gap-4">
              <p className="text-sm text-foreground">{t("card.detailError")}</p>
              <FailureNotice
                error={detail.error}
                announce="alert"
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void detail.refetch()}>
                    {t("common.retry")}
                  </Button>
                }
              />
            </div>
          ) : !card || !draft ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <span className="sr-only">{t("common.loading")}</span>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-9 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* `noValidate` : la validation est la NÔTRE (champs envoyés seulement). Celle du
                  navigateur bloquait l'envoi sur un état hérité qu'on n'a pas touché — un montant
                  négatif venu de Kanban gestion contre `min={0}`. */}
              <form
                id={formId}
                ref={formRef}
                noValidate
                className="flex flex-col gap-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <div data-card-field="title">
                  <Field label={t("card.fields.title")} htmlFor={titleFieldId} required={isEditor} error={errorText("title")}>
                    {isEditor ? (
                      <Input
                        id={titleFieldId}
                        value={draft.title}
                        maxLength={limits.title}
                        required
                        aria-invalid={errorText("title") !== undefined || undefined}
                        aria-describedby={fieldDescribedBy(titleFieldId, { error: errorText("title") })}
                        onChange={(event) => setDraft({ title: event.target.value })}
                        className="h-11 text-base font-semibold md:text-base"
                      />
                    ) : (
                      <p id={titleFieldId} className="text-base font-semibold break-words text-foreground">
                        {draft.title}
                      </p>
                    )}
                  </Field>
                </div>

                <div data-card-field="description">
                  <Field label={t("card.fields.description")} htmlFor={descriptionFieldId} error={errorText("description")}>
                    {isEditor ? (
                      <Textarea
                        id={descriptionFieldId}
                        value={draft.description}
                        rows={4}
                        maxLength={limits.description}
                        aria-invalid={errorText("description") !== undefined || undefined}
                        aria-describedby={fieldDescribedBy(descriptionFieldId, { error: errorText("description") })}
                        onChange={(event) => setDraft({ description: event.target.value })}
                        className="max-h-80 resize-y"
                      />
                    ) : (
                      // Texte brut : aucune interpolation dans le DOM.
                      <p id={descriptionFieldId} className="text-sm break-words whitespace-pre-wrap text-foreground">
                        {draft.description.length > 0 ? draft.description : t("card.noDescription")}
                      </p>
                    )}
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={t("card.fields.priority")} htmlFor={priorityFieldId}>
                    {isEditor ? (
                      <select
                        id={priorityFieldId}
                        value={draft.priority ?? ""}
                        onChange={(event) => {
                          const value = parsePriorityInput(event.target.value);
                          if (value !== undefined) setDraft({ priority: value });
                        }}
                        className={SELECT_CLASS}
                      >
                        {/* « Aucune » : une action Communecter peut n'avoir aucune priorité. */}
                        <option value="">{t("priority.none")}</option>
                        {PRIORITY_ORDER.map((priority) => (
                          <option key={priority} value={priority}>
                            {t(`priority.long.${priority}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p id={priorityFieldId} className="inline-flex items-center gap-1.5 text-sm text-foreground">
                        {/* Le point est décoratif ici : le niveau est écrit à côté. */}
                        <span aria-hidden className="inline-flex">
                          <PriorityDot priority={draft.priority} />
                        </span>
                        {draft.priority === null ? <span className="text-muted-foreground">{t("priority.none")}</span> : t(`priority.long.${draft.priority}`)}
                      </p>
                    )}
                  </Field>

                  <div data-card-field="dueDate">
                    {/* Échéance en FIN de jour : posée le jour du début, elle reste après lui. */}
                    <DueDateField
                      value={draft.dueDate}
                      completedAt={card.completedAt}
                      done={isCardDone(card)}
                      zone={zone}
                      edge="end"
                      original={active?.initial.dueDate}
                      disabled={!isEditor}
                      onChange={(dueDate) => setDraft({ dueDate })}
                      error={errorText("dueDate")}
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div data-card-field="startDate">
                    <Field label={t("card.fields.startDate")} htmlFor={startFieldId} error={errorText("startDate")}>
                      <Input
                        id={startFieldId}
                        type="date"
                        disabled={!isEditor}
                        value={toDateInputValue(draft.startDate, zone)}
                        aria-invalid={errorText("startDate") !== undefined || undefined}
                        aria-describedby={fieldDescribedBy(startFieldId, { error: errorText("startDate") })}
                        // Début en DÉBUT de jour ; le jour déjà affiché garde l'heure posée par gestion.
                        onChange={(event) => setDraft({ startDate: reconcileDateInput(event.target.value, active?.initial.startDate, zone, "start") })}
                        className="pointer-coarse:h-11"
                      />
                    </Field>
                  </div>

                  {/* Une organisation n'a pas de jalons (D22) : ni liste, ni « Aucun jalon ». */}
                  {milestonesAvailable ? (
                    <div data-card-field="milestoneId">
                      <Field label={t("card.fields.milestone")} htmlFor={milestoneFieldId} error={errorText("milestoneId")}>
                        <select
                          id={milestoneFieldId}
                          disabled={!isEditor}
                          value={draft.milestoneId ?? NO_MILESTONE_VALUE}
                          aria-invalid={errorText("milestoneId") !== undefined || undefined}
                          aria-describedby={fieldDescribedBy(milestoneFieldId, { error: errorText("milestoneId") })}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDraft({ milestoneId: value === NO_MILESTONE_VALUE ? null : value });
                          }}
                          className={SELECT_CLASS}
                        >
                          <option value={NO_MILESTONE_VALUE}>{t("card.milestoneNone")}</option>
                          {milestoneOptions.map((milestone) => (
                            <option key={milestone.milestoneId} value={milestone.milestoneId}>
                              {milestone.status === "close" ? t("card.milestoneClosed", { name: milestone.name }) : milestone.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  ) : null}
                </div>

                <div data-card-field="tags">
                  <TagsEditor
                    label={t("card.fields.labels")}
                    tags={draft.tags}
                    onChange={isEditor ? (tags) => setDraft({ tags }) : undefined}
                    suggestions={tagSuggestions(board.labels)}
                    error={errorText("tags")}
                  />
                </div>

                <div data-card-field="assignees">
                  <AssigneePicker
                    members={members}
                    value={draft.assignees}
                    source={source}
                    parentType={board.parentType}
                    disabled={!isEditor}
                    onChange={(assignees) => setDraft({ assignees })}
                    error={errorText("assignees")}
                  />
                </div>

                {/* Montant et temps passé : modifiables par un administrateur de l'élément seulement
                    (`canEditCredits`, comme Kanban gestion), LISIBLES par tous. */}
                {canEditCredits ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div data-card-field="credits">
                      <Field label={t("card.fields.credits")} htmlFor={creditsFieldId} error={errorText("credits")}>
                        <Input
                          id={creditsFieldId}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={draft.credits ?? ""}
                          aria-invalid={errorText("credits") !== undefined || undefined}
                          aria-describedby={fieldDescribedBy(creditsFieldId, { error: errorText("credits") })}
                          onChange={(event) => setDraft({ credits: parseNumberInput(event.target.value) })}
                          className="pointer-coarse:h-11"
                        />
                      </Field>
                    </div>
                    <div data-card-field="timeSpent">
                      <Field label={t("card.fields.timeSpent")} htmlFor={timeSpentFieldId} hint={creditsHint} error={errorText("timeSpent")}>
                        <Input
                          id={timeSpentFieldId}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={draft.timeSpent ?? ""}
                          aria-invalid={errorText("timeSpent") !== undefined || undefined}
                          aria-describedby={fieldDescribedBy(timeSpentFieldId, { hint: creditsHint, error: errorText("timeSpent") })}
                          onChange={(event) => setDraft({ timeSpent: parseNumberInput(event.target.value) })}
                          className="pointer-coarse:h-11"
                        />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <dl className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-foreground">{t("card.fields.credits")}</dt>
                        <dd className="mt-1 text-sm text-foreground tabular-nums">{formatAmount(draft.credits, locale) || t("card.notSet")}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-foreground">{t("card.fields.timeSpentReadOnly")}</dt>
                        <dd className="mt-1 text-sm text-foreground tabular-nums">{formatDuration(draft.timeSpent) || t("card.notSet")}</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted-foreground">{t(`card.creditsOwnerOnly.${linkType ?? "projects"}`)}</p>
                  </div>
                )}

                <div data-card-field="checklist">
                  <ChecklistEditor items={draft.checklist} maxLabelLength={limits.checklistLabel} readOnly={!canEditAnything} onChange={(checklist) => setDraft({ checklist })} />
                  {errorText("checklist") ? (
                    <p role="alert" className="mt-1.5 text-xs text-destructive">
                      {errorText("checklist")}
                    </p>
                  ) : null}
                </div>

                {canEditChecklistOnly ? <p className="text-xs text-muted-foreground">{t("card.viewerAssignedHint")}</p> : null}

                <p className="text-xs text-muted-foreground tabular-nums">{t("card.updatedAt", { date: formatDateTime(card.updated, locale, zone) })}</p>
              </form>

              <CardCommentThread
                boardId={board._id}
                cardId={card._id}
                members={members}
                currentUserId={currentUserId}
                isOwner={capabilities.role === "owner"}
                readOnly={capabilities.archived}
                locale={locale}
                zone={zone}
              />
            </div>
          )}
        </div>

        {/* Zone FIXE au-dessus du pied : le résumé d'un refus, l'échec du serveur et les
            confirmations restent sous les yeux, près des boutons qui les ont provoqués. */}
        {errorCount > 0 || (failure !== null && failureField === null) || pending !== null ? (
          <div className="flex flex-col gap-3 border-t border-border px-6 pt-4">
            {/* Résumé annoncé : le focus est déjà sur le premier champ fautif, mais qui ne le voit
                pas doit savoir pourquoi rien n'est parti. */}
            {errorCount > 0 ? <DangerNotice role="alert">{t("card.errors.summary", { count: errorCount })}</DangerNotice> : null}
            <FailureNotice error={failureField === null ? failure : null} announce="alert" />
            {pending !== null ? (
              <div role="alert" className="rounded-lg border border-border bg-warning/25 p-3">
                <p className="text-sm font-medium text-foreground">{pending === "archive" ? t("card.confirmArchive") : t("card.confirmDiscard")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button ref={confirmRef} type="button" variant="outline" size="sm" onClick={() => setPending(null)}>
                    {t("common.cancel")}
                  </Button>
                  {pending === "archive" ? (
                    // Archiver ne détruit rien : ton primaire, pas destructeur.
                    <Button type="button" size="sm" onClick={confirmArchive}>
                      <Archive aria-hidden />
                      {t("card.confirmArchiveAction")}
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="destructive" size="sm" onClick={onClose}>
                        {t("card.discardAction")}
                      </Button>
                      <Button type="button" size="sm" disabled={isSaving} aria-busy={isSaving || undefined} onClick={() => void submit()}>
                        {t("card.saveAndClose")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="border-t border-border px-6 py-4">
          {!card || !draft || !canEditAnything ? (
            <Button type="button" variant="outline" onClick={requestClose}>
              {t("common.close")}
            </Button>
          ) : (
            <>
              {canArchive ? (
                // Sous 640 px, l'archivage prend sa propre rangée : coincé entre « Annuler » et le
                // bord, il renvoyait « Enregistrer » seul à la ligne. Au-delà, il se range à gauche.
                <Button type="button" variant="ghost" className="w-full sm:mr-auto sm:w-auto" onClick={() => setPending("archive")} disabled={isSaving}>
                  <Archive aria-hidden />
                  {t("card.archive")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={requestClose} disabled={isSaving}>
                {t("common.cancel")}
              </Button>
              {/* `form=` : le pied est hors du <form>, ce lien garde la soumission par Entrée
                  depuis n'importe quel champ. */}
              <Button type="submit" form={formId} disabled={!isDirty || isSaving} aria-busy={isSaving || undefined}>
                {t("common.save")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
