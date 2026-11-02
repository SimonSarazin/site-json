import { useEffect, useId, useRef, useState } from "react";
import { Flag, FlagOff, Pencil, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FailureNotice } from "@/modules/kanban/components/ui/FailureNotice";
import { Field } from "@/modules/kanban/components/ui/Field";
import { fieldDescribedBy } from "@/modules/kanban/components/ui/fieldIds";
import { useBoard } from "@/modules/kanban/hooks/useBoard";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import { useMilestoneList, useMilestoneMutations } from "@/modules/kanban/hooks/useMilestones";
import { dateZoneFor } from "@/modules/kanban/lib/boardSource";
import { dateRangeLabel, type DateLocale, type DateZone } from "@/modules/kanban/lib/dates";
import {
  countCardsByMilestone,
  EMPTY_MILESTONE_DRAFT,
  firstInvalidMilestoneField,
  hasMilestoneErrors,
  MILESTONE_DESCRIPTION_MAX,
  MILESTONE_FIELD_MAX,
  MILESTONE_NAME_MAX,
  milestoneCreatePayload,
  splitMilestones,
  validateMilestoneDraft,
  validateMilestoneName,
  type MilestoneDraft,
  type MilestoneErrors,
  type MilestoneField,
} from "@/modules/kanban/lib/milestones";
import type { Milestone } from "@/modules/kanban/types";

export interface MilestonesDialogProps {
  /** Tableau relié dont on gère les jalons (ceux de son projet Communecter). */
  boardId: string;
  onClose: () => void;
}

/**
 * Gestion des jalons du projet : lister ouverts et clos, créer, renommer, clore ou rouvrir. Reprise
 * de co-kanban (`components/board/MilestonesDialog.tsx`), sur le `Dialog` du site.
 *
 * Les jalons sont ceux du PROJET, partagés avec Kanban gestion : la liste est relue à l'ouverture
 * (un jalon créé là-bas n'est pas journalisé ici). Écrire est réservé à `canManageMilestones`
 * (administrateur du projet) ; les autres consultent la même liste, sans commandes : on ne cache
 * pas une information parce qu'on ne peut pas la changer.
 *
 * `export default` : chargée à la demande (`lazyDialogs`).
 */
