import { useMemo, useState } from "react";
import { Loader2, AlertCircle, ExternalLink, MapPin, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ToolCatalogItem, ToolUser } from "@communecter/cocolight-api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { getNoteAppearance } from "@/modules/coform/utils/commonTableNote";
import { useToolDetail } from "../hooks/useToolDetail";
import { SectionHeader } from "./SectionHeader";
import { ToolImage } from "./ToolImage";
import { CommunInfoSection } from "./CommunInfoSection";
import { ToolEditDialog } from "./ToolEditDialog";

/** Emoji de satisfaction (map partagée coform, cf. CommonTableContributorsDialog). */
const HAPPINESS_EMOJI: Record<string, string> = {
  love: "😍",
  happySmile: "😀",
  neutral: "😐",
  sad: "😢",
  cry: "😭",
};

/** Pastille de couleur de la jauge de note, par palier `idx` de getNoteAppearance. */
const NOTE_DOT = [
  "bg-muted-foreground",
  "bg-green-600",
  "bg-cyan-600",
  "bg-blue-600",
  "bg-amber-500",
  "bg-red-600",
] as const;

interface ToolDetailDialogProps {
  tool: ToolCatalogItem;
  formId: string;
  step: string;
  finderPath: string;
  /** Affiche le bloc « Informations liées au commun » si l'outil référence un commun. */
  showCommunInfo?: boolean;
  /** Id du form AAP des communs (gate anti-IDOR). */
  communFormId?: string;
  /** Active le bouton « Modifier » — encore soumis au droit admin du costum. */
  enableEnrichmentEditing?: boolean;
  /** Gabarit d'URL du commun pour l'éditeur (`{communId}`). */
  communUrlTemplate?: string;
  onClose: () => void;
}

/** Pastille de filtre contexte (même style que la barre latérale). */
function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Détail d'un outil (inspiré de la modale legacy) : en-tête Informations, filtre
 * par contexte d'usage, puis les lieux qui l'utilisent avec satisfaction + jauge
 * « besoin d'alternative éthique ». Monté conditionnellement par le parent.
 */
