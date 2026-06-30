import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CoFormModal } from "@/modules/coform/components/CoFormModal";
import type { AllStepsData } from "@/modules/coform/types";
import { PROFIL_QUERY_KEYS } from "@/modules/profil/constants/queryKeys";
import {
    MapPin,
    Mail,
    Phone,
    Globe,
    Users,
    ArrowUpRight,
    Printer,
    Facebook,
    Instagram,
    Twitter,
    Linkedin,
    Youtube,
    ExternalLink,
    MessageCircle,
    CalendarDays,
    FolderKanban,
    Video,
    Cloud,
    FolderOpen,
    BarChart2,
    Ticket,
    UserCheck,
    type LucideIcon,
    Monitor,
    BedDouble,
    Loader2,
    Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useProfileSetup } from "../../../hooks/useProfileSetup";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import type { ProfileTiersLieuxInfoSection } from "../../../schema";
import z from "zod";
import SectionTitle from "./SectionTitleTL";
import { useGetAnswersByFormsQuery } from "@/modules/profil/hooks/useGetAnwersByFormsQuery";
import { getServerUrl } from "@/lib/constant/common";
import { useCocolight } from "@/hooks/useCocolight";
import { type Answer } from "@communecter/cocolight-api-client";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { useMultiEvalData } from "@/modules/coform/hooks/useMultiEvalData";
import { MultiEvalRadarCarousel } from "@/modules/coform/components/MultiEvalRadarCarousel";

interface ProfileTiersLieuxInfoProps {
    section: ProfileTiersLieuxInfoSection;
}

// ─── Mapping des outils disponibles ────────────────────────────────────────
const TOOLS_MAP: Record<string, { label: string; Icon: LucideIcon }> = {
    site: { label: "Site", Icon: Globe },
    chat: { label: "Chat entre membres", Icon: MessageCircle },
    agenda: { label: "Agenda événementiel", Icon: CalendarDays },
    projectManagement: { label: "Gestion de projet", Icon: FolderKanban },
    videoPlatform: { label: "Plateforme vidéo", Icon: Video },
    cloud: { label: "Cloud", Icon: Cloud },
    annuaire: { label: "Annuaire", Icon: Users },
    fileSharing: { label: "Partage de fichiers et édition", Icon: FolderOpen },
    survey: { label: "Sondage / enquête", Icon: BarChart2 },
    reservation: { label: "Système de réservation", Icon: Ticket },
    membership: { label: "Gestion des adhésions", Icon: UserCheck },
};

