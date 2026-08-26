import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { AlertCircle, Home, Sparkles, ListChecks, Handshake, Layers, UsersRound, Scale, HandHeart, FileText, Users, UserCheck, Pencil, Image as ImageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { getBaseUrl } from "@/lib/constant/common";
import type { CoFormAnswer, CoFormData, AnswerDocumentFile } from "@/modules/coform/types";
import { CoFormModal } from "@/modules/coform/components/CoFormModal";
import { useAacConfig } from "../hooks/useAacConfig";
import { useAacPermissions } from "../hooks/useAacPermissions";
import { useAacDirectoryContext } from "../hooks/useAacDirectoryContext";
import { resolveAnswerAuthorId } from "../lib/answerAuthor";
import { isSelectedIn, type ChooseProposalValue } from "@/modules/coform/utils/chooseProposal";
import { CommunSelectionControl } from "../components/pageDetail/CommunSelectionControl.tsx";

import { CommunHero } from "../components/pageDetail/CommunHero.tsx";
import { CommunFinancingCard } from "../components/pageDetail/CommunFinancingCard.tsx";
import { CommunTocNav, type TocSection } from "../components/pageDetail/CommunTocNav.tsx";
import { CommunFinancingSection } from "../components/pageDetail/CommunFinancingSection.tsx";
import { CommunActionsSection } from "../components/pageDetail/CommunActionsSection.tsx";
import { CommunCofinancersTable } from "../components/pageDetail/CommunCofinancersTable.tsx";
import { CommunProse } from "../components/pageDetail/CommunProse.tsx";
import { GallerySection, type GalleryImage } from "../components/pageDetail/CommunContentSections.tsx";
import { useAacFundingResource } from "../hooks/useAacFundingResource";
import { canManageObjectiveActions } from "@/modules/aac/lib/objectiveHelpers";

export interface Task {
    label: string;
    done: boolean;
}

export interface Objective {
    title: string;
    collected: number;
    goal: number;
    tasks: Task[];
}

const AAP_STEP1_FIELD_KEYS = {
    modeleEconomique: "aapStep1lpvinn7ld70wbk7w339",
    gouvernance: "aapStep1lpvioouzejcnjy7ffw",
    cadreJuridique: "aapStep1lpvip7f9pa6et762ysa",
    partenariats: "aapStep1lpvipvzp13vf2jypqgxq",
    modalitesContribution: "aapStep1lqb428ajrbhwdbmg6qi",
    casUsages: "aapStep1lusoklfzokkn4svl1ei",
    equipeCommunaute: "aapStep1m0w49vpl5jm001xwvsv",
} as const;

const GALLERY_IMAGE_SUBKEY = "aapStep1.image";

function extractGalleryImages(
    documents: CoFormAnswer["documents"],
    baseUrl: string
): GalleryImage[] {
    const list: AnswerDocumentFile[] = Array.isArray(documents)
        ? documents
        : documents
            ? Object.values(documents)
            : [];

    return list
        .filter((doc) => doc?.subKey === GALLERY_IMAGE_SUBKEY && doc?.name)
        .map((doc) => ({
            src: `${baseUrl}/upload/${doc.moduleId}/${doc.folder}/${doc.name}`,
            alt: doc.name,
        }));
}

const STATIC_SECTIONS: TocSection[] = [
    { id: "cofinanceurs", label: "Cofinanceurs", icon: Handshake },
    { id: "modele", label: "Modèle économique", icon: Layers },
    { id: "gouvernance", label: "Gouvernance", icon: UsersRound },
    { id: "juridique", label: "Cadre juridique", icon: Scale },
    { id: "partenariats", label: "Partenariats", icon: HandHeart },
    { id: "contribution", label: "Contribution", icon: FileText },
    { id: "usages", label: "Cas d'usages", icon: Users },
    { id: "equipe", label: "Équipe & communauté", icon: UserCheck },
    { id: "galerie", label: "Galerie", icon: ImageIcon },
];

export default function AacCommunDetailPage() {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const { answerId } = useParams();
    const { api, loading, entity } = useCocolight();
    const perms = useAacPermissions(entity);

    const { targetResource } = useAacFundingResource(answerId);

    // Le bloc "Objectifs" n'existe que côté projet — une proposition pas
    // encore promue en projet n'a pas d'actions.
    const canManageActions = canManageObjectiveActions(targetResource?.projectId);

    const SECTIONS: TocSection[] = useMemo(() => [
        { id: "besoins-financiers", label: "Besoins financiers", icon: Sparkles },
        ...(canManageActions ? [{ id: "objectifs", label: "Objectifs", icon: ListChecks }] : []),
        ...STATIC_SECTIONS,
    ], [canManageActions]);

    // État de la section active
    const [activeSection, setActiveSection] = useState("besoins-financiers");
    // Édition de la réponse CoForm à l'intérieur de la page (pas de navigation).
    const [isEditOpen, setIsEditOpen] = useState(false);
    const isReady = !loading && !!api;

    // Requête CoForm
    const answerQuery = useQuery({
        queryKey: ["aac-commun-detail", answerId],
        enabled: isReady && !!answerId,
        staleTime: 2 * 60 * 1000,
        queryFn: async (): Promise<CoFormAnswer> => {
            if (!api || !answerId) throw new Error("Missing answer id");
            const answer = await api.answer({ id: answerId });
            return answer.serverData as unknown as CoFormAnswer;
        },
    });

    // L'annuaire DE CE SITE : c'est lui qui dit sous quel contexte la sélection
    // s'écrit, quelle étape porte l'input `choose`, et surtout quel formulaire
    // fait autorité. Aucune requête supplémentaire — même entrée de cache que
    // `useAacConfig` ci-dessous.
    const directory = useAacDirectoryContext();

    /** Le formulaire sur lequel la réponse a été DÉPOSÉE — pas forcément celui d'ici. */
    const originFormId = answerQuery.data?.form;

    /**
     * Le formulaire qui fait autorité : celui de L'APPEL COURANT.
     *
     * Un commun déposé sur un autre appel peut être listé ici — il suffit que
     * l'admin d'ici l'ait sélectionné (mesuré : 8 réponses de l'appel
     * « tiers lieux » portent le contexte « Fédération des CAE »). Le rendre
     * avec le formulaire de son appel d'ORIGINE afficherait les questions d'un
     * autre appel, et son nom en titre de page.
     *
     * Parité legacy : `campDetail.php:2138` force `costum.mainFormId` et ne
     * retombe sur le formulaire de la réponse qu'à défaut — d'où le `??`.
     *
     * Les réponses étant indexées par `answers.<étape>.<clé d'input>`, les
     * champs que les deux appels ont en commun (titre, image, dépense…) se
     * remplissent d'eux-mêmes : aucune recopie, c'est la structure qui le fait.
     * Les clés propres à l'appel d'origine ne sont pas rendues ici, mais ne
     * sont pas perdues pour autant — `SaveAnswerAction` fusionne clé par clé.
     */
    const formId = directory.formId ?? originFormId;
    const isCommunEtranger = Boolean(originFormId && formId && originFormId !== formId);

    // Requête Configuration Formulaire
    const formQuery = useQuery({
        queryKey: ["aac-commun-form", formId],
        enabled: isReady && !!formId,
        staleTime: 5 * 60 * 1000,
        queryFn: async (): Promise<CoFormData> => {
            if (!api || !formId) throw new Error("Missing form id");
            const form = await api.form({ id: formId });
            return form.serverData as unknown as CoFormData;
        },
    });

    // Nom de l'appel d'ORIGINE — uniquement quand il diffère, pour que l'admin
    // sache qu'il édite un commun déposé ailleurs. Une requête de plus, dans un
    // cas rare, contre une action à l'aveugle sur le document d'autrui.
    const originFormQuery = useQuery({
        queryKey: ["aac-commun-origin-form", originFormId],
        enabled: isReady && isCommunEtranger && !!originFormId,
        staleTime: 5 * 60 * 1000,
        queryFn: async (): Promise<string | null> => {
            if (!api || !originFormId) return null;
            const form = await api.form({ id: originFormId });
            return (form.serverData as { name?: string } | undefined)?.name ?? null;
        },
    });

    // Requête Configuration Aac
    const { config, error: configError } = useAacConfig(formId ?? null);

    useEffect(() => {
        if (configError) {
            console.error("[AacCommunDetailPage] échec de chargement de la configuration AAC", configError);
        }
    }, [configError]);

    const pageTitle = useMemo(() => {
        return formQuery.data?.name || String(t("page.communDetail"));
    }, [formQuery.data?.name, t]);

    useEffect(() => {
        if (typeof document !== "undefined") document.title = pageTitle;
    }, [pageTitle]);

    const isDataLoaded = answerQuery.isSuccess && formQuery.isSuccess;

    useEffect(() => {
        if (!isDataLoaded) return;

        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        };

        const observerOptions: IntersectionObserverInit = {
            rootMargin: "-20% 0px -65% 0px",
            threshold: 0,
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);

        SECTIONS.forEach((section) => {
            const element = document.getElementById(section.id);
            if (element) {
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
    }, [isDataLoaded, SECTIONS]);

    if (!answerId) return <PageShell><ErrorCard title={String(t("page.communDetail"))} description={String(t("page.missingAnswer"))} /></PageShell>;
    if (answerQuery.isLoading || formQuery.isLoading) return <PageShell><LoadingCard label={String(t("page.loading"))} /></PageShell>;
    if (answerQuery.error || formQuery.error) return <PageShell><ErrorCard title={String(t("page.error"))} description="Une erreur est survenue." /></PageShell>;
    if (!answerQuery.data || !formQuery.data) return <PageShell><ErrorCard title={String(t("page.notFound"))} description={String(t("page.notFoundMessage"))} /></PageShell>;

    const answer = answerQuery.data;
    const formData = formQuery.data;

    // Auteur OU admin peut modifier le commun. Cf. `resolveAnswerAuthorId` pour
    // le piège : `answer.user` n'est PAS l'auteur sur un commun porté par une
    // organisation.
    const authorId = resolveAnswerAuthorId(answer);
    const canEditThisCommun = perms.canEditCommun({ authorId });

    const handleEditSubmit = async () => {
        await answerQuery.refetch();
        toast.success(String(t("detail.edit.successToast")));
    };

    // Statut de publication dans l'annuaire de CE site.
    //
    // Même sémantique que les cartes de l'annuaire (`parseAacAnswer`) : l'ABSENCE
    // d'entrée vaut « non sélectionné », comme côté backend. `null` — donc aucun
    // badge — est réservé à ce qu'on ne peut pas savoir : pas de question
    // `choose` résolue, ou pas de contexte identifié.
    const chooseRef = directory.fields.choose;
    const chooseStepKey = chooseRef?.stepKey ?? null;
    const chooseValue = chooseStepKey
        ? ((answer.answers?.[chooseStepKey] as Record<string, unknown> | undefined)?.choose as
              | ChooseProposalValue
              | undefined)
        : undefined;
    const isSelected =
        chooseStepKey && directory.contextId
            ? isSelectedIn(chooseValue, directory.contextId)
            : null;

    // L'étape d'ÉVALUATION n'est pas proposée à qui n'administre pas l'appel :
    // un déposant peut corriger son commun sans se voir offrir les critères qui
    // servent à le juger, ni la case qui décide de sa publication. Retirée du
    // parse, donc aussi du schéma Zod — sinon un critère requis empêcherait
    // l'auteur d'enregistrer, sur une étape qu'il ne voit pas.
    // Pas de `useMemo` : on est APRÈS les retours anticipés, un hook ici serait
    // appelé conditionnellement. `SmartCoForm` mémoïse de toute façon sur le
    // CONTENU de la liste, pas sur sa référence.
    const hiddenStepsForEdit = !perms.isAdmin && chooseStepKey ? [chooseStepKey] : [];

    // Rafraîchit la fiche affichée. Les caches de l'annuaire, eux, sont
    // invalidés par la MUTATION elle-même (`extraInvalidate`) : ce callback-ci
    // n'est pas exécuté si l'utilisateur quitte la page avant la réponse.
    const handleSelectionDone = async () => {
        await answerQuery.refetch();
    };

    const galleryImages = extractGalleryImages(answer.documents, getBaseUrl());

    const modeleEco = [String(answer?.answers?.aapStep1?.[AAP_STEP1_FIELD_KEYS.modeleEconomique] ?? "")];
    const gouvernance = [String(answer?.answers?.aapStep1?.[AAP_STEP1_FIELD_KEYS.gouvernance] ?? "")];
    const juridique = [String(answer?.answers?.aapStep1?.[AAP_STEP1_FIELD_KEYS.cadreJuridique] ?? "")];
    const partenariats = [String(answer?.answers?.aapStep1?.[AAP_STEP1_FIELD_KEYS.partenariats] ?? "")];
    const modalites = [String(answer?.answers?.aapStep1?.[AAP_STEP1_FIELD_KEYS.modalitesContribution] ?? "")];
    const usages = [String(answer?.answers?.aapStep1?.[AAP_STEP1_FIELD_KEYS.casUsages] ?? "")];
    const equipe = [String(answer?.answers?.aapStep1?.[AAP_STEP1_FIELD_KEYS.equipeCommunaute] ?? "")];
    return (
        <PageShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
                {/* Une condition PAR bouton : « Modifier » est ouvert à l'auteur,
                    la sélection au seul admin de l'appel. Une garde commune
                    priverait l'auteur non-admin de son bouton d'édition. */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    {canEditThisCommun && formId && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setIsEditOpen(true)}
                        >
                            <Pencil className="size-3.5" />
                            {String(t("detail.edit.cta"))}
                        </Button>
                    )}

                    <CommunSelectionControl
                        api={api}
                        isAdmin={perms.canSelectCommun}
                        isSelected={isSelected}
                        contextId={directory.contextId}
                        contextType={directory.context?.type ?? null}
                        contextName={directory.context?.name ?? null}
                        subFormId={chooseStepKey}
                        formId={formId ?? null}
                        answerId={answerId ?? null}
                        onDone={handleSelectionDone}
                    />
                </div>

                {/* Top Banner */}
                <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 mb-14">
                    <CommunHero 
                        formData={formData}
                        answerData={answer.answers ?? {}}
                        aacConfig={config}
                        depositedOnName={isCommunEtranger ? (originFormQuery.data ?? null) : null}
                    />

                    <CommunFinancingCard 
                        formData={formData}
                        answerQuery={answer ?? {}}
                        aacConfig={config}
                        funding={targetResource}
                    />
                </div>

                <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
                    <CommunTocNav sections={SECTIONS} activeSection={activeSection} />

                    <div className="lg:col-span-9 space-y-20">

                        <Section id="besoins-financiers" title="Besoins financiers" kicker="Paliers">
                            <CommunFinancingSection
                                formData={formData}
                                answerQuery={answer ?? {}}
                                aacConfig={config}
                                funding={targetResource}
                            />
                        </Section>

                        {canManageActions && (
                            <Section id="objectifs" title="Objectifs" kicker="Actions">
                                <CommunActionsSection
                                    formData={formData}
                                    answerQuery={answer ?? {}}
                                    aacConfig={config}
                                    funding={targetResource}
                                />
                            </Section>
                        )}

                        <Section id="cofinanceurs" title="Cofinanceurs" kicker="Partenaires engagés">
                            <CommunCofinancersTable 
                                formData={formData}
                                answerQuery={answer ?? {}}
                                aacConfig={config}
                                funding={targetResource}
                            />
                        </Section>

                        {/* Modèle économique */}
                        <Section id="modele" title="Modèle économique">
                            <CommunProse 
                                paragraphs={modeleEco}
                            />
                        </Section>

                        {/* Gouvernance */}
                        <Section id="gouvernance" title="Mode de gouvernance">
                            <CommunProse 
                                paragraphs={gouvernance}
                            />
                        </Section>

                        {/* Cadre Juridique */}
                        <Section id="juridique" title="Choix juridiques de protection">
                            <CommunProse 
                                paragraphs={juridique}
                            />
                        </Section>

                        {/* Partenariats */}
                        <Section id="partenariats" title="Partenariats & coopération">
                            <CommunProse 
                                paragraphs={partenariats}
                            />
                        </Section>

                        {/* Modalités de contribution */}
                        <Section id="contribution" title="Modalités de contribution">
                            <CommunProse 
                                paragraphs={modalites}
                            />
                        </Section>

                        {/* Cas d'usages */}
                        <Section id="usages" title="Cas d'usages du commun">
                            <CommunProse 
                                paragraphs={usages}
                            />
                        </Section>

                        {/* Équipe & communauté */}
                        <Section id="equipe" title="Équipe & communauté">
                            <CommunProse
                                paragraphs={equipe}
                            />
                        </Section>

                        <Section id="galerie" title="Galerie" kicker="Photos">
                            <GallerySection images={galleryImages} />
                        </Section>
                    </div>
                </div>
            </div>

            {canEditThisCommun && formId && (
                <CoFormModal
                    formId={formId}
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    title={String(t("detail.edit.title"))}
                    answerId={answerId}
                    defaultValues={answer.answers}
                    hiddenStepKeys={hiddenStepsForEdit}
                    onAfterSubmit={handleEditSubmit}
                />
            )}
        </PageShell>
    );
}

function PageShell({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <SiteHeader />
            <main className="flex-1 py-8">
                <div className="container mx-auto">{children}</div>
            </main>
            <SiteFooter />
        </div>
    );
}

function LoadingCard({ label }: { label: string }) {
    return (
        <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
            <div className="mb-6 rounded-full bg-muted/50 p-6 ring-1 ring-border shadow-sm">
                <Spinner className="h-12 w-12 text-primary" label={label} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground" aria-hidden="true">{label}</p>
        </div>
    );
}

function ErrorCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
            <div className="mb-6 rounded-full bg-muted/50 p-6 ring-1 ring-border shadow-sm">
                <AlertCircle className="h-12 w-12 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-6">
                <Button asChild variant="outline" className="gap-2">
                    <Link to="/">
                        <Home className="h-4 w-4" />
                        Retour à l'accueil
                    </Link>
                </Button>
            </div>
        </div>
    );
}

export function Section({
    id,
    title,
    kicker,
    children,
}: {
    id: string;
    title: string;
    kicker?: string;
    children: ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-24">
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">{title}</h2>
                {kicker && (
                    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {kicker}
          </span>
                )}
            </div>
            {children}
        </section>
    );
}