export function ToolDetailDialog({
  tool,
  formId,
  step,
  finderPath,
  showCommunInfo,
  communFormId,
  enableEnrichmentEditing,
  communUrlTemplate,
  onClose,
}: ToolDetailDialogProps) {
  const t = useT("modules/toolsCatalog");
  const { entity } = useCocolight();
  const [editing, setEditing] = useState(false);
  // Admin DIRECT du host du costum = `isCostumAdmin` côté backend. Le serveur
  // revérifie le droit : ce gate n'est qu'un confort d'affichage.
  const canEdit = !!enableEnrichmentEditing && (entity?.isAdmin({ silent: true }) ?? false);

  const { users, isPending, error } = useToolDetail({
    formId,
    step,
    finderPath,
    criteriaIds: tool.criteriaIds,
    inputKeys: tool.inputKeys,
    // Sans ce filtre, la liste mêle les lieux ayant répondu au même BESOIN avec
    // d'autres outils : les `criteriaId` sont partagés entre toutes les réponses.
    normalizedName: tool.normalizedName,
    enabled: true,
  });

  const [selCategory, setSelCategory] = useState("");
  const [selUsage, setSelUsage] = useState("");

  const categories = useMemo(
    () =>
      Array.from(new Set(users.map((u) => u.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "fr", { sensitivity: "base" }),
      ),
    [users],
  );
  const usages = useMemo(() => {
    const src = selCategory ? users.filter((u) => u.category === selCategory) : users;
    return Array.from(new Set(src.map((u) => u.usage).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" }),
    );
  }, [users, selCategory]);

  const filtered = useMemo(
    () =>
      users.filter(
        (u) => (!selCategory || u.category === selCategory) && (!selUsage || u.usage === selUsage),
      ),
    [users, selCategory, selUsage],
  );

  const handleCategory = (c: string) => {
    setSelCategory(c);
    setSelUsage("");
  };

  const showContextFilter = categories.length > 1 || usages.length > 1;
  // Un outil sans criteriaIds désactive la query (isReady=false) → isPending resterait
  // vrai en permanence. On traite alors la liste comme vide au lieu d'un spinner bloqué.
  const hasCriteria = tool.criteriaIds.length > 0;

  return (
    <>
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate">{t("detail.title", undefined, { tool: tool.title })}</span>
            {tool.isOpenSource && (
              <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                {t("openSourceBadge")}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("detail.description")}</DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 space-y-5 overflow-y-auto px-6">
          {/* ── Informations ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>{t("detail.infoTitle")}</SectionHeader>
            <div className="flex gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white">
                <ToolImage src={tool.image} alt={tool.title} width={128} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-lg font-bold text-foreground">{tool.title}</p>
                <p className="text-sm text-muted-foreground">
                  {t("detail.toolLink")}:{" "}
                  {tool.url ? (
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      {t("openLink")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span>{t("detail.noLink")}</span>
                  )}
                </p>
                <p className="text-sm">
                  {tool.isOpenSource ? t("detail.openSourceYes") : t("detail.openSourceNo")}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">{t("detail.descriptionLabel")}</p>
              <div className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">
                {tool.description ? (
                  // Description admin en markdown (l'éditeur le promet, cf. `edit.descriptionHint`),
                  // même rendu que `CommunInfoSection` — `@tailwindcss/typography` non installé, styles
                  // de balises explicites ; react-markdown v10 neutralise `javascript:` par défaut.
                  <div className="[&_a]:text-primary [&_a]:underline [&_li]:mb-0.5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&>*:last-child]:mb-0">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                      }}
                    >
                      {tool.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  t("detail.noDescription")
                )}
              </div>
            </div>

            {/* Édition de l'enrichissement — admins du costum seulement, comme le
                bouton « Modifier » de la modale legacy (`canView`). */}
            {canEdit && (
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("edit.open")}
                </Button>
              </div>
            )}
          </section>

          {/* ── Filtrer par contexte d'usage ───────────────────────────── */}
          {showContextFilter && (
            <section className="space-y-3">
              <SectionHeader>{t("detail.filterTitle")}</SectionHeader>
              {categories.length > 1 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("filter.categoryTitle")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterPill active={selCategory === ""} onClick={() => handleCategory("")}>
                      {t("filter.all")}
                    </FilterPill>
                    {categories.map((c) => (
                      <FilterPill key={c} active={selCategory === c} onClick={() => handleCategory(c)}>
                        {c}
                      </FilterPill>
                    ))}
                  </div>
                </div>
              )}
              {usages.length > 1 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("filter.subCategoryTitle")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterPill active={selUsage === ""} onClick={() => setSelUsage("")}>
                      {t("filter.all")}
                    </FilterPill>
                    {usages.map((u) => (
                      <FilterPill key={u} active={selUsage === u} onClick={() => setSelUsage(u)}>
                        {u}
                      </FilterPill>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-right text-xs text-muted-foreground">
                {t("detail.placesShown", undefined, { count: filtered.length })}
              </p>
            </section>
          )}

          {/* ── Les tiers-lieux qui l'utilisent ────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>{t("detail.placesTitle")}</SectionHeader>

            {hasCriteria && isPending && (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{t("detail.loading")}</span>
              </div>
            )}

            {!isPending && error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-sm">{t("detail.error")}</span>
              </div>
            )}

            {(!hasCriteria || (!isPending && !error && filtered.length === 0)) && (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("detail.empty")}</p>
            )}

            {hasCriteria && !isPending && !error && filtered.length > 0 && (
              <ul className="space-y-3">
                {filtered.map((u) => (
                  <PlaceCard
                    key={`${u.answerId}-${u.criteriaId}-${u.category}-${u.usage}`}
                    u={u}
                    formId={formId}
                    t={t}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* ── Informations liées au commun (si l'outil référence un commun) ──
              En DERNIER : c'est un complément sur le commun porteur, pas une
              information sur l'outil lui-même ni sur ses utilisateurs. */}
          {showCommunInfo && tool.communId && (
            <CommunInfoSection communId={tool.communId} communFormId={communFormId} />
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Monté seulement à l'ouverture : pas de requête de liste des communs tant
        que personne n'édite. Rendu en FRÈRE de la modale détail (deux Dialog
        Radix imbriqués se disputeraient le focus et l'overlay). */}
    {editing && (
      <ToolEditDialog
        tool={tool}
        open
        onOpenChange={setEditing}
        communFormId={communFormId}
        communUrlTemplate={communUrlTemplate}
        onSaved={onClose}
      />
    )}
    </>
  );
}

/** Carte d'un lieu utilisateur : satisfaction + jauge besoin d'alternative éthique. */
function PlaceCard({ u, formId, t }: { u: ToolUser; formId: string; t: ReturnType<typeof useT> }) {
  const emoji = (u.happiness && HAPPINESS_EMOJI[u.happiness]) || "😐";
  const happinessLabel = u.happiness ? t(`happiness.${u.happiness}`) : t("happiness.none");
  const placeLink = u.placeSlug ? `/profil/${u.placeSlug}` : null;
  const answerLink = u.answerId
    ? `/coform/${formId}/answer/${u.answerId}?mode=readonly`
    : null;

  const { idx, textColor } = getNoteAppearance(u.note);
  const noteLabel = t(`note.level.${idx}`);

  return (
    <li className="rounded-lg border border-l-4 border-border border-l-primary bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={u.image || undefined} alt={u.placeName} className="object-cover" />
            <AvatarFallback className="bg-muted text-xs">
              <MapPin className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {placeLink ? (
              <a
                href={placeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground hover:underline"
              >
                {u.placeName}
              </a>
            ) : (
              <span className="font-semibold text-foreground">{u.placeName}</span>
            )}
            {answerLink && (
              <a
                href={answerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex w-fit items-center gap-1 whitespace-nowrap text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {t("detail.seeAnswer")}
              </a>
            )}
          </div>
        </div>
        {(u.category || u.usage) && (
          <div className="shrink-0 text-right text-xs">
            {u.category && <div className="text-muted-foreground">{u.category}</div>}
            {u.usage && <div className="font-medium text-cyan-600">{u.usage}</div>}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">{t("detail.satisfactionLabel")}</p>
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none" aria-hidden="true">{emoji}</span>
            <span className="text-sm font-medium">{happinessLabel}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("detail.noteLabel")}</p>
          <div className="flex items-center gap-2">
            <span className={cn("h-3 w-3 shrink-0 rounded-full", NOTE_DOT[idx])} aria-hidden="true" />
            <span className={cn("text-sm font-semibold", textColor)}>
              {noteLabel} ({u.note}/5)
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
