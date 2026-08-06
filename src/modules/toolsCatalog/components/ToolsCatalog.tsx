import { Suspense, useMemo, useState } from "react";
import { lazy } from "vite-preload";
import { Search, LayoutGrid, List as ListIcon, AlertCircle, Loader2, PenLine } from "lucide-react";
import type { ToolCatalogItem } from "@communecter/cocolight-api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useDebounce } from "@/hooks/useDebounce";
import SectionEmptyState from "@/components/sections/SectionEmptyState";
import { ClientOnly } from "@/components/layout/ClientOnly";
import type { ToolsCatalogSectionProps } from "../schema";
import { useToolsCatalog } from "../hooks/useToolsCatalog";
import { ToolCard } from "./ToolCard";
import { ToolListRow } from "./ToolListRow";
import { ToolFilters } from "./ToolFilters";
import { ToolDetailDialog } from "./ToolDetailDialog";
import { ToolsCatalogSkeleton, ToolFiltersSkeleton } from "./ToolsCatalogSkeleton";

// Lazy : par chaîne d'imports statique, ce dialogue tire TOUT le runtime coform
// (SmartCoForm, DynamicCoForm, MultiStepCoForm, les FormFields, react-markdown).
// Le montage conditionnel n'y change rien — seul le lazy sort ce poids du chunk de
// la page, que la grande majorité des visiteurs se contente de parcourir.
const ToolsAnswerDialog = lazy(() => import("./ToolsAnswerDialog"));

