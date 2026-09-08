import { ReactNode, type ElementType, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { AlertCircle, Home, Sparkles, ListChecks, Handshake, FileText, HeartHandshake, Pencil, Image as ImageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
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
import type { AacPermissionData } from "../permissions";
import { useAacDirectoryContext } from "../hooks/useAacDirectoryContext";
import { resolveAnswerAuthorId } from "../lib/answerAuthor";
import { isSelectedIn, type ChooseProposalValue } from "@/modules/coform/utils/chooseProposal";
import { CommunSelectionControl } from "../components/pageDetail/CommunSelectionControl.tsx";
import { CommunProjectControl } from "../components/pageDetail/CommunProjectControl.tsx";

import { CommunHero } from "../components/pageDetail/CommunHero.tsx";
import { CommunFinancingCard } from "../components/pageDetail/CommunFinancingCard.tsx";
import { CommunTocNav, type TocSection } from "../components/pageDetail/CommunTocNav.tsx";
import { CommunFinancingSection } from "../components/pageDetail/CommunFinancingSection.tsx";
import { CommunActionsSection } from "../components/pageDetail/CommunActionsSection.tsx";
import { CommunMilestoneDialogs } from "../components/pageDetail/CommunMilestoneDialogs.tsx";
import { useCommunObjectivesController } from "../hooks/useCommunObjectivesController";
import { CommunContributorsSection } from "../components/pageDetail/CommunContributorsSection.tsx";
import { CommunCofinancersTable } from "../components/pageDetail/CommunCofinancersTable.tsx";
import { CommunProse } from "../components/pageDetail/CommunProse.tsx";
import { GallerySection, type GalleryImage } from "../components/pageDetail/CommunContentSections.tsx";
import { useAacFundingResource } from "../hooks/useAacFundingResource";
import { useCommunFundingHost } from "../hooks/useCommunFundingHost";
import { useCommunFundingContext } from "../hooks/useCommunFundingContext";
import { canManageObjectiveActions } from "@/modules/aac/lib/objectiveHelpers";
import { useAacDetailSections, useAacGallerySubKey } from "../hooks/useAacDetailSections";
import type { AacDetailSection } from "../lib/resolveAacDetailSections";
// Enregistre le bundle i18n "modules/aac". Les SECTIONS le font déjà ; sans cet
// import, une arrivée DIRECTE sur la route (lien partagé, F5) rendait la page
// avant tout enregistrement — et `t()` retournait les clés brutes.
import "../i18n";

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

/** @param subKey le `subKey` que porte un document de galerie, déclaré par le site. */
function extractGalleryImages(
    documents: CoFormAnswer["documents"],
    baseUrl: string,
    subKey: string | null
): GalleryImage[] {
    if (!subKey) return [];

    const list: AnswerDocumentFile[] = Array.isArray(documents)
        ? documents
        : documents
            ? Object.values(documents)
            : [];

    return list
        .filter((doc) => doc?.subKey === subKey && doc?.name)
        .map((doc) => ({
            src: `${baseUrl}/upload/${doc.moduleId}/${doc.folder}/${doc.name}`,
            alt: doc.name,
        }));
}

/**
 * L'icône d'un bloc déclaré. Le nom vient de la config ; inconnu ou absent, on
 * retombe sur `FileText` plutôt que de ne rien rendre au sommaire.
 */
function iconFor(name?: string): ElementType {
    if (!name) return FileText;
    return ({ className }: { className?: string }) => (
        <DynamicIcon name={name as IconName} className={className} />
    );
}

/**
 * Le contenu d'un bloc, lu par sa référence résolue.
 *
 * Rend un tableau VIDE quand la réponse ne porte rien — et non `[""]`, que
 * produisait l'ancienne forme `[String(x ?? "")]` : un tableau d'une chaîne vide
 * a une longueur de 1, donc un bloc sans contenu était indistinguable d'un bloc
 * rempli, et se rendait vide.
 */
function proseOf(answer: CoFormAnswer | undefined, section: AacDetailSection): string[] {
    const brut = section.field.stepKey
        ? (answer?.answers as Record<string, Record<string, unknown>> | undefined)
              ?.[section.field.stepKey]?.[section.field.id]
        : (answer as Record<string, unknown> | undefined)?.[section.field.id];

    if (Array.isArray(brut)) return brut.map(String).filter((p) => p.trim() !== "");
    const texte = brut == null ? "" : String(brut);
    return texte.trim() === "" ? [] : [texte];
}

export default function AacCommunDetailPage() {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const { answerId } = useParams();
    const { api, loading, entity, me, refreshMe } = useCocolight();

    // État de la section active
    const [activeSection, setActiveSection] = useState("besoins-financiers");
    // Édition de la réponse CoForm à l'intérieur de la page (pas de navigation).
    const [isEditOpen, setIsEditOpen] = useState(false);
    const isReady = !loading && !!api;

    // Requête CoForm
    const answerQuery = useQuery({
        // `me?.id` en dernier segment : `answer.serverData` porte un `access` calculé
        // pour le lecteur. Sans lui, l'entrée d'un anonyme serait resservie à un
        // utilisateur connecté — même motif que `COFORM_QUERY_KEYS.FORM`.
        queryKey: ["aac-commun-detail", answerId, me?.id ?? null],
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

    // L'appel où il a été déposé, et le contexte qui le porte.
    // Le nom de cet appel alimente le bandeau « Déposé sur … » ; son contexte
    // désigne l'entité qui détient l'enveloppe de financement du commun.
    const { context: fundingContext, originFormName } = useCommunFundingContext(answerQuery.data);

    // Requête Configuration Formulaire
    const formQuery = useQuery({
        // Idem : `form.serverData.access.restrictedFields` dépend du lecteur.
        queryKey: ["aac-commun-form", formId, me?.id ?? null],
        enabled: isReady && !!formId,
        staleTime: 5 * 60 * 1000,
        queryFn: async (): Promise<CoFormData> => {
            if (!api || !formId) throw new Error("Missing form id");
            const form = await api.form({ id: formId });
            return form.serverData as unknown as CoFormData;
        },
    });

    // Requête Configuration Aac
    const { config, error: configError } = useAacConfig(formId ?? null);

    /**
     * Les droits se calculent avec les gates DU FORM (`coremu`…). Appelé sans
     * eux, le calculateur ne voyait aucun gate : `canViewFunding` restait faux et
     * les blocs financement ne pouvaient jamais s'afficher. Mémoïsé sur l'objet
     * `gates` — stable tant que la requête ne change pas — parce que
     * `useAacPermissions` recalcule sur l'identité de `data`.
     */
    const permData = useMemo<AacPermissionData>(() => ({ gates: config?.gates }), [config?.gates]);
    const perms = useAacPermissions(entity, permData);

    /**
     * L'entité SUR LAQUELLE lire le financement de ce commun.
     *
     * L'enveloppe n'est pas interrogeable « pour une réponse » : le SDK la scope à
     * l'entité appelante. Lue depuis l'entité du site, elle ne contient que les
     * communs de l'appel d'ici — un commun étranger n'y figure pas, et tout ce qui
     * en découle (montants, projet lié, ciblage de la modale) s'effondre en
     * silence. On interroge donc l'hôte de SON contexte.
     */
    const { hostEntity: fundingHost, isLoading: isFundingHostLoading } =
        useCommunFundingHost(fundingContext);

    const { targetResource, projectSlug } = useAacFundingResource(answerId, {
        hostEntity: fundingHost,
        isHostLoading: isFundingHostLoading,
        // Repli : le document réponse porte déjà son projet et ses dépenses.
        answer: answerQuery.data,
        step: config?.roles.depenseStepKey ?? undefined,
    });

    const isProjectPhase = canManageObjectiveActions(targetResource?.projectId);

    /**
     * Les blocs de prose de la fiche, DÉCLARÉS par `config.aac.detail.sections`.
     *
     * Ils étaient auparavant sept identifiants de questions codés en dur, sept
     * extractions et sept blocs JSX recopiés — pour un seul appel. La résolution
     * réutilise `parseFieldPath` et l'entrée de cache de `aacConfigQuery` : aucune
     * requête supplémentaire.
     */
    const detailSections = useAacDetailSections(formId ?? null);
    const gallerySubKey = useAacGallerySubKey();

    /**
     * Le contrôleur des paliers, monté UNE SEULE FOIS pour la page.
     *
     * « Besoins financiers » et « Suivi des actions » l'appelaient chacun : deux états
     * indépendants pour les mêmes paliers, donc une mutation lancée d'un bloc laissait
     * l'autre périmé. Monté ici, les deux blocs partagent le même état — et leurs
     * dialogues, qui seraient sinon pilotés en double, remontent avec lui dans
     * `CommunMilestoneDialogs`.
     *
     * Appelé AVANT les retours anticipés plus bas : un hook ne se monte pas
     * conditionnellement.
     */
    const objectivesCtrl = useCommunObjectivesController({
        answerQuery: answerQuery.data ?? null,
        funding: targetResource,
    });

    /**
     * Le financement n'existe sur cette fiche que si l'appel a levé le gate
     * MAÎTRE `coremu` (`perms.canViewFunding`) — parité `detailProposal.php:105`,
     * qui masque l'onglet Contributions à tout le monde, admin compris. Une seule
     * variable pour les trois blocs ET leurs entrées de sommaire : un lien vers
     * une ancre absente serait un lien mort.
     */
    const showFunding = perms.canViewFunding;

    /**
     * Le sommaire dérive des MÊMES sources que le rendu : les blocs structurels
     * d'un côté, les blocs déclarés de l'autre. Une seule liste à tenir.
     */
    const SECTIONS: TocSection[] = useMemo(() => [
        ...(showFunding
            ? [{ id: "besoins-financiers", label: String(t("detail.toc.financialNeeds")), icon: Sparkles }]
            : []),
        ...(isProjectPhase
            ? [
                  { id: "objectifs", label: String(t("detail.toc.actions")), icon: ListChecks },
                  { id: "contributeurs", label: String(t("detail.toc.contributors")), icon: HeartHandshake },
              ]
            : []),
        ...(showFunding
            ? [{ id: "cofinanceurs", label: String(t("detail.toc.cofinancers")), icon: Handshake }]
            : []),
        ...detailSections.map((section) => ({
            id: section.id,
            label: section.title,
            icon: iconFor(section.icon),
        })),
        ...(gallerySubKey ? [{ id: "galerie", label: String(t("detail.toc.gallery")), icon: ImageIcon }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` est recréé à chaque rendu (cf. useT) : l'inclure annulerait le mémo.
    ], [showFunding, isProjectPhase, detailSections, gallerySubKey]);

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
    if (answerQuery.error || formQuery.error) return <PageShell><ErrorCard title={String(t("page.error"))} description={String(t("page.errorMessage"))} /></PageShell>;
    if (!answerQuery.data || !formQuery.data) return <PageShell><ErrorCard title={String(t("page.notFound"))} description={String(t("page.notFoundMessage"))} /></PageShell>;

    const answer = answerQuery.data;
    const formData = formQuery.data;

    // Auteur OU admin peut modifier le commun. Cf. `resolveAnswerAuthorId` pour
    // le piège : `answer.user` n'est PAS l'auteur sur un commun porté par une
    // organisation.
    const authorId = resolveAnswerAuthorId(answer);
    const canEditThisCommun = perms.canEditCommun({ authorId });

    const isCommunAuthor = !!authorId && authorId === perms.currentUserId;

    const canManageProject = perms.isAdmin || isCommunAuthor;

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

    const galleryImages = extractGalleryImages(answer.documents, getBaseUrl(), gallerySubKey);

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

                    <CommunProjectControl
                        api={api}
                        canManageProject={canManageProject}
                        answerId={answerId ?? null}
                        projectId={targetResource?.projectId}
                        projectSlug={projectSlug}
                        parentId={directory.contextId}
                        parentType={directory.context?.type ?? null}
                        userId={me?.id ?? null}
                        contextEntity={entity}
                        onGenerated={async () => {
                            await Promise.all([answerQuery.refetch(), refreshMe()]);
                        }}
                    />
                </div>

                {/* Top Banner — sans carte de financement, le héros n'a pas à
                    rester sur 7 colonnes de 12 : on retire la grille plutôt que
                    de laisser un vide à sa droite. */}
                <div className={showFunding ? "grid lg:grid-cols-12 gap-8 lg:gap-12 mb-14" : "mb-14"}>
                    <CommunHero
                        formData={formData}
                        answerData={answer.answers ?? {}}
                        aacConfig={config}
                        depositedOnName={originFormName}
                    />

                    {showFunding && (
                        <CommunFinancingCard
                            formData={formData}
                            answerQuery={answer ?? {}}
                            aacConfig={config}
                            funding={targetResource}
                        />
                    )}
                </div>

                <CommunMilestoneDialogs ctrl={objectivesCtrl} />

                <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
                    <CommunTocNav sections={SECTIONS} activeSection={activeSection} />

                    <div className="lg:col-span-9 space-y-20">

                        {showFunding && (
                            <Section id="besoins-financiers" title={String(t("detail.toc.financialNeeds"))}>
                                <CommunFinancingSection
                                    formData={formData}
                                    aacConfig={config}
                                    funding={targetResource}
                                    ctrl={objectivesCtrl}
                                />
                            </Section>
                        )}

                        {isProjectPhase && (
                            <Section id="objectifs" title={String(t("detail.toc.actions"))}>
                                <CommunActionsSection
                                    formData={formData}
                                    aacConfig={config}
                                    funding={targetResource}
                                    ctrl={objectivesCtrl}
                                />
                            </Section>
                        )}

                        {isProjectPhase && (
                            <Section id="contributeurs" title={String(t("detail.toc.contributors"))}>
                                <CommunContributorsSection
                                    projectId={targetResource?.projectId}
                                    projectSlug={projectSlug}
                                    isCommunAuthor={isCommunAuthor}
                                    authorId={authorId}
                                />
                            </Section>
                        )}

                        {showFunding && (
                            <Section id="cofinanceurs" title={String(t("detail.toc.cofinancers"))}>
                                <CommunCofinancersTable
                                    formData={formData}
                                    answerQuery={answer ?? {}}
                                    aacConfig={config}
                                    funding={targetResource}
                                />
                            </Section>
                        )}

                        {detailSections.map((section) => (
                            <Section
                                key={section.id}
                                id={section.id}
                                title={section.title}
                                kicker={section.kicker}
                            >
                                <CommunProse paragraphs={proseOf(answer, section)} />
                            </Section>
                        ))}

                        {gallerySubKey ? (
                            <Section id="galerie" title={String(t("detail.toc.gallery"))}>
                                <GallerySection images={galleryImages} />
                            </Section>
                        ) : null}
                    </div>
                </div>
            </div>

            {canEditThisCommun && formId && (
                <CoFormModal
                    formId={formId}
                    open={isEditOpen}
                    onOpenChange={(ouvert) => {
                        setIsEditOpen(ouvert);
                        // Les champs « écriture directe » de l'étape d'évaluation
                        // (`choose`, `selection`…) enregistrent SANS soumettre le
                        // formulaire : à la fermeture, la fiche peut être en retard
                        // alors que rien n'a été soumis et que `onAfterSubmit` n'a
                        // donc pas tiré. On relit ici, au bord de la page — le
                        // formulaire n'a pas à piloter le rafraîchissement de ce qui
                        // vit hors de lui.
                        if (!ouvert) void answerQuery.refetch();
                    }}
                    title={String(t("detail.edit.title"))}
                    answerId={answerId}
                    defaultValues={answer.answers}
                    // Sans lui, un brouillon local plus ancien que la réponse
                    // serveur se restaure sans avertir. Cf. `useCoFormDraft`.
                    baseUpdatedAt={answer.updated ?? null}
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
    // Le namespace est déjà chargé par la page ; `useT` seul suffit ici.
    const t = useT("modules/aac");
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
                        {String(t("page.backHome"))}
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