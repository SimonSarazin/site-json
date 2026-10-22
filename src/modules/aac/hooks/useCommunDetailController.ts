import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { getBaseUrl } from "@/lib/constant/common";
import type { CoFormAnswer, CoFormData } from "@/modules/coform/types";
import type { CoFormModal } from "@/modules/coform/components/CoFormModal";
import { isSelectedIn, type ChooseProposalValue } from "@/modules/coform/utils/chooseProposal";
import { canManageObjectiveActions } from "@/modules/aac/lib/objectiveHelpers";
import { useAacConfig } from "./useAacConfig";
import { useAacPermissions } from "./useAacPermissions";
import type { AacPermissionData } from "../permissions";
import { useAacDirectoryContext } from "./useAacDirectoryContext";
import { resolveAnswerAuthorId } from "../lib/answerAuthor";
import { useCommunObjectivesController } from "./useCommunObjectivesController";
import { COMMUN_RAW_DEPENSES_QUERY_KEY } from "./useCommunRawDepenses";
import { useAacFundingResource } from "./useAacFundingResource";
import { useCommunFundingHost } from "./useCommunFundingHost";
import { useCommunFundingContext } from "./useCommunFundingContext";
import { useAacDemoBlocks, useAacDetailSections, useAacGallerySubKey } from "./useAacDetailSections";
import { useAacFormMeta, useAacFormParams } from "./useAacFormMeta";
import { editorIdsOf, resolveEditorsQuestion } from "../lib/communEditors";
import { resolveCommunSeo } from "../lib/communSeo";
import { extractGalleryImages, proseOf } from "../lib/communDetailContent";
import { communPath } from "../lib/communPath";
import { parseAacAnswer, type AacCommunCard } from "../lib/parseAacAnswer";
import { readUsageLabels } from "../lib/aacUsage";
import { DEFAULT_AAC_STEP } from "@/modules/cagnotte/lib/actionMilestonePathUpdates";
import { COMMUN_ANSWER_QUERY_KEY, COMMUN_FORM_QUERY_KEY, fetchCommunAnswer } from "../prefetch/prefetchCommun";
import type { AacSeoProps } from "../AacSeo";
import type { PostLoginIntent } from "../components/pageDetail/CommunFinancingCard.tsx";
import type { CommunFinancingCard } from "../components/pageDetail/CommunFinancingCard.tsx";
import type { CommunReactionStats } from "../components/pageDetail/CommunReactionStats.tsx";
import type { CommunHero } from "../components/pageDetail/CommunHero.tsx";
import type { CommunActionBarProps } from "../components/pageDetail/CommunActionBar.tsx";
import type { CommunFinancingSection } from "../components/pageDetail/CommunFinancingSection.tsx";
import type { CommunActionsSection } from "../components/pageDetail/CommunActionsSection.tsx";
import type { CommunContributorsSection } from "../components/pageDetail/CommunContributorsSection.tsx";
import type { CommunNewsSection } from "../components/pageDetail/CommunNewsSection.tsx";
import type { CommunAgendaSection } from "../components/pageDetail/CommunAgendaSection.tsx";
import type { CommunCofinancersTable } from "../components/pageDetail/CommunCofinancersTable.tsx";
import type { CommunObjectivesController } from "../components/pageDetail/CommunMilestoneDialogs.tsx";
import type { CommunDiscussionControl } from "../components/pageDetail/CommunDiscussionControl.tsx";
import type { CommunFormLineDiscussions } from "../components/pageDetail/CommunFormLineDiscussions.tsx";
import type { GalleryImage } from "../components/pageDetail/CommunContentSections.tsx";

/**
 * Contrôleur de la fiche d'un commun : toute la logique, aucune mise en page.
 * Une interface n'est qu'une vue de son view-model (ni requête, ni mutation, ni navigation).
 *
 * Forme du view-model :
 *  - union discriminée sur `status` : l'ordre des gardes est fixé ici ;
 *  - blocs `| null` : la vue doit écrire la garde ;
 *  - paquets de props prêts à épandre (`{...vm.actions}`).
 */

