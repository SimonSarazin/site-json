import { CheckCircle2, ClipboardList, Loader2, Mail, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import SearchTextInput from "@/modules/search/components/SearchTextInput";
import { useSearchAllResults } from "@/modules/search/hooks/useSearchAllResults";
import type { SearchType } from "@/modules/search/schema";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";
import { rowData, rowId } from "../lib/answerCopy";
import { recipientFromEntity, uniqueRecipients, type MailingRecipient } from "../lib/mailing";
import { buildFormCoverage, coverageAnswerFields, coverageOrgFields, filterRowsByAnswers, filterRowsByName, hasAnswered, type AnswerFilter, type AnswerState } from "../lib/formCoverage";
import type { AdminFormCoverageSection as AdminFormCoverageSectionConfig, AdminSection } from "../schema";
import { AdminMailingDialog } from "../components/AdminMailingDialog";
import { AdminTableShell } from "../components/AdminTableShell";

// `useSearchQuery` SÉRIALISE ces objets dans la queryKey : seule la valeur compte.
const ORGS_TYPE = { type: ["organizations"] };
const ANSWERS_TYPE = { type: ["answers"] };

/**
 * Section `formCoverage` — une ligne par organisation du périmètre `source` (nom lié à sa fiche
 * `/profil/:slug`), et une colonne par formulaire déclaré avec son état : « Répondu » si au moins une réponse de ce formulaire
 * désigne l'organisation par sa question finder (`finderInput`, et `linkPaths` s'il y en a), « Pas de
 * réponse » sinon.
 *
 * Deux lectures COMPLÈTES (`useSearchAllResults`) : les organisations, et les réponses de tous les
 * formulaires suivis en une requête (`form: { $in }`, `notSourceKey` : une réponse appartient au
 * site de son formulaire, pas forcément à celui-ci). Tant que les réponses ne sont pas toutes
 * chargées, l'état n'est pas affiché : une lecture partielle ferait passer une CAE qui a répondu
 * pour « Pas de réponse ». Lecture seule, filtre par nom côté client (le périmètre est chargé en entier).
 *
 * `mail: true` (opt-in) : cases à cocher et envoi groupé par `AdminMailingDialog` (même envoi que l'onglet
 * Membres) aux e-mails de contact des organisations cochées ; une organisation sans e-mail n'est pas cochable.
 */
export default function AdminFormCoverageSection({ section }: { section: AdminSection }) {
  const cfg = section as AdminFormCoverageSectionConfig;
  const t = useT();
  const tAdmin = useT("modules/admin");
  const [q, setQ] = useState("");

  const formIds = useMemo(() => cfg.forms.map((f) => f.formId), [cfg.forms]);

  const orgParams = useMemo(
    () => ({
      ...cfg.source,
      defaultTypes: ["organizations"] as SearchType[],
      defaultFields: coverageOrgFields(cfg.source?.defaultFields),
    }),
    [cfg.source],
  );
  const orgs = useSearchAllResults({
    queryKeyPrefix: ADMIN_QUERY_KEYS.FORM_COVERAGE_ORGS_PREFIX,
    searchType: ORGS_TYPE,
    baseParams: orgParams,
  });

  const answerParams = useMemo(
    () => ({
      defaultTypes: ["answers"] as SearchType[],
      notSourceKey: true,
      defaultFilters: { form: { $in: formIds } },
      defaultFields: coverageAnswerFields(cfg.forms),
      indexStepList: cfg.answersIndexStepList ?? 100,
    }),
    [formIds, cfg.forms, cfg.answersIndexStepList],
  );
  const answers = useSearchAllResults({
    queryKeyPrefix: ADMIN_QUERY_KEYS.FORM_COVERAGE_ANSWERS_PREFIX(formIds),
    searchType: ANSWERS_TYPE,
    baseParams: answerParams,
    // Variante admin : la ligne publique d'une réponse ne porte pas `answers`, donc pas le finder ;
    // `defaultFields` borne la projection à ce que la couverture lit.
    variant: "admin",
  });

  const coverage = useMemo(() => buildFormCoverage(answers.results, cfg.forms), [answers.results, cfg.forms]);
  const answersState: "ready" | "loading" | "error" = answers.error || answers.capped
    ? "error"
    : answers.isPending || answers.isFetching || !answers.isComplete
      ? "loading"
      : "ready";

  // Filtres « Répondu / Pas de réponse » par formulaire : appliqués seulement sur une couverture
  // COMPLÈTE (sinon « Pas de réponse » retiendrait des organisations qui ont répondu) ; désactivés avant.
  const [answerFilter, setAnswerFilter] = useState<AnswerFilter>({});
  const setFormFilter = (formId: string, value: string) =>
    setAnswerFilter((f) => {
      const { [formId]: _drop, ...rest } = f;
      return value === "all" ? rest : { ...rest, [formId]: value as AnswerState };
    });
  const rows = useMemo(() => {
    const byName = filterRowsByName(orgs.results, q);
    return answersState === "ready" ? filterRowsByAnswers(byName, coverage, answerFilter) : byName;
  }, [orgs.results, q, answersState, coverage, answerFilter]);

  // Sélection par id d'organisation → destinataire (e-mail de contact de la fiche).
  const [selected, setSelected] = useState<Map<string, MailingRecipient>>(new Map());
  const [mailOpen, setMailOpen] = useState(false);
  const recipientOf = (row: (typeof rows)[number]) =>
    recipientFromEntity("organizations", { id: rowId(row), serverData: rowData(row) });
  const visibleRecipients = rows.map(recipientOf).filter((r): r is MailingRecipient => r !== null);
  const allVisibleSelected = visibleRecipients.length > 0 && visibleRecipients.every((r) => selected.has(r.key));
  const toggle = (r: MailingRecipient) =>
    setSelected((m) => { const n = new Map(m); if (n.has(r.key)) n.delete(r.key); else n.set(r.key, r); return n; });
  const toggleAllVisible = () =>
    setSelected((m) => {
      const n = new Map(m);
      for (const r of visibleRecipients) if (allVisibleSelected) n.delete(r.key); else n.set(r.key, r);
      return n;
    });
  const mailRecipients = uniqueRecipients([...selected.values()]);

  const head = (
    <TableRow>
      {cfg.mail && (
        <TableHead className="w-10">
          <Checkbox
            checked={allVisibleSelected}
            disabled={visibleRecipients.length === 0}
            onCheckedChange={toggleAllVisible}
            aria-label={tAdmin("AdminFormCoverageSection.selectAll")}
          />
        </TableHead>
      )}
      <TableHead>{tAdmin("AdminFormCoverageSection.colName")}</TableHead>
      <TableHead>{tAdmin("AdminFormCoverageSection.colEmail")}</TableHead>
      {cfg.forms.map((form) => (
        <TableHead key={form.formId}>{t(form.label)}</TableHead>
      ))}
    </TableRow>
  );

  const body = rows.map((row) => {
    const id = rowId(row);
    const data = rowData(row);
    const name = String(data.name ?? "");
    const slug = typeof data.slug === "string" ? data.slug : "";
    const email = typeof data.email === "string" ? data.email : "";
    const recipient = cfg.mail ? recipientOf(row) : null;
    return (
      <TableRow key={id}>
        {cfg.mail && (
          <TableCell>
            <Checkbox
              checked={!!recipient && selected.has(recipient.key)}
              disabled={!recipient}
              onCheckedChange={() => recipient && toggle(recipient)}
              aria-label={tAdmin("AdminFormCoverageSection.select", undefined, { name })}
            />
          </TableCell>
        )}
        <TableCell className="font-medium">
          {slug ? (
            <Link to={`/profil/${slug}`} className="hover:underline focus-visible:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {email ? (
            <a href={`mailto:${email}`} className="hover:underline focus-visible:underline">
              {email}
            </a>
          ) : (
            "—"
          )}
        </TableCell>
        {cfg.forms.map((form) => {
          const answered = hasAnswered(coverage, form.formId, id);
          return (
            <TableCell key={form.formId}>
              {answersState !== "ready" ? (
                <span className="text-muted-foreground">…</span>
              ) : answered ? (
                // Pas `STATUS_TONE_CLASS` : `bg-badge-valid` n'est défini que par certaines feuilles de site —
                // ailleurs le badge n'a plus de fond et son texte clair devient illisible.
                <Badge>
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  {tAdmin("AdminFormCoverageSection.answered")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  {tAdmin("AdminFormCoverageSection.notAnswered")}
                </Badge>
              )}
            </TableCell>
          );
        })}
      </TableRow>
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5" />
          {cfg.title ? t(cfg.title) : tAdmin("AdminFormCoverageSection.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchTextInput
            className="max-w-xs"
            placeholder={tAdmin("AdminFormCoverageSection.searchPlaceholder")}
            value={q}
            onChange={setQ}
          />
          <span className="flex items-center gap-1 text-sm text-muted-foreground" aria-live="polite">
            {orgs.isComplete && (rows.length === orgs.loaded
              ? tAdmin("AdminFormCoverageSection.count", undefined, { count: String(orgs.loaded) })
              : tAdmin("AdminFormCoverageSection.countFiltered", undefined, { count: String(rows.length), total: String(orgs.loaded) }))}
            {answersState === "loading" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {tAdmin("AdminFormCoverageSection.loadingAnswers")}
              </>
            )}
            {answersState === "error" && (
              <>
                <TriangleAlert className="h-3.5 w-3.5 text-destructive" />
                {tAdmin("AdminFormCoverageSection.answersError")}
              </>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3" role="group" aria-label={tAdmin("AdminFormCoverageSection.filtersLabel")}>
          {cfg.forms.map((form) => {
            const label = t(form.label);
            return (
              <label key={form.formId} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {label}
                <Select
                  value={answerFilter[form.formId] ?? "all"}
                  onValueChange={(v) => setFormFilter(form.formId, v)}
                  disabled={answersState !== "ready"}
                >
                  <SelectTrigger size="sm" className="w-44" aria-label={label}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tAdmin("AdminFormCoverageSection.filterAll")}</SelectItem>
                    <SelectItem value="answered">{tAdmin("AdminFormCoverageSection.answered")}</SelectItem>
                    <SelectItem value="notAnswered">{tAdmin("AdminFormCoverageSection.notAnswered")}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            );
          })}
          {Object.keys(answerFilter).length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setAnswerFilter({})}>
              {tAdmin("AdminFormCoverageSection.clearFilters")}
            </Button>
          )}
        </div>

        {cfg.mail && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <span className="text-sm">
              {selected.size === 0
                ? tAdmin("AdminFormCoverageSection.selectHint")
                : tAdmin("AdminFormCoverageSection.selectedCount", undefined, { count: String(selected.size) })}
            </span>
            <Button size="sm" disabled={mailRecipients.length === 0} onClick={() => setMailOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              {tAdmin("AdminFormCoverageSection.mail")}
            </Button>
            {selected.size > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Map())}>
                {tAdmin("AdminFormCoverageSection.clearSelection")}
              </Button>
            )}
          </div>
        )}

        <AdminTableShell
          head={head}
          body={body}
          loading={orgs.isPending || !orgs.isComplete}
          empty={orgs.isComplete && rows.length === 0}
          emptyMessage={tAdmin("AdminFormCoverageSection.empty")}
          maxHeightClass="max-h-[60vh]"
          stickyHeader
        />
      </CardContent>
      {cfg.mail && (
        <AdminMailingDialog
          open={mailOpen}
          onOpenChange={setMailOpen}
          recipients={mailRecipients}
          onRemove={(key) => setSelected((m) => { const n = new Map(m); n.delete(key); return n; })}
          onSent={() => setSelected(new Map())}
        />
      )}
    </Card>
  );
}
