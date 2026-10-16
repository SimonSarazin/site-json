import { useT } from "@/hooks/useT";
import { CommunActionBar } from "../CommunActionBar.tsx";
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
                <CommunActionBar {...vm.actions} />

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

                    <div className="lg:col-span-9 space-y-20">

                        {funding && (
                            <Section id="besoins-financiers" title={String(t("detail.toc.financialNeeds"))}>
                                <CommunFinancingSection {...funding.section} />
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