/** Un bloc de prose déclaré par `config.aac.detail.sections`, déjà lu dans la réponse. */
export interface CommunProseBlock {
    /** Ancre DOM, cible du sommaire ou de l'onglet. */
    id: string;
    title: string;
    kicker?: string;
    /** Nom d'icône lucide, tel que déclaré (cf. `iconFor`). */
    icon?: string;
    paragraphs: string[];
}

/**
 * Phase du commun, résolue par l'enveloppe de financement. `unresolved` porte
 * `isProjectPhase` lu dans la réponse, pour annoncer les entrées du sommaire.
 */
export type CommunObjectivesVM =
    | { phase: "unresolved"; isProjectPhase: boolean }
    | { phase: "none" }
    | {
          phase: "project";
          actions: ComponentProps<typeof CommunActionsSection>;
          contributors: ComponentProps<typeof CommunContributorsSection>;
          news: ComponentProps<typeof CommunNewsSection>;
          agenda: ComponentProps<typeof CommunAgendaSection>;
      };

/** Commun à tous les états de la fiche, squelette et erreurs compris. */
export interface CommunDetailBaseVM {
    seo: AacSeoProps;
    /** Interface choisie (`config.aac.detail.pageVariant`), préchargée pendant le chargement des données. */
    pageVariant?: string;
}

export interface CommunDetailReadyVM extends CommunDetailBaseVM {
    status: "ready";
    hero: ComponentProps<typeof CommunHero>;
    /** Le commun lu comme dans l'annuaire (même parseur que les cartes), pour les interfaces à badges. */
    summary: {
        card: AacCommunCard;
        /** Descriptif long, lu comme le héros par défaut ; `""` s'il manque. */
        longDescription: string;
        /** Libellés exacts des usages (`form.params`) — repli `usageLabelFromId`. */
        usageLabels: Readonly<Record<string, string>>;
    };
    /** `null` : pas d'étape de financement, tous les blocs de financement disparaissent. */
    funding: {
        card: ComponentProps<typeof CommunFinancingCard>;
        /** Les réactions, pour une interface qui les place hors de la carte. */
        reactions: ComponentProps<typeof CommunReactionStats>;
        section: ComponentProps<typeof CommunFinancingSection>;
        cofinancers: ComponentProps<typeof CommunCofinancersTable>;
    } | null;
    objectives: CommunObjectivesVM;
    prose: CommunProseBlock[];
    /** Blocs déclarés encore en résolution. */
    isProseLoading: boolean;
    /** `null` : le site ne déclare pas de galerie (`config.aac.detail.gallery`). */
    gallery: { images: GalleryImage[] } | null;
    /** Blocs de démonstration de l'interface (`config.aac.detail.demoBlocks`), faux par défaut. */
    demoBlocks: boolean;
    /** Props de la barre d'actions (`CommunActionBar`), un gate par action. */
    actions: CommunActionBarProps;
    /**
     * L'espace de discussion du commun — pour tout le monde, visiteur compris : il se lit sans
     * session. L'interface le rend en tête des actions (`CommunDiscussionControl`, avec `answerId`
     * pour `key` : d'un commun à l'autre, le bouton et sa modale repartent de zéro) et, par
     * `answerId`, le bouton « Discuter » de chaque palier (`CommunMilestoneDiscussionButton`).
     */
    discussion: ComponentProps<typeof CommunDiscussionControl>;
    /** Overlays sans position, rendus par la coquille de la page hors de toute interface. */
    overlays: {
        edit: ComponentProps<typeof CoFormModal> | null;
        /** Les fils de ligne de dépense du formulaire d'édition ; enveloppe `edit`, nul avec lui. */
        editDiscussions: Omit<ComponentProps<typeof CommunFormLineDiscussions>, "children"> | null;
        milestones: CommunObjectivesController;
    };
}