/** Classes de colonnes figées (Tailwind ne peut pas purger des classes dynamiques). */
const COL_CLASS = {
  sm: { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" },
  md: { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" },
  lg: { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" },
  xl: { 1: "xl:grid-cols-1", 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4" },
} as const;

function colClass(bp: keyof typeof COL_CLASS, n: number | undefined): string {
  if (!n) return "";
  const clamped = Math.min(4, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4;
  return COL_CLASS[bp][clamped];
}

/**
 * Composant générique du catalogue d'outils d'usage. Filtres catégorie /
 * sous-catégorie en barre latérale (façon legacy) + recherche + pagination CÔTÉ
 * SERVEUR (défilement infini), grille/liste, modale détail.
 */
export function ToolsCatalog({ props }: { props: ToolsCatalogSectionProps }) {
  useLoadNamespace("modules/toolsCatalog");
  const t = useT("modules/toolsCatalog");
  const { me } = useCocolight();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 500);
  const [category, setCategory] = useState("");
  const [usage, setUsage] = useState("");
  const [isOpenSource, setIsOpenSource] = useState(false);
  const [view, setView] = useState<"grid" | "list">(props.defaultView ?? "grid");
  const [selectedTool, setSelectedTool] = useState<ToolCatalogItem | null>(null);
  const [answering, setAnswering] = useState(false);

  // Changer de catégorie réinitialise la sous-catégorie (parité legacy).
  const handleCategoryChange = (c: string) => {
    setCategory(c);
    setUsage("");
  };

  const query = useMemo(
    () => ({ search, category, usage, isOpenSource: isOpenSource || undefined }),
    [search, category, usage, isOpenSource],
  );

  const {
    tools,
    totalCount,
    facets,
    error,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
    lastItemRef,
  } = useToolsCatalog({
    formId: props.formId,
    step: props.step,
    finderPath: props.finderPath,
    query,
    indexStep: props.indexStep ?? 24,
  });

  const title = props.title ? t(props.title) : t("title");
  const description = props.description ? t(props.description) : "";
  const placeholder = props.searchPlaceholder ? t(props.searchPlaceholder) : t("searchPlaceholder");

  const showCategory = props.showCategoryFilter !== false;
  const showUsage = !!props.showUsageFilter;
  const wantsSidebar = showCategory || showUsage;
  const hasFacets = facets.categories.length > 0 || facets.usages.length > 0;
  const loadingContent = isPending || isLoading;
  // Sidebar réservée dès le chargement (layout stable) : placeholder tant que les
  // facettes ne sont pas là, filtres réels ensuite (les facettes persistent au refetch).
  const showSidebar = wantsSidebar && (loadingContent || hasFacets);

  const cols = props.columns ?? {};
  const gridClass = [
    "grid grid-cols-1 gap-4",
    colClass("sm", cols.sm ?? 2),
    colClass("md", cols.md),
    colClass("lg", cols.lg ?? 3),
    colClass("xl", cols.xl ?? 3),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full">
      {/* En-tête */}
      <div className="mb-5 flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>

          {/* Répondre au formulaire d'usage — occupe la place de la bascule de vue,
              descendue dans la barre de contrôle avec les autres réglages d'affichage.
              Affiché aux seuls utilisateurs connectés (parité du `if (session.userId)`
              legacy) et ouvert EN MODALE : le parcours « Mes lieux » se déroule sans
              quitter le catalogue. */}
          {/* `ClientOnly` : `me` est toujours null au SSR, donc le bouton apparaîtrait
              après hydratation en décalant l'en-tête. */}
          <ClientOnly>
            {() =>
              props.showAnswerButton && me ? (
                <Button type="button" size="lg" className="rounded-full" onClick={() => setAnswering(true)}>
                  <PenLine className="mr-2 h-4 w-4" />
                  {props.answerButtonLabel ? t(props.answerButtonLabel) : t("answerButton")}
                </Button>
              ) : null
            }
          </ClientOnly>
        </div>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>

      <div
        className={
          showSidebar
            ? "lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]"
            : ""
        }
      >
        {/* Barre latérale de filtres (catégorie / sous-catégorie) */}
        {showSidebar && (
          <aside className="mb-6 rounded-xl border border-border bg-muted/30 p-4 lg:mb-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
            {hasFacets ? (
              <ToolFilters
                facets={facets}
                category={category}
                usage={usage}
                showCategory={showCategory}
                showUsage={showUsage}
                onCategoryChange={handleCategoryChange}
                onUsageChange={setUsage}
              />
            ) : (
              <ToolFiltersSkeleton />
            )}
          </aside>
        )}

        {/* Colonne principale */}
        <div className="min-w-0">
          {/* Recherche (plafonnée, à gauche) ; à droite les réglages d'affichage :
              filtre open source COMPACTÉ en pastille (même vocabulaire visuel que les
              filtres de la barre latérale, au lieu d'un switch + libellé long) puis la
              bascule grille/liste, descendue ici depuis l'en-tête pour laisser la place
              au bouton de réponse. */}
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {props.showSearch !== false && (
                <div className="relative w-full sm:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={placeholder}
                    className="pl-9"
                  />
                </div>
              )}
              <div className="flex shrink-0 items-center gap-2">
                {props.showOpenSourceToggle && (
                  <button
                    type="button"
                    aria-pressed={isOpenSource}
                    onClick={() => setIsOpenSource((v) => !v)}
                    title={t("filter.openSource")}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isOpenSource
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {t("openSourceBadge")}
                  </button>
                )}
                <div className="inline-flex items-center gap-1 rounded-md border border-border p-0.5">
                  <Button
                    type="button"
                    variant={view === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label={t("view.grid")}
                    aria-pressed={view === "grid"}
                    onClick={() => setView("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={view === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label={t("view.list")}
                    aria-pressed={view === "list"}
                    onClick={() => setView("list")}
                  >
                    <ListIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            {props.showResultCount !== false && !isPending && !error && (
              <p className="text-sm text-muted-foreground">
                {t("resultCount", undefined, { count: totalCount })}
              </p>
            )}
          </div>

          {/* Contenu */}
          {loadingContent ? (
            <ToolsCatalogSkeleton gridClass={gridClass} />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-8 text-center text-destructive">
              <AlertCircle className="h-6 w-6" />
              <span className="text-sm">{t("error")}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                {t("retry")}
              </Button>
            </div>
          ) : tools.length === 0 ? (
            <SectionEmptyState message={t("empty")} />
          ) : view === "grid" ? (
            <div className={gridClass}>
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} onOpen={setSelectedTool} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tools.map((tool) => (
                <ToolListRow key={tool.id} tool={tool} onOpen={setSelectedTool} />
              ))}
            </div>
          )}

          {/* Sentinelle défilement infini */}
          {!isLoading && !error && tools.length > 0 && (
            <>
              <div ref={lastItemRef} className="h-8" />
              {isFetchingNextPage && (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t("loadingMore")}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modale détail (montée conditionnellement → state frais) */}
      {selectedTool && (
        <ToolDetailDialog
          tool={selectedTool}
          formId={props.formId}
          step={props.step}
          finderPath={props.finderPath}
          showCommunInfo={props.showCommunInfo}
          communFormId={props.communFormId}
          enableEnrichmentEditing={props.enableEnrichmentEditing}
          communUrlTemplate={props.communUrlTemplate}
          onClose={() => setSelectedTool(null)}
        />
      )}

      {/* Montée seulement à l'ouverture : le formulaire et la liste des lieux ne
          sont chargés que si l'utilisateur clique. */}
      {answering && (
        <Suspense fallback={null}>
          <ToolsAnswerDialog formId={props.formId} open onOpenChange={setAnswering} />
        </Suspense>
      )}
    </div>
  );
}
