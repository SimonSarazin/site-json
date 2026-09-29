import { useState, type ReactNode } from "react";
import { Layers, MapPin, Pencil, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProseContent } from "@/components/shared/ProseContent";
import { useT } from "@/hooks/useT";
import { usageLabelFromId } from "../../lib/aacUsage";
import { CommunSelectionControl } from "../../components/pageDetail/CommunSelectionControl.tsx";
import { CommunProjectControl } from "../../components/pageDetail/CommunProjectControl.tsx";
import { CommunDeleteControl } from "../../components/pageDetail/CommunDeleteControl";
import { CommunFinancingCard } from "../../components/pageDetail/CommunFinancingCard.tsx";
import { CommunReactionStats } from "../../components/pageDetail/CommunReactionStats.tsx";
import { CommunFinancingSection } from "../../components/pageDetail/CommunFinancingSection.tsx";
import { CommunActionsSection } from "../../components/pageDetail/CommunActionsSection.tsx";
import { CommunContributorsSection } from "../../components/pageDetail/CommunContributorsSection.tsx";
import { CommunNewsSection } from "../../components/pageDetail/CommunNewsSection.tsx";
import { CommunAgendaSection } from "../../components/pageDetail/CommunAgendaSection.tsx";
import { CommunCofinancersTable } from "../../components/pageDetail/CommunCofinancersTable.tsx";
import { CommunProse } from "../../components/pageDetail/CommunProse.tsx";
import { GallerySection } from "../../components/pageDetail/CommunContentSections.tsx";
import { SectionBodySkeleton } from "../../components/pageDetail/CommunSkeletons.tsx";
import { CommunSectionNavContext, tabbedSectionNav } from "../../hooks/useCommunSectionNav";
import type { CommunDetailViewProps } from "../../components/pageDetail/variants/registry";
import type { CommunObjectivesVM } from "../../hooks/useCommunDetailController";
import { EditorialSection } from "./EditorialSection";
import {
  DemoCallsBlock,
  DemoCooperationsTab,
  DemoFeedbackBlock,
  DemoImpactBlock,
  DemoMaturationTab,
  DemoSupportsBlock,
} from "./demo/DemoBlocks";

type TabKey = "fiche" | "action" | "argent" | "communaute" | "vie" | "maturation" | "cooperations";

/** Onglet de chaque ancre de la fiche, ouvert avant le défilement ; la prose est dans « La fiche ». */
const SECTION_TAB: Readonly<Record<string, TabKey>> = {
  "besoins-financiers": "argent",
  cofinanceurs: "argent",
  objectifs: "action",
  contributeurs: "communaute",
  actualites: "vie",
  agenda: "vie",
  galerie: "fiche",
};

/**
 * Fiche d'un commun, interface « editorial » (fiche à onglets de la maquette projets.re).
 * Vue du contrôleur : blocs réels de l'AAC avec les props du contrôleur, contenu de `demo/` pour le reste.
 *  - « Soutenir » est la carte de financement en mise en page `hero` ;
 *  - les réactions sont dans la colonne Exporter / Soutenir à partir de `lg`, sous la description sinon ;
 *  - pas de sommaire : un lien de section ouvre son onglet puis y défile (`SECTION_TAB`, `tabbedSectionNav`).
 */