export default function MilestonesDialog({ boardId, onClose }: MilestonesDialogProps) {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const nameId = useId();
  const startId = useId();
  const endId = useId();
  const descriptionId = useId();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  const boardQuery = useBoard(boardId);
  const listQuery = useMilestoneList(boardId, { enabled: true });
  const { create, update } = useMilestoneMutations(boardId);

  const [draft, setDraft] = useState<MilestoneDraft>(EMPTY_MILESTONE_DRAFT);
  const [errors, setErrors] = useState<MilestoneErrors>({});

  const snapshot = boardQuery.data;
  const canManage = snapshot?.capabilities.canManageMilestones === true;
  // Les dates des jalons se lisent et se saisissent dans le fuseau du navigateur, comme dans
  // Kanban gestion.
  const zone = dateZoneFor(snapshot?.capabilities.source ?? "communecter");
  // La liste FRAÎCHE d'abord ; à défaut, celle de l'instantané, pour ne pas montrer un squelette
  // quand on a déjà de quoi lire.
  const milestones = listQuery.data ?? snapshot?.milestones ?? [];
  const { open: openMilestones, closed: closedMilestones } = splitMilestones(milestones);
  const cardCounts = countCardsByMilestone(snapshot?.cards ?? []);
  const isLoading = listQuery.isPending && milestones.length === 0;

  const errorText = (field: MilestoneField): string | undefined => {
    const code = errors[field];
    return code ? t(`milestones.errors.${code}`, { max: MILESTONE_FIELD_MAX[field] ?? 0 }) : undefined;
  };

  /** Champ du formulaire de création, pour y porter le focus après un refus. */
  function fieldElement(field: MilestoneField): HTMLInputElement | HTMLTextAreaElement | null {
    if (field === "name") return nameRef.current;
    if (field === "startDate") return startRef.current;
    if (field === "endDate") return endRef.current;
    return descriptionRef.current;
  }

  async function submitCreate() {
    const found = validateMilestoneDraft(draft, zone);
    setErrors(found);
    if (hasMilestoneErrors(found)) {
      // Le focus va au premier fautif : sinon il reste sur « Créer » et seule une personne qui
      // voit l'écran sait ce qui bloque.
      const first = firstInvalidMilestoneField(found);
      if (first !== null) fieldElement(first)?.focus();
      return;
    }
    try {
      await create.mutateAsync(milestoneCreatePayload(draft, zone));
      setDraft(EMPTY_MILESTONE_DRAFT);
      // Le nom garde le focus : on crée souvent plusieurs jalons d'affilée.
      nameRef.current?.focus();
    } catch {
      // L'échec est déjà annoncé par la notification de la mutation ; la saisie reste en place.
    }
  }

  const rename = (milestone: Milestone, name: string) => update.mutateAsync({ milestoneId: milestone.milestoneId, name });
  const toggle = (milestone: Milestone) => update.mutate({ milestoneId: milestone.milestoneId, status: milestone.status === "open" ? "close" : "open" });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {/* `kanban-module` : la boîte est rendue dans un PORTAIL, hors de la racine du module. */}
      <DialogContent className="kanban-module flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-4">
          <DialogTitle>{t("milestones.title")}</DialogTitle>
          <DialogDescription>{t("milestones.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5 [scrollbar-color:var(--ck-scrollbar)_transparent] [scrollbar-width:thin]">
          {canManage ? (
            <form
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCreate();
              }}
            >
              <h3 className="text-sm font-semibold text-foreground">{t("milestones.createTitle")}</h3>
              <Field label={t("milestones.fields.name")} htmlFor={nameId} required error={errorText("name")}>
                <Input
                  id={nameId}
                  ref={nameRef}
                  value={draft.name}
                  required
                  maxLength={MILESTONE_NAME_MAX}
                  autoComplete="off"
                  aria-invalid={errors.name !== undefined}
                  aria-describedby={fieldDescribedBy(nameId, { error: errorText("name") })}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("milestones.fields.startDate")} htmlFor={startId} error={errorText("startDate")}>
                  <Input
                    id={startId}
                    ref={startRef}
                    type="date"
                    value={draft.startDate}
                    aria-invalid={errors.startDate !== undefined}
                    aria-describedby={fieldDescribedBy(startId, { error: errorText("startDate") })}
                    onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                  />
                </Field>
                <Field label={t("milestones.fields.endDate")} htmlFor={endId} error={errorText("endDate")}>
                  <Input
                    id={endId}
                    ref={endRef}
                    type="date"
                    value={draft.endDate}
                    min={draft.startDate || undefined}
                    aria-invalid={errors.endDate !== undefined}
                    aria-describedby={fieldDescribedBy(endId, { error: errorText("endDate") })}
                    onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                  />
                </Field>
              </div>
              <Field label={t("boards.fields.description")} htmlFor={descriptionId} error={errorText("description")}>
                <Textarea
                  id={descriptionId}
                  ref={descriptionRef}
                  rows={2}
                  value={draft.description}
                  maxLength={MILESTONE_DESCRIPTION_MAX}
                  className="resize-y"
                  aria-describedby={fieldDescribedBy(descriptionId, { error: errorText("description") })}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={create.isPending}>
                  <Plus aria-hidden />
                  {t("milestones.create")}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">{t("milestones.readOnly")}</p>
          )}

          <FailureNotice
            error={listQuery.isError ? listQuery.error : null}
            announce="alert"
            action={
              <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
                <RefreshCw aria-hidden />
                {t("common.retry")}
              </Button>
            }
          />

          {isLoading ? (
            <div aria-busy="true" className="flex flex-col gap-2">
              <span className="sr-only">{t("common.loading")}</span>
              <Skeleton aria-hidden className="h-14 w-full motion-reduce:animate-none" />
              <Skeleton aria-hidden className="h-14 w-full motion-reduce:animate-none" />
            </div>
          ) : (
            <>
              <MilestoneSection title={t("milestones.openSection", { count: openMilestones.length })} emptyText={t("milestones.empty")} milestones={openMilestones} cardCounts={cardCounts} canManage={canManage} locale={locale} zone={zone} onRename={rename} onToggle={toggle} />
              <MilestoneSection title={t("milestones.closedSection", { count: closedMilestones.length })} emptyText={t("milestones.emptyClosed")} milestones={closedMilestones} cardCounts={cardCounts} canManage={canManage} locale={locale} zone={zone} onRename={rename} onToggle={toggle} />
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MilestoneSectionProps {
  title: string;
  emptyText: string;
  milestones: readonly Milestone[];
  cardCounts: ReadonlyMap<string, number>;
  canManage: boolean;
  locale: DateLocale;
  zone: DateZone;
  onRename: (milestone: Milestone, name: string) => Promise<unknown>;
  onToggle: (milestone: Milestone) => void;
}

function MilestoneSection({ title, emptyText, milestones, cardCounts, canManage, locale, zone, onRename, onToggle }: MilestoneSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-semibold text-foreground tabular-nums">
        {title}
      </h3>
      {milestones.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {milestones.map((milestone) => (
            <MilestoneRow key={milestone.milestoneId} milestone={milestone} cardCount={cardCounts.get(milestone.milestoneId) ?? 0} canManage={canManage} locale={locale} zone={zone} onRename={onRename} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface MilestoneRowProps {
  milestone: Milestone;
  cardCount: number;
  canManage: boolean;
  locale: DateLocale;
  zone: DateZone;
  onRename: (milestone: Milestone, name: string) => Promise<unknown>;
  onToggle: (milestone: Milestone) => void;
}

function MilestoneRow({ milestone, cardCount, canManage, locale, zone, onRename, onToggle }: MilestoneRowProps) {
  const { t } = useTranslation("modules/kanban");
  const inputId = useId();
  const renameRef = useRef<HTMLButtonElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(milestone.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** `true` dès qu'une édition a eu lieu : le focus n'est rendu qu'APRÈS une édition, jamais au montage. */
  const hasEdited = useRef(false);

  useEffect(() => {
    // Sortie de l'édition (enregistrée ou annulée) : le focus revient sur « Renommer », sinon il
    // tombe sur le corps de la page derrière la boîte.
    if (!editing && hasEdited.current) renameRef.current?.focus();
  }, [editing]);

  const dateLabel = dateRangeLabel(milestone.startDate, milestone.endDate, locale, (key, values) => t(key, values), zone);

  async function save() {
    // La règle du nom est celle de la création (`validateMilestoneName`).
    const code = validateMilestoneName(name);
    if (code !== undefined) {
      setError(t(`milestones.errors.${code}`, { max: MILESTONE_NAME_MAX }));
      return;
    }
    const trimmed = name.trim();
    if (trimmed === milestone.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(milestone, trimmed);
      setEditing(false);
    } catch {
      // Notification déjà émise par la mutation : la saisie reste ouverte.
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-primary p-3">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Field label={t("milestones.fields.name")} htmlFor={inputId} error={error ?? undefined}>
            <Input
              id={inputId}
              value={name}
              // Le champ prend le focus à l'ouverture de l'édition : c'est le geste demandé.
              autoFocus
              maxLength={MILESTONE_NAME_MAX}
              aria-invalid={error !== null}
              aria-describedby={fieldDescribedBy(inputId, { error: error ?? undefined })}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                // Échap annule l'édition SANS fermer la boîte entière.
                if (event.key !== "Escape") return;
                event.stopPropagation();
                setEditing(false);
              }}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{milestone.name}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
          <span>{dateLabel}</span>
          <span>{t("milestones.cardCount", { count: cardCount })}</span>
        </span>
      </span>
      {canManage ? (
        <span className="flex shrink-0 flex-wrap gap-2">
          <Button
            ref={renameRef}
            variant="ghost"
            size="sm"
            aria-label={t("milestones.renameLabel", { name: milestone.name })}
            className="pointer-coarse:min-h-11"
            onClick={() => {
              hasEdited.current = true;
              setName(milestone.name);
              setError(null);
              setEditing(true);
            }}
          >
            <Pencil aria-hidden />
            {t("milestones.rename")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={milestone.status === "open" ? t("milestones.closeLabel", { name: milestone.name }) : t("milestones.reopenLabel", { name: milestone.name })}
            className="pointer-coarse:min-h-11"
            onClick={() => onToggle(milestone)}
          >
            {milestone.status === "open" ? <FlagOff aria-hidden /> : <Flag aria-hidden />}
            {milestone.status === "open" ? t("milestones.close") : t("milestones.reopen")}
          </Button>
        </span>
      ) : null}
    </li>
  );
}