export type CommunDetailVM =
    | ({ status: "missing-answer" } & CommunDetailBaseVM)
    | ({ status: "loading" } & CommunDetailBaseVM)
    | ({ status: "error"; kind: "data" | "config" | "not-found" } & CommunDetailBaseVM)
    | CommunDetailReadyVM;

export function useCommunDetailController(): CommunDetailVM {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const { answerId } = useParams();
    const navigate = useNavigate();
    const { api, loading, entity, me, refreshMe } = useCocolight();
    const queryClient = useQueryClient();

    // Modale d'édition de la réponse, ouverte sur place.
    const [isEditOpen, setIsEditOpen] = useState(false);
    /**
     * Action demandée hors connexion (réagir, financer), rejouée à l'arrivée de la session.
     * Portée ici : la connexion change les clés user-scopées, la vue est démontée pendant le rechargement.
     */
    const [postLoginIntent, setPostLoginIntent] = useState<PostLoginIntent | null>(null);
    const isReady = !loading && !!api;

    const answerQuery = useQuery({
        // Clé partagée avec le loader SSR ; `me?.id` en dernier : `access` dépend du lecteur.
        queryKey: COMMUN_ANSWER_QUERY_KEY(answerId ?? null, me?.id ?? null),
        enabled: isReady && !!answerId,
        staleTime: 2 * 60 * 1000,
        queryFn: async (): Promise<CoFormAnswer> => {
            if (!api || !answerId) throw new Error("Missing answer id");
            return fetchCommunAnswer(api, answerId);
        },
    });

    // Contexte AAC du site : contexte de sélection, étape `choose`, formulaire de référence.
    const directory = useAacDirectoryContext();

    /** Formulaire sur lequel la réponse a été déposée. */
    const originFormId = answerQuery.data?.form;

    /**
     * Formulaire de référence : celui de l'appel courant, sinon celui de la réponse
     * (parité `campDetail.php:2138`). Un commun sélectionné depuis un autre appel est
     * rendu avec les questions d'ici ; `SaveAnswerAction` fusionne clé par clé.
     */
    const formId = directory.formId ?? originFormId;

    // Appel d'origine : son nom (« Déposé sur … ») et le contexte qui détient l'enveloppe.
    const { context: fundingContext, originFormName } = useCommunFundingContext(answerQuery.data);

    const formQuery = useQuery({
        // Idem : `access.restrictedFields` dépend du lecteur ; clé partagée avec le loader.
        queryKey: COMMUN_FORM_QUERY_KEY(formId ?? null, me?.id ?? null),
        enabled: isReady && !!formId,
        staleTime: 5 * 60 * 1000,
        queryFn: async (): Promise<CoFormData> => {
            if (!api || !formId) throw new Error("Missing form id");
            const form = await api.form({ id: formId });
            return form.serverData as unknown as CoFormData;
        },
    });

    // Attendue par la garde de chargement : les gates décident de la mise en page du financement.
    const { config, isLoading: isConfigLoading, error: configError } = useAacConfig(formId ?? null);

    // Droits calculés avec les gates et l'étape de financement du formulaire ;
    // mémoïsé car `useAacPermissions` recalcule sur l'identité de `data`.
    const permData = useMemo<AacPermissionData>(
        () => ({ gates: config?.gates, hasFundingStep: Boolean(config?.roles.financementStepKey) }),
        [config?.gates, config?.roles.financementStepKey]
    );
    const perms = useAacPermissions(entity, permData);

    // L'enveloppe est scopée à l'entité appelante : on la lit sur l'hôte du contexte du commun.
    const { hostEntity: fundingHost, isLoading: isFundingHostLoading } =
        useCommunFundingHost(fundingContext);

    const { targetResource, projectSlug, isLoading: isFundingLoading } = useAacFundingResource(answerId, {
        hostEntity: fundingHost,
        isHostLoading: isFundingHostLoading,
        // Repli : la réponse porte déjà son projet et ses dépenses.
        answer: answerQuery.data,
        step: config?.roles.depenseStepKey ?? undefined,
    });

    // Phase inconnue tant que l'enveloppe ou la config sont en vol.
    const isPhaseUnresolved = isFundingLoading || isConfigLoading;
    const isProjectPhase = canManageObjectiveActions(targetResource?.projectId);

    // Blocs de prose déclarés par `config.aac.detail.sections` ; `sections` est mémoïsé, pas l'objet retourné.
    const { sections: detailSections, isLoading: isDetailSectionsLoading } =
        useAacDetailSections(formId ?? null);
    const gallerySubKey = useAacGallerySubKey();
    const demoBlocks = useAacDemoBlocks();

    // Question qui alimente `links.canEdit` (`addToLinks`), si le formulaire en déclare une.
    // Même entrée de cache que `useAacConfig`.
    const { meta: formMeta } = useAacFormMeta(formId ?? null);
    const formParams = useAacFormParams(formId ?? null);
    const editorsQuestion = useMemo(
        () => resolveEditorsQuestion(formMeta, formParams),
        [formMeta, formParams]
    );

    // Mémoïsé : le sommaire en dérive ses ancres observées.
    const prose = useMemo<CommunProseBlock[]>(
        () =>
            detailSections.map((section) => ({
                id: section.id,
                title: section.title,
                kicker: section.kicker,
                icon: section.icon,
                paragraphs: proseOf(answerQuery.data, section),
            })),
        [detailSections, answerQuery.data]
    );

    // Contrôleur des paliers, unique pour la page : besoins, actions et dialogues partagent son état.
    // Appelé avant les retours anticipés.
    const objectivesCtrl = useCommunObjectivesController({
        answerQuery: answerQuery.data ?? null,
        funding: targetResource,
        depenseStepKey: config?.roles.depenseStepKey ?? null,
    });

    // Financement visible ssi l'appel a une étape de financement (parité `detailProposal.php:100-104`),
    // pas selon `coremu`. Une seule variable pour les blocs et leurs entrées de sommaire.
    const showFunding = perms.canViewFunding;

    useEffect(() => {
        if (configError) {
            console.error("[useCommunDetailController] échec de chargement de la configuration AAC", configError);
        }
    }, [configError]);

    // SEO calculé avant les gardes, donc émis dans tous les états : le SSR rend le squelette
    // (la config de l'appel n'est pas préchargée). Repli : nom de l'appel, puis libellé générique.
    const seoPath = answerId ? communPath(answerId) : "/aac";
    const depenseStepKey = config?.roles.depenseStepKey ?? null;
    const communSeo = useMemo(
        () => resolveCommunSeo(answerQuery.data, { fields: directory.fields, depenseStepKey, baseUrl: getBaseUrl() }),
        [answerQuery.data, directory.fields, depenseStepKey]
    );

    // Lectures de la réponse, mémoïsées avant les gardes : références stables pour les vues.
    const card = useMemo(
        () =>
            answerQuery.data
                ? parseAacAnswer(answerQuery.data, {
                      fields: directory.fields,
                      contextId: directory.contextId,
                      baseUrl: getBaseUrl(),
                  })
                : null,
        [answerQuery.data, directory.fields, directory.contextId]
    );
    const usageLabels = useMemo(() => readUsageLabels(directory.formParams), [directory.formParams]);
    const galleryImages = useMemo(
        () => extractGalleryImages(answerQuery.data?.documents, getBaseUrl(), gallerySubKey),
        [answerQuery.data?.documents, gallerySubKey]
    );

    const seo: AacSeoProps = {
        title: communSeo.title || formQuery.data?.name || String(t("page.communDetail")),
        description: communSeo.description || String(t("page.communDetailDescription")),
        image: communSeo.image,
        path: seoPath,
    };
    const base: CommunDetailBaseVM = { seo, pageVariant: directory.variants.detail };

    if (!answerId) return { status: "missing-answer", ...base };
    if (answerQuery.isLoading || formQuery.isLoading || isConfigLoading) return { status: "loading", ...base };
    // Seulement SANS données : une RELECTURE ratée (retour sur l'onglet, réseau qui flanche) garde
    // la fiche déjà affichée. La remplacer par la carte d'erreur démontait tout ce qu'elle porte —
    // l'espace de discussion ouvert, et le message qu'on y était en train d'écrire.
    if ((answerQuery.error && !answerQuery.data) || (formQuery.error && !formQuery.data)) return { status: "error", kind: "data", ...base };
    // Sans config, ni gates ni blocs déclarés : erreur explicite plutôt qu'une fiche vidée.
    // Seulement SANS config, elle aussi : `useAacConfig` rend `config` ET `error` quand une
    // relecture échoue (revue du 16/10).
    if (configError && !config) return { status: "error", kind: "config", ...base };
    if (!answerQuery.data || !formQuery.data || !card) return { status: "error", kind: "not-found", ...base };

    const answer = answerQuery.data;
    const formData = formQuery.data;

    // Auteur, contributeur à l'édition (`links.canEdit`) ou admin peut modifier ;
    // l'auteur vient de `resolveAnswerAuthorId`, pas de `answer.user`.
    const authorId = resolveAnswerAuthorId(answer);
    const editorIds = editorIdsOf(answer);
    const canEditThisCommun = perms.canEditCommun({ authorId, editorIds });

    const isCommunAuthor = !!authorId && authorId === perms.currentUserId;

    const canManageProject = perms.isAdmin || isCommunAuthor;

    const handleEditSubmit = async () => {
        await answerQuery.refetch();
        toast.success(String(t("detail.edit.successToast")));
    };

    // Publication dans l'annuaire du site, comme `parseAacAnswer` : absence d'entrée = non sélectionné ;
    // `null` sans question `choose` résolue ou sans contexte.
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

    // Étape masquée (et hors schéma) au non-admin : celle de `choose`, sinon l'étape d'évaluation trouvée par scan.
    // Pas de `useMemo` après les retours anticipés ; `SmartCoForm` compare le contenu.
    const evalStepKey = chooseStepKey ?? config?.roles.evalStepKeyFound ?? null;
    const hiddenStepsForEdit = !perms.isAdmin && evalStepKey ? [evalStepKey] : [];

    // Relit la fiche ; les caches de l'annuaire sont invalidés par la mutation elle-même.
    const handleSelectionDone = async () => {
        await answerQuery.refetch();
    };

    // Après un paiement : relit la réponse et les dépenses brutes, que la modale cagnotte n'invalide pas.
    const handleFunded = async () => {
        await Promise.all([
            answerQuery.refetch(),
            queryClient.invalidateQueries({ queryKey: [COMMUN_RAW_DEPENSES_QUERY_KEY, answerId] }),
        ]);
    };

    // Étape résolue de la dépense, où `CommunHero` lit le descriptif long.
    const depositStep = (answer.answers as Record<string, Record<string, unknown>> | undefined)?.[
        depenseStepKey || DEFAULT_AAC_STEP
    ];
    const longDescription = depositStep?.description;

    // Une condition par commande : l'édition est ouverte à l'auteur, la sélection à l'admin seul.
    const canOpenEdit = canEditThisCommun && !!formId;

    return {
        status: "ready",
        ...base,
        hero: {
            formData,
            answerData: answer.answers ?? {},
            aacConfig: config,
            depositedOnName: originFormName,
        },
        summary: {
            card,
            longDescription: typeof longDescription === "string" ? longDescription : "",
            usageLabels,
        },
        funding: showFunding
            ? {
                  card: {
                      formData,
                      answerQuery: answer,
                      aacConfig: config,
                      funding: targetResource,
                      onFunded: handleFunded,
                      postLoginIntent,
                      onPostLoginIntent: setPostLoginIntent,
                  },
                  reactions: {
                      answerQuery: answer,
                      aacConfig: config,
                      postLoginIntent,
                      onPostLoginIntent: setPostLoginIntent,
                  },
                  section: {
                      formData,
                      aacConfig: config,
                      funding: targetResource,
                      ctrl: objectivesCtrl,
                  },
                  cofinancers: {
                      formData,
                      answerQuery: answer,
                      aacConfig: config,
                      funding: targetResource,
                  },
              }
            : null,
        objectives: isPhaseUnresolved
            ? { phase: "unresolved", isProjectPhase }
            : isProjectPhase
              ? {
                    phase: "project",
                    actions: {
                        formData,
                        aacConfig: config,
                        funding: targetResource,
                        ctrl: objectivesCtrl,
                    },
                    contributors: {
                        projectId: targetResource?.projectId,
                        projectSlug,
                        isCommunAuthor,
                        authorId,
                    },
                    news: { projectId: targetResource?.projectId },
                    agenda: { projectId: targetResource?.projectId },
                }
              : { phase: "none" },
        prose,
        isProseLoading: isDetailSectionsLoading,
        gallery: gallerySubKey ? { images: galleryImages } : null,
        demoBlocks,
        actions: {
            api,
            answerId: answerId ?? null,
            answer,
            formId: formId ?? null,
            canEdit: canOpenEdit,
            onEdit: () => setIsEditOpen(true),
            // Gestion de la liste : auteur et admins seulement (parité legacy, doc/34 §3.4).
            canManageEditors: perms.canManageEditors({ authorId }),
            editorsQuestion,
            selection: {
                isAdmin: perms.canSelectCommun,
                isSelected,
                contextId: directory.contextId,
                contextType: directory.context?.type ?? null,
                contextName: directory.context?.name ?? null,
                subFormId: chooseStepKey,
                onDone: handleSelectionDone,
            },
            project: {
                canManage: canManageProject,
                isLoading: isPhaseUnresolved,
                projectId: targetResource?.projectId,
                projectSlug,
                parentId: directory.contextId,
                parentType: directory.context?.type ?? null,
                userId: me?.id ?? null,
                contextEntity: entity,
                onLinked: async () => {
                    await Promise.all([answerQuery.refetch(), refreshMe()]);
                },
            },
            deletion: {
                canDelete: perms.canDeleteCommun({ authorId }),
                communTitle: communSeo.title,
                // L'enveloppe dit s'il y a eu des versements et ce que la cascade emporterait.
                resource: targetResource,
                isResourceLoading: isFundingLoading,
                // Retour à l'annuaire ; le document est déjà retiré du cache.
                onDeleted: () => void navigate("/aac"),
            },
        },
        discussion: {
            answerId,
            communTitle: communSeo.title || null,
            scopeEntity: entity,
        },
        overlays: {
            edit:
                canOpenEdit && formId
                    ? {
                          formId,
                          open: isEditOpen,
                          onOpenChange: (ouvert: boolean) => {
                              setIsEditOpen(ouvert);
                              // Les champs à écriture directe (`choose`…) enregistrent sans soumission : relire à la fermeture.
                              if (!ouvert) void answerQuery.refetch();
                          },
                          title: String(t("detail.edit.title")),
                          answerId,
                          defaultValues: answer.answers,
                          // Date de référence du brouillon local (`useCoFormDraft`) ; `created` si jamais modifié.
                          baseUpdatedAt: answer.updated ?? answer.created ?? null,
                          hiddenStepKeys: hiddenStepsForEdit,
                          onAfterSubmit: handleEditSubmit,
                      }
                    : null,
            // Les dépenses enregistrées sont celles de la réponse lue ; le fil d'une ligne n'existe
            // que sur `answers.aapStep1.depense`, la seule liste que l'espace de discussion connaisse.
            editDiscussions:
                canOpenEdit && formId
                    ? {
                          answerId,
                          savedDepenses: (answer.answers as Record<string, Record<string, unknown>> | undefined)?.[DEFAULT_AAC_STEP]?.depense,
                          enabled: (depenseStepKey ?? DEFAULT_AAC_STEP) === DEFAULT_AAC_STEP,
                      }
                    : null,
            milestones: objectivesCtrl,
        },
    };
}