export default function CommunDetailEditorial({ vm }: CommunDetailViewProps) {
  const t = useT("modules/aac");
  // Onglet ouvert (état d'interface).
  const [tab, setTab] = useState<TabKey>("fiche");
  const showSection = tabbedSectionNav<TabKey>(
    setTab,
    (id) => SECTION_TAB[id] ?? (vm.prose.some((block) => block.id === id) ? "fiche" : null),
  );
  const { card, longDescription, usageLabels } = vm.summary;
  const { funding, objectives } = vm;
  const title = card.hasTitle ? card.title : String(t("directory.card.untitled"));
  const needs = card.usage.categories.map((id) => usageLabels[id] ?? usageLabelFromId(id));
  // Export non branché : bouton désactivé.
  const exportButton = (
    <Button variant="outline" className="gap-2" disabled title={String(t("editorial.detail.soon"))}>
      <Printer className="size-4" aria-hidden="true" />
      {String(t("editorial.detail.export"))}
    </Button>
  );

  return (
    <CommunSectionNavContext.Provider value={showSection}>
      <div className="pb-16">
        <header className="rounded-2xl border border-border bg-accent/30">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
            {/* Les quatre commandes, chacune gardée par son droit (résolu par le contrôleur). */}
            <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={String(t("editorial.detail.commands"))}>
              {vm.actions.edit && (
                <Button variant="outline" size="sm" className="gap-2" onClick={vm.actions.edit.onOpen}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  {String(t("detail.edit.cta"))}
                </Button>
              )}
              <CommunSelectionControl {...vm.actions.selection} />
              <CommunProjectControl {...vm.actions.project} />
              <CommunDeleteControl {...vm.actions.delete} />
            </div>

            {vm.hero.depositedOnName ? (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers className="size-3.5 shrink-0" aria-hidden="true" />
                {String(t("detail.origin.deposedOn", undefined, { name: vm.hero.depositedOnName }))}
              </p>
            ) : null}

            {/* Même grille que le bloc financement : réactions dans la colonne Exporter / Soutenir. */}
            <div className="mt-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
              <div className="min-w-0 lg:col-span-7">
                <h1 className="max-w-3xl font-display text-4xl leading-tight font-semibold text-balance md:text-5xl">
                  {title}
                </h1>
                {card.description && (
                  <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{card.description}</p>
                )}
              </div>
              {funding && (
                <CommunReactionStats
                  {...funding.reactions}
                  compact
                  className="mt-6 grid max-w-xl grid-cols-3 gap-3 lg:col-span-5 lg:mt-2 lg:max-w-none"
                />
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {card.tags.map((tag) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
              {/* Commune ; adresse complète en infobulle. */}
              {card.address?.locality && (
                <span
                  className="flex items-center gap-1.5 text-sm text-muted-foreground"
                  title={card.address.label || undefined}
                >
                  <MapPin className="size-4" aria-hidden="true" />
                  <span className="sr-only">{String(t("directory.card.location"))}</span>
                  {card.address.locality}
                </span>
              )}
            </div>

            {needs.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {needs.map((need) => (
                  <Badge key={need} variant="outline">
                    {need}
                  </Badge>
                ))}
              </div>
            )}

            {funding ? (
              // « Financement réuni » et colonne Exporter / Soutenir ; l'export passe par `secondaryAction`.
              <div className="mt-6">
                <CommunFinancingCard {...funding.card} layout="hero" secondaryAction={exportButton} />
              </div>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-12">
                <div className="flex flex-col gap-2 md:col-span-5 md:col-start-8">{exportButton}</div>
              </div>
            )}
          </div>
        </header>

        {/* Mêmes marges que le héros : onglets alignés sur le titre. */}
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
          <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
            {/* Hauteur libérée (h-9 par défaut) : les sept onglets passent à la ligne sur mobile. */}
            <TabsList className="h-auto flex-wrap justify-start" aria-label={String(t("editorial.detail.tabs.label"))}>
              <TabsTrigger value="fiche" className="flex-none">{String(t("editorial.detail.tabs.fiche"))}</TabsTrigger>
              <TabsTrigger value="action" className="flex-none">{String(t("editorial.detail.tabs.action"))}</TabsTrigger>
              {funding && (
                <TabsTrigger value="argent" className="flex-none">{String(t("editorial.detail.tabs.argent"))}</TabsTrigger>
              )}
              <TabsTrigger value="communaute" className="flex-none">{String(t("editorial.detail.tabs.communaute"))}</TabsTrigger>
              <TabsTrigger value="vie" className="flex-none">{String(t("editorial.detail.tabs.vie"))}</TabsTrigger>
              {/* Onglets de démonstration : libellé en rouge. */}
              <TabsTrigger value="maturation" className="flex-none">
                <span className="text-destructive">{String(t("editorial.detail.tabs.maturation"))}</span>
              </TabsTrigger>
              <TabsTrigger value="cooperations" className="flex-none">
                <span className="text-destructive">{String(t("editorial.detail.tabs.cooperations"))}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fiche" className="mt-6 grid gap-8 lg:grid-cols-3">
              <div className="min-w-0 space-y-6 lg:col-span-2">
                {longDescription.trim() !== "" && (
                  <EditorialSection title={String(t("editorial.detail.project"))}>
                    {/* Markdown d'une réponse coform, profil restreint par défaut. */}
                    <ProseContent
                      text={longDescription}
                      className="prose prose-sm dark:prose-invert mt-3 max-w-none text-[15px] leading-relaxed"
                    />
                  </EditorialSection>
                )}

                {vm.prose.map((block) => (
                  <EditorialSection key={block.id} id={block.id} title={block.title} kicker={block.kicker}>
                    <div className="mt-3">
                      <CommunProse paragraphs={block.paragraphs} />
                    </div>
                  </EditorialSection>
                ))}

                {vm.gallery && (
                  <EditorialSection id="galerie" title={String(t("detail.toc.gallery"))}>
                    <div className="mt-3">
                      <GallerySection images={vm.gallery.images} />
                    </div>
                  </EditorialSection>
                )}
              </div>
              <aside className="min-w-0 space-y-6">
                <DemoImpactBlock />
                <DemoCallsBlock />
              </aside>
            </TabsContent>

            <TabsContent value="action" className="mt-6">
              <ProjectPhaseSection
                objectives={objectives}
                id="objectifs"
                title={String(t("detail.toc.actions"))}
                fallback={
                  <EditorialSection title={String(t("detail.toc.actions"))}>
                    <p className="mt-3 text-sm text-muted-foreground">{String(t("editorial.detail.noProject"))}</p>
                  </EditorialSection>
                }
              >
                {(project) => <CommunActionsSection {...project.actions} />}
              </ProjectPhaseSection>
            </TabsContent>

            {funding && (
              // Dépenses à gauche, cofinanceurs à droite.
              <TabsContent value="argent" className="mt-6 grid gap-8 lg:grid-cols-2">
                <EditorialSection id="besoins-financiers" title={String(t("editorial.detail.expenses"))} className="min-w-0">
                  <div className="mt-4">
                    <CommunFinancingSection {...funding.section} layout="list" />
                  </div>
                </EditorialSection>
                <EditorialSection id="cofinanceurs" title={String(t("detail.toc.cofinancers"))} className="min-w-0">
                  <div className="mt-4">
                    <CommunCofinancersTable {...funding.cofinancers} layout="list" />
                  </div>
                </EditorialSection>
              </TabsContent>
            )}

            <TabsContent value="communaute" className="mt-6 grid gap-8 lg:grid-cols-2">
              <div className="min-w-0 space-y-6">
                <ProjectPhaseSection objectives={objectives} id="contributeurs" title={String(t("detail.toc.contributors"))}>
                  {(project) => <CommunContributorsSection {...project.contributors} />}
                </ProjectPhaseSection>
                <DemoFeedbackBlock />
              </div>
              <div className="min-w-0 space-y-6">
                <DemoSupportsBlock />
              </div>
            </TabsContent>

            <TabsContent value="vie" className="mt-6 grid gap-8 lg:grid-cols-3">
              {objectives.phase === "none" ? (
                <EditorialSection title={String(t("editorial.detail.tabs.vie"))} className="lg:col-span-3">
                  <p className="mt-3 text-sm text-muted-foreground">{String(t("editorial.detail.noProjectLife"))}</p>
                </EditorialSection>
              ) : (
                <>
                  <ProjectPhaseSection
                    objectives={objectives}
                    id="actualites"
                    title={String(t("editorial.detail.news"))}
                    className="min-w-0 lg:col-span-2"
                  >
                    {(project) => <CommunNewsSection {...project.news} />}
                  </ProjectPhaseSection>
                  <ProjectPhaseSection
                    objectives={objectives}
                    id="agenda"
                    title={String(t("editorial.detail.agenda"))}
                    className="min-w-0"
                  >
                    {(project) => <CommunAgendaSection {...project.agenda} />}
                  </ProjectPhaseSection>
                </>
              )}
            </TabsContent>

            <TabsContent value="maturation" className="mt-6">
              <DemoMaturationTab />
            </TabsContent>

            <TabsContent value="cooperations" className="mt-6">
              <DemoCooperationsTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </CommunSectionNavContext.Provider>
  );
}

type ProjectObjectives = Extract<CommunObjectivesVM, { phase: "project" }>;

/** Bloc lié au projet : contenu en phase `project`, squelette pendant la résolution, `fallback` sans projet. */
function ProjectPhaseSection({
  objectives,
  id,
  title,
  className,
  fallback = null,
  children,
}: {
  objectives: CommunObjectivesVM;
  id: string;
  title: string;
  className?: string;
  fallback?: ReactNode;
  children: (project: ProjectObjectives) => ReactNode;
}) {
  if (objectives.phase === "none") return fallback;
  return (
    <EditorialSection id={id} title={title} className={className}>
      <div className="mt-4">
        {objectives.phase === "project" ? children(objectives) : <SectionBodySkeleton rows={2} />}
      </div>
    </EditorialSection>
  );
}
