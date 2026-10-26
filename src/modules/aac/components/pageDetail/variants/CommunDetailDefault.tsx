import { useT } from "@/hooks/useT";
import { CommunActionBar } from "../CommunActionBar.tsx";
import { CommunDiscussionControl } from "../CommunDiscussionControl.tsx";
import { CommunMilestoneDiscussionButton } from "../CommunMilestoneDiscussionButton.tsx";
import { CommunHero } from "../CommunHero.tsx";
import { CommunFinancingCard } from "../CommunFinancingCard.tsx";
import { CommunTocNav } from "../CommunTocNav.tsx";
import { CommunFinancingSection } from "../CommunFinancingSection.tsx";
import { CommunActionsSection } from "../CommunActionsSection.tsx";
import { CommunContributorsSection } from "../CommunContributorsSection.tsx";
import { CommunCofinancersTable } from "../CommunCofinancersTable.tsx";
import { CommunProse } from "../CommunProse.tsx";
import { GallerySection } from "../CommunContentSections.tsx";
import { SectionBodySkeleton } from "../CommunSkeletons.tsx";
import { CommunSection as Section } from "../CommunSection";
import { useCommunToc } from "../../../hooks/useCommunToc";
import type { CommunDetailReadyVM } from "../../../hooks/useCommunDetailController";

/** Fiche d'un commun, interface par défaut : héros, sommaire à ancres, blocs empilés. Vue du contrôleur. */
export default function CommunDetailDefault({ vm }: { vm: CommunDetailReadyVM }) {
    const t = useT("modules/aac");
    const toc = useCommunToc(vm);
    const { funding, objectives } = vm;

    return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
                <CommunActionBar
                    {...vm.actions}
                    discussion={<CommunDiscussionControl key={vm.discussion.answerId} {...vm.discussion} />}
                />

                {/* Sans carte de financement, le héros prend toute la largeur. */}
                <div className={funding ? "grid lg:grid-cols-12 gap-8 lg:gap-12 mb-14" : "mb-14"}>
                    <CommunHero {...vm.hero} />

                    {funding && (
                        <CommunFinancingCard {...funding.card} />
                    )}
                </div>

                <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
                    <CommunTocNav
                        sections={toc.sections}
                        activeSection={toc.activeSection}
                        isLoading={toc.isLoading}
                    />

                    {/* `min-w-0` : un item de grille ne rétrécit pas sous son contenu le plus large. Sans
                        lui, une seule ligne insécable (une adresse web dans un texte) élargissait toute la
                        colonne sur écran étroit — paliers compris, dont les boutons sortaient de l'écran. */}
                    <div className="lg:col-span-9 min-w-0 space-y-20">

                        {funding && (
                            <Section id="besoins-financiers" title={String(t("detail.toc.financialNeeds"))}>
                                <CommunFinancingSection
                                    {...funding.section}
                                    // Un fil par palier, comme « Commenter » sur chaque carte de la liste des
                                    // dépenses du legacy : il ouvre l'espace de discussion du commun sur le fil
                                    // de la ligne.
                                    renderMilestoneDiscussion={({ lineKey, name }) => (
                                        <CommunMilestoneDiscussionButton answerId={vm.discussion.answerId} lineKey={lineKey} name={name} />
                                    )}
                                />
                            </Section>
                        )}

                        {/* Phase non résolue : titre et ancre gardés, corps en squelette. */}
                        {objectives.phase === "unresolved" ? (
                            <Section id="objectifs" title={String(t("detail.toc.actions"))}>
                                <SectionBodySkeleton rows={2} />
                            </Section>
                        ) : objectives.phase === "project" ? (
                            <Section id="objectifs" title={String(t("detail.toc.actions"))}>
                                <CommunActionsSection {...objectives.actions} />
                            </Section>
                        ) : null}

                        {objectives.phase === "unresolved" ? (
                            <Section id="contributeurs" title={String(t("detail.toc.contributors"))}>
                                <SectionBodySkeleton rows={2} />
                            </Section>
                        ) : objectives.phase === "project" ? (
                            <Section id="contributeurs" title={String(t("detail.toc.contributors"))}>
                                <CommunContributorsSection {...objectives.contributors} />
                            </Section>
                        ) : null}

                        {funding && (
                            <Section id="cofinanceurs" title={String(t("detail.toc.cofinancers"))}>
                                <CommunCofinancersTable {...funding.cofinancers} />
                            </Section>
                        )}

                        {vm.prose.map((section) => (
                            <Section
                                key={section.id}
                                id={section.id}
                                title={section.title}
                                kicker={section.kicker}
                            >
                                <CommunProse paragraphs={section.paragraphs} />
                            </Section>
                        ))}

                        {vm.gallery ? (
                            <Section id="galerie" title={String(t("detail.toc.gallery"))}>
                                <GallerySection images={vm.gallery.images} />
                            </Section>
                        ) : null}
                    </div>
                </div>
            </div>
    );
}