export default function ProfileTiersLieuxInfo({ section }: ProfileTiersLieuxInfoProps) {
    const { entity, t } = useProfileSetup();
    const { me } = useCocolight();
    const { canEditProfile } = useProfilPermissions(entity);
    const toolsRaw = useReactiveProperty(entity.serverData, "ourTools");
    const { address, email, mobile, url, tags } = useFormatProfileEntity(entity);

    const { data: _answersByForms } = useGetAnswersByFormsQuery({
        entity,
        forms: section.forms,
        enabled: !!entity && section.forms && Object.keys(section.forms).length > 0,
    });
    // Normalise tools : { [key]: [{name, url}] }
    type ToolItem = { name: string; url?: string };
    type ParsedTools = Array<{ key: string; items: ToolItem[] }>;

    const parsedTools = useMemo((): ParsedTools => {
        if (!toolsRaw || typeof toolsRaw !== "object" || Array.isArray(toolsRaw)) return [];
        return Object.entries(toolsRaw as Record<string, unknown>)
            .filter(([key]) => key in TOOLS_MAP)
            .map(([key, val]) => ({
                key,
                items: Array.isArray(val) ? (val as ToolItem[]) : [],
            }));
    }, [toolsRaw]);

    const getNestedValue = (obj: Record<string, unknown>, path: string): unknown =>
        path.split('.').reduce<unknown>((current, key) => {
            if (current === null || typeof current !== "object") return undefined;
            return (current as Record<string, unknown>)[key];
        }, obj);
    // Champs supplémentaires via serverData
    const fax = useReactiveProperty<string>(entity.serverData, "fax") ?? null;
    const externalLink = z.string().nullable().parse(parsedTools.find(t => t.key === "reservation")?.items[0]?.url ?? null);
    // Réseaux sociaux : deux formes coexistent — FLAT (`serverData.facebook`, orgs « normales »)
    // et IMBRIQUÉE (`serverData.socialNetwork.facebook`, écrite par le form tiers-lieux via le codec
    // `social:write`). On lit la flat en priorité puis on retombe sur la forme imbriquée, pour afficher
    // les liens quelle que soit la voie d'écriture.
    const socialNetwork = useReactiveProperty<Record<string, string>>(entity.serverData, "socialNetwork") ?? {};
    const facebook = (useReactiveProperty<string>(entity.serverData, "facebook") ?? socialNetwork.facebook) ?? null;
    const instagram = (useReactiveProperty<string>(entity.serverData, "instagram") ?? socialNetwork.instagram) ?? null;
    const twitter = (useReactiveProperty<string>(entity.serverData, "twitter") ?? socialNetwork.twitter) ?? null;
    const linkedin = (useReactiveProperty<string>(entity.serverData, "linkedin") ?? socialNetwork.linkedin) ?? null;
    const youtube = (useReactiveProperty<string>(entity.serverData, "youtube") ?? socialNetwork.youtube) ?? null;
    const mastodon = (useReactiveProperty<string>(entity.serverData, "mastodon") ?? socialNetwork.mastodon) ?? null;
    const telegram = (useReactiveProperty<string>(entity.serverData, "telegram") ?? socialNetwork.telegram) ?? null;
    const discord = (useReactiveProperty<string>(entity.serverData, "discord") ?? socialNetwork.discord) ?? null;
    const roomCount = useMemo(() => {
        const roomPath = section.roomPath?.place ?? section.roomPath?.roomPath;
        const type = section.roomPath?.type ?? "single";
        if (!roomPath) return 0;
        const roomId = section.roomPath?.id;
        if (!roomId) return 0;
        const roomData = _answersByForms?.find((item) => item.id === roomId);
        let count = 0;
        if (type === "array") {
            roomData?.answers.forEach((answer) => {
                const value = getNestedValue((answer.serverData as Record<string, unknown>).answers as Record<string, unknown>, roomPath);
                if (Array.isArray(value)) {
                    count += value.length - 1;
                }
            })
        }else if(type === "single"){
            roomData?.answers.forEach((answer) => {
                const value = getNestedValue((answer.serverData as Record<string, unknown>).answers as Record<string, unknown>, roomPath);
                if(value && isNaN(Number(value)) === false){
                    count += Number(value);
                }
            })
        }
        return count;
    }, [section.roomPath, _answersByForms])
    const coworkCount = useMemo(() => {
        const coworkPath = section.coworkingPath?.place ?? section.coworkingPath?.coworkPath;
        const type = section.coworkingPath?.type ?? "single";
        if (!coworkPath) return 0;
        const coworkId = section.coworkingPath?.id;
        if (!coworkId) return 0;
        const coworkData = _answersByForms?.find((item) => item.id === coworkId);
        let count = 0;
        if (type === "array") {
            coworkData?.answers.forEach((answer) => {
                const value = getNestedValue((answer.serverData as Record<string, unknown>).answers as Record<string, unknown>, coworkPath);
                if (Array.isArray(value)) {
                    count += value.length - 1;
                }
            })
        }else if(type === "single"){
            coworkData?.answers.forEach((answer) => {
                const value = getNestedValue((answer.serverData as Record<string, unknown>).answers as Record<string, unknown>, coworkPath);
                if(value && isNaN(Number(value)) === false){
                    count += Number(value);
                }
            })
        }else if(type === "answer"){
            count = (coworkData?.answers as Answer[] | undefined)?.length ?? 0;
        }
        return count;
    }, [section.coworkingPath, _answersByForms])
    const bedCount = useMemo(() => {
        const bedPath = section.bedRoomPath?.place ?? section.bedRoomPath?.bedRoomPath;
        const type = section.bedRoomPath?.type ?? "single";
        if (!bedPath) return 0;
        const bedId = section.bedRoomPath?.id;
        if (!bedId) return 0;
        const bedData = _answersByForms?.find((item) => item.id === bedId);
        let count = 0;
        if (type === "array") {
            bedData?.answers.forEach((answer) => {
                const value = getNestedValue((answer.serverData as Record<string, unknown>).answers as Record<string, unknown>, bedPath);
                if (Array.isArray(value)) {
                    count += value.length - 1;
                }
            })
        }else if(type === "single"){
            bedData?.answers.forEach((answer) => {
                const value = getNestedValue((answer.serverData as Record<string, unknown>).answers as Record<string, unknown>, bedPath);
                if(value && isNaN(Number(value)) === false){
                    count += Number(value);
                }
            })
        }else if(type === "answer"){
            count = (bedData?.answers as Answer[] | undefined)?.length ?? 0;
        }
        return count;
    }, [section.bedRoomPath, _answersByForms])

    // ─── Évaluation du lieu ───────────────────────────────────────────────────
    // On identifie le formulaire d'évaluation via la catégorie `"evaluation"`
    // dans `section.forms`. Sa réponse pour ce lieu est récupérée via
    // `_answersByForms` (déjà chargée). Le radar est ensuite rendu inline via
    // `useMultiEvalData` (lazy, enabled seulement si on a un answerId).
    const evaluationForm = useMemo(() => {
        if (!section.forms) return null;
        const entry = Object.entries(section.forms).find(([, f]) => f.category === "evaluation");
        if (!entry) return null;
        const [id, form] = entry;
        const dataForms = _answersByForms?.find((item) => item.id === id);
        const existingAnswer = dataForms?.answers?.[0];
        return {
            formId: id,
            form,
            answerId: existingAnswer?._serverData?.id ?? existingAnswer?.id ?? null,
        };
    }, [section.forms, _answersByForms]);

    const { data: multiEvalData, isLoading: multiEvalLoading } = useMultiEvalData({
        answerId: evaluationForm?.answerId ?? null,
        enabled: !!evaluationForm?.answerId,
    });
    const evaluationSteps = multiEvalData?.steps ?? [];

    // Liste ordonnée des réseaux présents (flat OU socialNetwork.*), avec leur icône, rendue en map.
    const socials = (
        [
            facebook && { key: "facebook", url: facebook, label: "Facebook", icon: <Facebook className="h-4 w-4" /> },
            instagram && { key: "instagram", url: instagram, label: "Instagram", icon: <Instagram className="h-4 w-4" /> },
            twitter && { key: "twitter", url: twitter, label: "Twitter / X", icon: <Twitter className="h-4 w-4" /> },
            linkedin && { key: "linkedin", url: linkedin, label: "LinkedIn", icon: <Linkedin className="h-4 w-4" /> },
            youtube && { key: "youtube", url: youtube, label: "YouTube", icon: <Youtube className="h-4 w-4" /> },
            mastodon && { key: "mastodon", url: mastodon, label: "Mastodon", icon: <span className="text-xs font-bold">M</span> },
            telegram && { key: "telegram", url: telegram, label: "Telegram", icon: <ExternalLink className="h-4 w-4" /> },
            discord && { key: "discord", url: discord, label: "Discord", icon: <MessageCircle className="h-4 w-4" /> },
        ] as Array<false | { key: string; url: string; label: string; icon: ReactNode }>
    ).filter((s): s is { key: string; url: string; label: string; icon: ReactNode } => Boolean(s));
    const hasSocials = socials.length > 0;


    // ─── CoFormModal state (mode "modal") ─────────────────────────────────────
    const queryClient = useQueryClient();
    const [formModal, setFormModal] = useState<{
        formId: string;
        answerId?: string;
        defaultValues?: AllStepsData;
        title?: string;
        lockedFields?: string[];
        elementId?: string;
        elementType?: "organizations" | "projects" | "events" | "poi" | "citoyens";
    } | null>(null);

    const entityId = entity?.id ?? null;
    const invalidateAnswers = useCallback(() => {
        queryClient.invalidateQueries({
            queryKey: PROFIL_QUERY_KEYS.ANSWERS_BY_FORMS_PREFIX(entityId),
        });
    }, [queryClient, entityId]);

    const cardClasses = section.sticky
        ? "overflow-hidden lg:sticky lg:top-4"
        : "overflow-hidden";

    const handleClickForm = useCallback(async (formId: string, finder?: string, openMode: "modal" | "tab" = "tab", requireOwnerEdit: boolean = true) => {
        if(!entity || !me) return;
        // L'appelant décide s'il exige les droits d'édition de l'entity. La
        // section Formulaires (owner-only) passe le défaut `true` ; le bouton
        // "Évaluer le lieu" passe `false` pour les forms publics dont l'accès
        // est gated server-side via `canAnswer` (publicCanEditSharedAnswer).
        if(requireOwnerEdit && !canEditProfile) return;
        const dataForms = _answersByForms?.find((item) => item.id === formId);
        const accessToken = entity.apiClient.getToken();
        let answer: Answer | undefined = undefined;
        let isNewAnswer = false;
        if (dataForms && dataForms.answers.length > 0) {
            answer = dataForms.answers[0];
        } else {
            isNewAnswer = true;
            // Façade `BaseEntity.generateNewAnswerId(formId)` — peuple l'id côté
            // answer, prêt à recevoir un updateField.
            answer = await entity.generateNewAnswerId(formId);
            if (!answer.id) {
                console.error("No answer ID generated for form:", formId);
                return;
            }
            await answer.updateField(`${finder}.${entity.id}`, {
                id: entity.id,
                type: entity.serverData.collection,
                name: entity.serverData.name,
            });
            await answer.updateField(`links.${entity.serverData.collection}.${entity.id}`, {
                type: entity.serverData.collection,
                name: entity.serverData.name,
            });
        }
        if (!answer) {
            console.error("No answer available to open for form:", formId);
            return;
        }

        if (openMode === "modal") {
            let defaultValues: AllStepsData | undefined;
            if (isNewAnswer) {
                // Nouvelle réponse : pré-remplir le finder
                if (finder) {
                    const entityId = entity.id as string;
                    const entityValue: Record<string, unknown> = {
                        [entityId]: {
                            id: entityId,
                            type: entity.serverData.collection,
                            name: entity.serverData.name,
                        },
                    };
                    const pathWithoutPrefix = finder.startsWith("answers.")
                        ? finder.slice("answers.".length)
                        : finder;
                    defaultValues = pathWithoutPrefix
                        .split(".")
                        .reduceRight<Record<string, unknown>>((acc, part) => ({ [part]: acc }), entityValue) as AllStepsData;
                }
            } else {
                // Réponse existante : utiliser les données sauvegardées
                defaultValues = answer.serverData?.answers as AllStepsData | undefined;
            }
            const finderFieldName = finder ? finder.split(".").pop() : undefined;
            // L'entity du profil EST le lieu lié à la réponse partagée. On
            // pousse son id+type au backend via elementId/elementType pour que
            // `Coform::getFormAccessInfo` entre en mode "par élément" et
            // calcule `access.restrictedFields` (placeAdminOnly /
            // placeMemberOnly). Sans ça, le mode élément n'est pas activé et
            // les restrictions place-level seraient inopérantes.
            const entityCollection = entity.serverData.collection as
                | "organizations" | "projects" | "events" | "poi" | "citoyens";
            setFormModal({
                formId,
                answerId: answer._serverData?.id ?? answer.id,
                defaultValues,
                lockedFields: finderFieldName ? [finderFieldName] : undefined,
                elementId: entity.id as string,
                elementType: entityCollection,
            });
            return;
        }

        // Mode "tab" : ouvrir dans un nouvel onglet (comportement historique)
        const targetUrl = `/costum/co/index/slug/navigatorDesTierslieux/#answer.index_coformv2.id.${answer.serverData.id}.form.${formId}.mode.w.standalone.true.ask.false`;
        const urlToRedirect = `${getServerUrl()}/co2/embed/render?targetUrl=${encodeURIComponent(targetUrl)}&embedToken=${accessToken}`;
        window.open(urlToRedirect, "_blank");

    }, [_answersByForms, entity, me, canEditProfile])

    return (
        <>
        <div className={cardClasses}>

            {/* ── 1. RÉSERVER EN LIGNE ─────────────────────────────── */}
            {(roomCount + coworkCount + bedCount > 0 || externalLink) && (
                <div className={`bg-card rounded-lg border border-border shadow-sm mb-6  border-b px-5 pt-5 pb-5`}>
                    {/* Titre */}
                    <h4 className="font-semibold text-base text-foreground mb-3">
                        {t("ProfileTiersLieuxInfo.reserveOnline")}
                    </h4>

                    {/* Comptages d'espaces */}
                    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden mb-4">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-background">
                            <Users className="w-5 h-5 text-foreground shrink-0" />
                            <span className="text-sm font-semibold text-foreground">
                                {roomCount}{" "}
                                {roomCount > 1
                                    ? t("ProfileTiersLieuxInfo.meetingRoomsPlural")
                                    : t("ProfileTiersLieuxInfo.meetingRooms")}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-background">
                            <Monitor className="w-5 h-5 text-foreground shrink-0" />
                            <span className="text-sm font-semibold text-foreground">
                                {coworkCount}{" "}
                                {coworkCount > 1
                                    ? t("ProfileTiersLieuxInfo.workstationsPlural")
                                    : t("ProfileTiersLieuxInfo.workstations")}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-background">
                            <BedDouble className="w-5 h-5 text-foreground shrink-0" />
                            <span className="text-sm font-semibold text-foreground">
                                {bedCount}{" "}
                                {bedCount > 1
                                    ? t("ProfileTiersLieuxInfo.accommodationPlural")
                                    : t("ProfileTiersLieuxInfo.accommodation")}
                            </span>
                        </div>
                    </div>

                    {/* Bouton CTA */}
                    {externalLink && (
                        <>
                            <Button
                                className="w-full mb-2 btn-primary"
                                onClick={() => window.open(externalLink, "_blank")}
                            >
                                {t("ProfileTiersLieuxInfo.reservationSpace")}
                                <ArrowUpRight className="w-4 h-4 ml-1.5" />
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">
                                {t("ProfileTiersLieuxInfo.reservationNote")}
                            </p>
                        </>
                    )}
                </div>
            )}

            <div className="p-4 space-y-5">

                {/* ── 2. Contact ───────────────────────────────────────── */}
                {(
                    (section.showWebsite !== false && url) ||
                    (section.showEmail !== false && email) ||
                    (section.showPhone !== false && mobile) ||
                    fax
                ) && (
                        <div>
                            <SectionTitle label={t("ProfileTiersLieuxInfo.contact")} />
                            <div className="space-y-1">
                                {section.showWebsite !== false && url && typeof url === "string" && (
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted transition-colors group"
                                    >
                                        <Globe className="w-4 h-4 text-primary shrink-0" />
                                        <span className="text-sm text-primary truncate group-hover:underline">
                                            {url.replace(/^https?:\/\//, "")}
                                        </span>
                                    </a>
                                )}
                                {section.showEmail !== false && email && typeof email === "string" && (
                                    <a
                                        href={`mailto:${email}`}
                                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted transition-colors"
                                    >
                                        <Mail className="w-4 h-4 text-primary shrink-0" />
                                        <span className="text-sm text-foreground break-all">{email}</span>
                                    </a>
                                )}
                                {section.showPhone !== false && mobile && typeof mobile === "string" && (
                                    <a
                                        href={`tel:${mobile}`}
                                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted transition-colors"
                                    >
                                        <Phone className="w-4 h-4 text-primary shrink-0" />
                                        <span className="text-sm text-foreground">{mobile}</span>
                                    </a>
                                )}
                                {fax && (
                                    <div className="flex items-center gap-2 p-1.5">
                                        <Printer className="w-4 h-4 text-primary shrink-0" />
                                        <span className="text-sm text-foreground">{fax}</span>
                                    </div>
                                )}

                                {address && (
                                    <div className="flex items-start gap-2 p-1.5">
                                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                                        <div className="text-sm">
                                            <p className="text-foreground">{[address?.streetAddress ?? null, address?.postalCode ?? null, address?.addressLocality ?? null].filter(Boolean).join(", ")}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                {/* ── 3. Nos outils ───────────────────────────────────── */}
                {parsedTools.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <SectionTitle label={t("ProfileTiersLieuxInfo.tools")} count={parsedTools.length} />
                            <div className="space-y-2">
                                {parsedTools.map(({ key, items }) => {
                                    const tool = TOOLS_MAP[key];
                                    return (
                                        <div key={key} className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
                                            {/* En-tête catégorie */}
                                            <div className="flex items-center gap-2 px-3 py-2">
                                                <tool.Icon className="w-4 h-4 text-primary shrink-0" />
                                                <span className="text-sm font-semibold text-foreground">{tool.label}</span>
                                            </div>
                                            {/* Instances */}
                                            {items.length > 0 && (
                                                <div className="border-t border-primary/10 divide-y divide-primary/10">
                                                    {items.map((item, idx) => (
                                                        item.url ? (
                                                            <a
                                                                key={idx}
                                                                href={item.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-between px-3 py-1.5 hover:bg-primary/10 transition-colors gap-2"
                                                            >
                                                                <span className="text-xs text-foreground truncate">{item.name}</span>
                                                                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                                                            </a>
                                                        ) : (
                                                            <div key={idx} className="px-3 py-1.5">
                                                                <span className="text-xs text-foreground">{item.name}</span>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* ── 4. Réseaux sociaux ───────────────────────────────── */}
                {hasSocials && (
                    <>
                        <Separator />
                        <div>
                            <SectionTitle label={t("ProfileTiersLieuxInfo.socialNetworks")} />
                            <div className="flex flex-wrap gap-2">
                                {socials.map((s) => (
                                    <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                                        <Button variant="outline" size="icon" className="h-8 w-8">
                                            {s.icon}
                                        </Button>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ── 5. Mots clés ─────────────────────────────────────── */}
                {tags.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <SectionTitle label={t("ProfileTiersLieuxInfo.keywords")} />
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ── 6. Évaluation du lieu (radar multi-eval) ─────────── */}
                {evaluationForm && (
                    <>
                        <Separator />
                        <div>
                            <SectionTitle label={t("ProfileTiersLieuxInfo.evaluation")} />

                            {evaluationForm.answerId && multiEvalLoading ? (
                                <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                    {t("ProfileTiersLieuxInfo.evaluateLoading")}
                                </div>
                            ) : evaluationForm.answerId && evaluationSteps.length > 0 ? (
                                <MultiEvalRadarCarousel steps={evaluationSteps} />
                            ) : (
                                <p className="text-xs text-muted-foreground italic">
                                    {t("ProfileTiersLieuxInfo.evaluateNoData")}
                                </p>
                            )}

                            {me && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="w-full mt-3 gap-2"
                                    onClick={() => handleClickForm(evaluationForm.formId, evaluationForm.form.finder, evaluationForm.form.openMode, false)}
                                >
                                    <Activity className="h-4 w-4" />
                                    {t("ProfileTiersLieuxInfo.evaluateButton")}
                                </Button>
                            )}
                        </div>
                    </>
                )}

                {/* ── 7. Formulaires ───────────────────────────────────── */}
                {me && canEditProfile && section.forms && Object.keys(section.forms).length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <SectionTitle label={t("ProfileTiersLieuxInfo.forms")} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(section.forms).map(([id, form], idx) => (
                                    <button
                                        key={idx}
                                        rel="noopener noreferrer"
                                        onClick={() => handleClickForm(id, form.finder, form.openMode)}
                                        className={`flex flex-col items-center justify-center text-center gap-1.5 p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer${form.hide ? " hidden" : ""}`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                        </div>
                                        <span className="text-xs text-foreground leading-tight">
                                            {form.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

            </div>
        </div>

            {/* ── CoFormModal (mode "modal") ─────────────────────────────── */}
            {formModal && (
                <CoFormModal
                    formId={formModal.formId}
                    open={!!formModal}
                    onOpenChange={(open) => { if (!open) setFormModal(null); }}
                    title={formModal.title}
                    answerId={formModal.answerId}
                    defaultValues={formModal.defaultValues}
                    lockedFields={formModal.lockedFields}
                    elementId={formModal.elementId}
                    elementType={formModal.elementType}
                    onAfterSubmit={invalidateAnswers}
                />
            )}
        </>
    );
}
