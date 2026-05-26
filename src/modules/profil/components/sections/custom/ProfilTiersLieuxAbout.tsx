import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BarChart2, CalendarDays, ChevronDown, ChevronUp, Cloud, FolderKanban, FolderOpen, Globe, LucideIcon, MessageCircle, Newspaper, Pencil, PlusCircle, Ticket, Trash2, UserCheck, Users, Video } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { useProfileSetup } from "../../../hooks/useProfileSetup";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { useNewsQuery } from "@/modules/news/hooks/useNewsQuery";
import { formatDate } from "@/helpers/formatDate";
import type { ProfileTiersLieuxAboutSection } from "../../../schema";
import SectionTitle from "./SectionTitleTL";
import { useGetAnswersByFormsQuery } from "@/modules/profil/hooks/useGetAnwersByFormsQuery";
import z from "zod";
import { getServerUrl } from "@/lib/constant/common";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { type Answer, type UpdatePathValueData } from "@communecter/cocolight-api-client";
import { CoFormModal } from "@/modules/coform/components/CoFormModal";
import type { AllStepsData } from "@/modules/coform/types";
import { PROFIL_QUERY_KEYS } from "@/modules/profil/constants/queryKeys";

/** A form answer array entry with dynamic indexed fields */
type FormAnswerRow = Record<string | number, unknown>;

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
// Mapping mot-clé → icône Lucide pour les équipements
const EQUIPMENT_ICON_MAP: Array<{ keywords: string[]; icon: IconName }> = [
  { keywords: ["wifi", "internet", "fibre", "réseau"], icon: "wifi" },
  { keywords: ["écran", "screen", "projection", "projecteur", "vidéo-projecteur"], icon: "monitor" },
  { keywords: ["imprimante", "printer", "impression"], icon: "printer" },
  { keywords: ["photocopieur", "copie", "scanner"], icon: "copy" },
  { keywords: ["réunion", "meeting", "salle", "conférence"], icon: "users" },
  { keywords: ["coworking", "bureau", "poste de travail"], icon: "laptop" },
  { keywords: ["fablab", "makerspace", "hackerspace", "impression 3d", "3d"], icon: "factory" },
  { keywords: ["cuisine", "café", "coffee", "bar", "cafeteria", "restauration"], icon: "coffee" },
  { keywords: ["restaurant", "repas", "déjeuner"], icon: "utensils-crossed" },
  { keywords: ["atelier", "workshop", "établi"], icon: "hammer" },
  { keywords: ["chambre", "hébergement", "dortoir", "lit", "logement"], icon: "bed" },
  { keywords: ["douche", "vestiaire", "sanitaire"], icon: "droplets" },
  { keywords: ["parking", "vélo", "garage"], icon: "car" },
  { keywords: ["extérieur", "jardin", "terrasse", "outdoor"], icon: "trees" },
  { keywords: ["compost", "compostage", "recyclage"], icon: "leaf" },
  { keywords: ["musique", "concert", "scène"], icon: "music" },
  { keywords: ["sport", "fitness", "gym"], icon: "dumbbell" },
  { keywords: ["jeu", "baby-foot", "ping-pong", "billard"], icon: "gamepad-2" },
];

function getEquipmentIcon(name: string): IconName {
  const lowerName = name.toLowerCase();
  for (const { keywords, icon } of EQUIPMENT_ICON_MAP) {
    if (keywords.some((kw) => lowerName.includes(kw))) {
      return icon;
    }
  }
  return "package";
}

const MAX_DESC_LENGTH = 400;
const EQUIP_INITIAL_COUNT = 6;

interface ModalItem {
  name: string;
  images: string[];
  minPers?: number;
  maxPers?: number;
  capacity?: number;
  hourly?: number;
  halfday?: number;
  fullday?: number;
  bed?: number;
  room?: number;
  reserveUrl?: string | null;
}


interface DocumentItem {
  moduleId?: string;
  folder: string;
  name: string;
  [key: string]: unknown;
}

interface ProfileAboutProps {
  section: ProfileTiersLieuxAboutSection;
}

export default function ProfileTiersLieuxAbout({ section }: ProfileAboutProps) {
  const { entity, t, entityType } = useProfileSetup();
  const { shortDescription, description } = useFormatProfileEntity(entity);
  const { canEditProfile } = useProfilPermissions(entity);
  const navigate = useNavigate();
  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown =>
    path.split('.').reduce<unknown>((current, key) => {
      if (current === null || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[key];
    }, obj);

  const { data: _answersByForms, isLoading: _isAnswersByFormsLoading, error: _answersError } = useGetAnswersByFormsQuery({
    entity,
    forms: section.forms,
    enabled: !!entity && !!section.forms && Object.keys(section.forms).length > 0,
  });

  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showAllEquip, setShowAllEquip] = useState(false);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);

  // ─── CoFormModal state ────────────────────────────────────────
  const queryClient = useQueryClient();
  const [formModal, setFormModal] = useState<{
    formId: string;
    answerId?: string;
    defaultValues?: AllStepsData;
    title?: string;
    stepKey?: string;
    inputKey?: string;
    lockedFields?: string[];
  } | null>(null);

  /** Invalidate the answers cache after a form modal submit */
  const entityId = entity?.id ?? null;
  const invalidateAnswers = () => {
    queryClient.invalidateQueries({
      queryKey: PROFIL_QUERY_KEYS.ANSWERS_BY_FORMS_PREFIX(entityId),
    });
  };

  /**
   * Ouvre le CoFormModal pour éditer une réponse existante.
   */
  const openEditFormModal = ({ formId, answerId, title, stepKey, inputKey, lockedFields }: {
    formId: string;
    answerId: string;
    title?: string;
    stepKey?: string;
    inputKey?: string;
    lockedFields?: string[];
  }) => {
    const answerData = _answersByForms
      ?.find((f) => f.id === formId)
      ?.answers.find((a: Answer) => a._serverData?.id === answerId || a.id === answerId);
    setFormModal({
      formId,
      answerId: answerData?._serverData?.id ?? answerId,
      defaultValues: answerData?.serverData?.answers as AllStepsData | undefined,
      title,
      stepKey,
      inputKey,
      lockedFields,
    });
  };

  /**
   * Crée une nouvelle réponse (avec finder pre-pop) puis ouvre le CoFormModal.
   */
  const openNewFormModal = async ({ formId, title, finder, stepKey, inputKey, lockedFields }: {
    formId: string;
    title?: string;
    finder?: string;
    stepKey?: string;
    inputKey?: string;
    lockedFields?: string[];
  }) => {
    // Façade `BaseEntity.generateNewAnswerId(formId)` — retourne `Promise<any>` côté lib.
    // On narrow vers les champs effectivement utilisés (`id` direct + `_serverData.id` du Mongo).
    const answer = (await entity.generateNewAnswerId(formId)) as
      | (Pick<Answer, "id"> & { _serverData?: { id?: string } })
      | undefined;
    if (!answer?.id) {
      console.error("Failed to generate new answer ID for form:", formId);
      return;
    }
    const finderPath = finder ?? section.forms?.[formId]?.finder;
    if (finderPath) {
      const params: UpdatePathValueData = {
        id: answer.id,
        collection: "answers",
        path: `${finderPath}.${entity.id}`,
        value: {
          id: entity.id,
          type: entity.serverData.collection,
          name: entity.serverData.name,
        },
      };
      const paramsLinks: UpdatePathValueData = {
        id: answer.id,
        collection: "answers",
        path: `links.${entity.serverData.collection}.${entity.id}`,
        value: {
          type: entity.serverData.collection,
          name: entity.serverData.name,
        },
      };
      await entity.endpointApi.updatePathValue(params);
      await entity.endpointApi.updatePathValue(paramsLinks);
    }
    // Build defaultValues from finderPath so the finder field is pre-populated in the modal
    let defaultValues: AllStepsData | undefined;
    if (finderPath) {
      const entityId = entity.id as string;
      const entityValue: Record<string, unknown> = {
        [entityId]: {
          id: entityId,
          type: entity.serverData.collection,
          name: entity.serverData.name,
        },
      };
      const pathWithoutPrefix = finderPath.startsWith("answers.")
        ? finderPath.slice("answers.".length)
        : finderPath;
      defaultValues = pathWithoutPrefix
        .split(".")
        .reduceRight<Record<string, unknown>>((acc, part) => ({ [part]: acc }), entityValue) as AllStepsData;
    }
    setFormModal({
      formId,
      answerId: answer._serverData?.id ?? answer.id,
      defaultValues,
      title,
      stepKey,
      inputKey,
      lockedFields: finderPath
        ? [...(lockedFields ?? []), finderPath.split(".").pop()!]
        : lockedFields,
    });
  };

  /** Derives the finder locked field name from the forms config */
  const getFinderLockedField = (formId: string): string[] | undefined => {
    const finderPath = section.forms?.[formId]?.finder;
    if (!finderPath) return undefined;
    const fieldName = finderPath.split('.').pop();
    return fieldName ? [fieldName] : undefined;
  };

  const rooms: Answer[] = useMemo(() => {
    if (!_answersByForms || !section.roomPath) {
      return [];
    }
    if (_isAnswersByFormsLoading) {
      return [];
    }
    if (_answersError) {
      console.error("Error loading answers by forms for rooms:", _answersError);
      return [];
    }
    const roomId = section.roomPath?.id;
    if (!roomId) return [];

    const roomData = _answersByForms?.find((f) => f.id === roomId);

    return roomData && roomData.answers ? roomData.answers : [];
  }, [_answersByForms, section.roomPath, _answersError, _isAnswersByFormsLoading]);
  /* List of coworking answers */
  const coworkData: Answer[] = useMemo(() => {
    if (!_answersByForms || !section.coworkingPath) {
      return [];
    }
    if (_isAnswersByFormsLoading) {
      return [];
    }
    if (_answersError) {
      console.error("Error loading answers by forms for coworking:", _answersError);
      return [];
    }
    const coworkId = section.coworkingPath?.id;
    if (!coworkId) return [];

    const coworkDataItem = _answersByForms?.find((f) => f.id === coworkId);
    return coworkDataItem && coworkDataItem.answers ? coworkDataItem.answers : [];
  }, [_answersByForms, section.coworkingPath, _answersError, _isAnswersByFormsLoading]);
  /* List of accommodation answers */
  const accommodationData: Answer[] = useMemo(() => {
    if (!_answersByForms || !section.bedRoomPath) {
      return [];
    }
    if (_isAnswersByFormsLoading) {
      return [];
    }
    if (_answersError) {
      console.error("Error loading answers by forms for accommodation:", _answersError);
      return [];
    }
    const accommodationId = section.bedRoomPath?.id;
    if (!accommodationId) return [];
    const accommodationDataItem = _answersByForms?.find((f) => f.id === accommodationId);
    return accommodationDataItem && accommodationDataItem.answers ? accommodationDataItem.answers : [];
  }, [_answersByForms, section.bedRoomPath, _answersError, _isAnswersByFormsLoading]);
  // Équipements depuis serverData
  const equipements: string[] = useMemo(() => {
    if (!section.equipement || !_answersByForms) return [];
    if (_isAnswersByFormsLoading) {
      return [];
    }
    const surveyData = _answersByForms.find((f) => f.id === section.equipement?.id);
    if (!surveyData || !surveyData.answers) return [];
    const equipList: Set<string> = new Set();
    surveyData.answers.forEach((answer) => {
      const value = getNestedValue(answer.serverData.answers as Record<string, unknown>, section.equipement?.answerPath ?? "");
      if (typeof value === "string") {
        equipList.add(value);
      } else if (Array.isArray(value)) {
        value.forEach(v => {
          if (typeof v === "string") {
            equipList.add(v);
          } else if (typeof v === "object" && v !== null) {
            for (const val of Object.values(v)) {
              if (typeof val === "string") {
                equipList.add(val);
              } else {
                const newValue = (val as Record<string, unknown>).value;
                if (typeof newValue === "string") {
                  equipList.add(newValue);
                }
              }
            }
          }
        });
      }
    });
    // console.log("Extracted equipements:", Array.from(equipList));
    return Array.from(equipList);
  }, [section.equipement, _answersByForms, _isAnswersByFormsLoading]);

  const activities: string[] = useMemo(() => {
    if (!section.activity || !_answersByForms) return [];
    if (_isAnswersByFormsLoading) {
      return [];
    }
    const surveyData = _answersByForms.find((f) => f.id === section.activity?.id);
    if (!surveyData || !surveyData.answers) return [];
    const equipList: Set<string> = new Set();
    surveyData.answers.forEach((answer) => {
      const value = getNestedValue(answer.serverData.answers as Record<string, unknown>, section.activity?.answerPath ?? "");
      if (typeof value === "string") {
        equipList.add(value);
      } else if (Array.isArray(value)) {
        value.forEach(v => {
          if (typeof v === "string") {
            equipList.add(v);
          } else if (typeof v === "object" && v !== null) {
            for (const val of Object.values(v)) {
              if (typeof val === "string") {
                equipList.add(val);
              } else {
                const newValue = (val as Record<string, unknown>).value;
                if (typeof newValue === "string") {
                  equipList.add(newValue);
                }
              }
            }
          }
        });
      }
    });
    // console.log("Extracted activitys:", Array.from(equipList));
    return Array.from(equipList);
  }, [section.activity, _answersByForms, _isAnswersByFormsLoading]);

  type ToolItem = { name: string; url?: string };
  type ParsedTools = Array<{ key: string; items: ToolItem[] }>;
  const toolsRaw = useReactiveProperty(entity.serverData, "ourTools");
  const parsedTools = useMemo((): ParsedTools => {
    if (!toolsRaw || typeof toolsRaw !== "object" || Array.isArray(toolsRaw)) return [];
    return Object.entries(toolsRaw as Record<string, unknown>)
      .filter(([key]) => key in TOOLS_MAP)
      .map(([key, val]) => ({
        key,
        items: Array.isArray(val) ? (val as ToolItem[]) : [],
      }));
  }, [toolsRaw]);
  const externalLink = z.string().nullable().parse(parsedTools.find(t => t.key === "reservation")?.items[0]?.url ?? null);

  const handleDeleteAnswer = async (answerId: string) => {
    if (!window.confirm(t("ProfilTiersLieuxAbout.confirmDelete"))) return;
    try {
      await entity.endpointApi.deleteElement({
        reason: "delete answer from profile",
        pathParams: { type: "answers", id: answerId },
      });
      window.location.reload();
    } catch (e) {
      console.error("Error deleting answer:", e);
    }
  };

  // Actualités (4 max pour la preview)
  const { news, isLoading: isLoadingNews } = useNewsQuery({
    entity,
    entityType,
    enabled: true,
    indexStep: 4,
  });
  const previewNews = news.slice(0, 4);


  // Navigation vers les onglets
  const slug = entity.serverData?.slug as string | undefined;
  const goToNewsTab = () => slug && navigate(`/profil/${slug}/news`);
  const goToRoomsTab = () => slug && navigate(`/profil/${slug}/coworking`);

  // Description repliable
  const descText = description ?? "";
  const isLongDesc = descText.length > MAX_DESC_LENGTH;
  const renderedDescription = renderMarkdown(descText, section);
  const renderedShort = renderMarkdown(descText.slice(0, MAX_DESC_LENGTH) + "…", section);

  return (
    <div className="space-y-6">
      {/* ── 1. À propos ─────────────────────────────────────── */}
      <div className="border-b-2 pb-5">
        <CardHeader>
          <SectionTitle label={t("ProfilTiersLieuxAbout.title")} />
        </CardHeader>
        <CardContent className="space-y-4">
          {section.showShortDescription !== false && shortDescription && (
            <p className="text-base font-medium text-primary leading-relaxed">
              {shortDescription}
            </p>
          )}
          {section.showDescription !== false && descText && (
            <>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: showFullDesc || !isLongDesc ? renderedDescription : renderedShort,
                }}
              />
              {isLongDesc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullDesc((v) => !v)}
                  className="p-0 h-auto font-medium text-primary hover:text-secondary/75 hover:bg-transparent!"
                >
                  {showFullDesc ? (
                    <>
                      {t("ProfilTiersLieuxAbout.readLess")}
                      <ChevronUp className="ml-1 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      {t("ProfilTiersLieuxAbout.readMore")}
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </div>

      {/* ── 2. Équipements ──────────────────────────────────── */}
      {section.showEquipements !== false && equipements.length > 0 && (
        <div className="border-b-2 pb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle label={t("ProfilTiersLieuxAbout.equipements")} />
              {canEditProfile && section.equipement?.id && (
                <Button
                  variant="default"
                  size="sm"
                  className="p-2"
                  onClick={() => {
                    const equipFormData = _answersByForms?.find((f) => f.id === section.equipement!.id);
                    const existingAnswer = equipFormData?.answers?.[0];
                    if (existingAnswer) {
                      openEditFormModal({ formId: section.equipement!.id, answerId: existingAnswer._serverData.id, title: t("ProfilTiersLieuxAbout.equipements") as string, stepKey: section.equipement!.step, inputKey: section.equipement!.input });
                    } else {
                      openNewFormModal({ formId: section.equipement!.id, title: t("ProfilTiersLieuxAbout.equipements") as string, finder: section.equipement!.finder, stepKey: section.equipement!.step, inputKey: section.equipement!.input });
                    }
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(showAllEquip ? equipements : equipements.slice(0, EQUIP_INITIAL_COUNT)).map((equip: string) => (
                <div key={equip} className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <DynamicIcon name={getEquipmentIcon(equip)} className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-foreground leading-tight">{equip}</span>
                </div>
              ))}
            </div>
            {equipements.length > EQUIP_INITIAL_COUNT && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowAllEquip((v) => !v)}
              >
                {showAllEquip
                  ? t("ProfilTiersLieuxAbout.readLess")
                  : t("ProfilTiersLieuxAbout.seeAllEquipements")}
              </Button>
            )}
          </CardContent>
        </div>
      )}

      {/* ── 3. Activités proposées ──────────────────────────── */}
      {section.showActivities !== false && activities && activities.length > 0 && (
        <div className="border-b-2 pb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle label={t("ProfilTiersLieuxAbout.activities")} />
              {canEditProfile && section.activity?.id && (
                <Button
                  variant="default"
                  size="sm"
                  className="p-2"
                  onClick={() => {
                    const activityFormData = _answersByForms?.find((f) => f.id === section.activity!.id);
                    const existingAnswer = activityFormData?.answers?.[0];
                    if (existingAnswer) {
                      openEditFormModal({ formId: section.activity!.id, answerId: existingAnswer._serverData.id, title: t("ProfilTiersLieuxAbout.activities") as string, stepKey: section.activity!.step, inputKey: section.activity!.input });
                    } else {
                      openNewFormModal({ formId: section.activity!.id, title: t("ProfilTiersLieuxAbout.activities") as string, finder: section.activity!.finder, stepKey: section.activity!.step, inputKey: section.activity!.input });
                    }
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activities.map((activity) => (
                <Badge
                  key={activity}
                  variant="outline"
                  className="bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                >
                  {activity}
                </Badge>
              ))}
            </div>
          </CardContent>
        </div>
      )}

      {/* ── 4. Dernières actualités ─────────────────────────── */}
      {section.showNews !== false && !isLoadingNews && (
        <div className="border-b-2 pb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle label={t("ProfilTiersLieuxAbout.latestNews")} />
              {news.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary/80 p-0 h-auto text-sm font-medium"
                  onClick={goToNewsTab}
                >
                  {t("ProfilTiersLieuxAbout.allNews")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {previewNews.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("ProfilTiersLieuxAbout.noNews")}</p>
            ) : (
              <Carousel opts={{ align: "start", loop: false }} className="w-full">
                <CarouselContent className="-ml-3">
                  {previewNews.map((newsItem) => {
                    const images = newsItem.serverData?.mediaImg?.images ?? [];
                    const firstImage = (images as unknown[])[0];
                    const imageUrl =
                      firstImage && typeof firstImage === "object" && firstImage !== null
                        ? (firstImage as Record<string, string>).imagePath ||
                        (firstImage as Record<string, string>).imageThumbPath
                        : null;
                    const dateVal = newsItem.serverData?.date instanceof Date
                      ? newsItem.serverData.date
                      : newsItem.serverData?.created instanceof Date
                        ? newsItem.serverData.created
                        : null;
                    const dateStr = dateVal ? formatDate(dateVal) : null;
                    const text =
                      typeof newsItem.serverData?.text === "string" ? newsItem.serverData.text : "";
                    const preview = text.slice(0, 100) + (text.length > 100 ? "…" : "");

                    return (
                      <CarouselItem key={newsItem.id} className="pl-3 basis-4/5 sm:basis-1/2">
                        <div
                          className="overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow h-full"
                          onClick={goToNewsTab}
                        >
                          {imageUrl ? (
                            <div className="relative h-36 bg-muted">
                              <img
                                src={imageUrl}
                                alt={preview}
                                className="w-full h-full object-cover"
                              />
                              {dateStr && (
                                <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                                  {dateStr}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="h-24 bg-muted flex items-center justify-center">
                              <Newspaper className="w-8 h-8 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="p-3">
                            {dateStr && !imageUrl && (
                              <p className="text-xs text-muted-foreground mb-1">{dateStr}</p>
                            )}
                            <p className="text-sm text-foreground line-clamp-3">{preview}</p>
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <div className="flex items-center gap-2 mt-3 justify-end">
                  <CarouselPrevious className="static translate-y-0" />
                  <CarouselNext className="static translate-y-0" />
                </div>
              </Carousel>
            )}
          </CardContent>
        </div>
      )}

      {/* ── 5. Salles de réunion ────────────────────────────── */}
      {section.showRooms !== false && (
        <div className="border-b-2 pb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle label={t("ProfilTiersLieuxAbout.rooms") as string} />
              {canEditProfile && section.roomPath?.id && (
                <Button
                  variant="default"
                  size="sm"
                  className="p-2"
                  onClick={() => rooms.length > 0
                    ? openEditFormModal({ formId: section.roomPath!.id, answerId: rooms[0]._serverData.id, title: t("ProfilTiersLieuxAbout.rooms") as string, stepKey: section.roomPath!.step, inputKey: section.roomPath!.input })
                    : openNewFormModal({ formId: section.roomPath!.id, title: t("ProfilTiersLieuxAbout.rooms") as string, stepKey: section.roomPath!.step, inputKey: section.roomPath!.input })
                  }
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {rooms.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("ProfilTiersLieuxAbout.noRooms")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rooms.map((room) => {
                  const sd = room.serverData as Record<string, unknown>;
                  const type = section.roomPath?.type;
                  const linkPath = section.roomPath?.linkPath;
                  const linkValue = linkPath ? getNestedValue(sd.answers as Record<string, unknown>, linkPath) as string | null : null;
                  const roomPath = section.roomPath?.place ?? section.roomPath?.roomPath;
                  if (type === "array") {
                    if (!roomPath) {
                      return null;
                    }
                    const value = getNestedValue(sd.answers as Record<string, unknown>, roomPath);
                    if (!value || !Array.isArray(value)) {
                      return null;
                    }
                    return value.map((v: unknown, idx: number) => {
                      if (idx === 0) return null;
                      const row = v as FormAnswerRow;
                      const name: string = row[section.roomPath?.name ?? 0] as string || t("ProfilTiersLieuxAbout.room");
                      const minPers: number = section.roomPath?.minPers ? row[section.roomPath.minPers] as number : 0;
                      const maxPers: number  = section.roomPath?.maxPers ? row[section.roomPath.maxPers] as number : 0;
                      const hourly: number = section.roomPath?.hourly ? row[section.roomPath.hourly] as number : 0;
                      const halfday: number = section.roomPath?.halfday ? row[section.roomPath.halfday] as number : 0;
                      const fullday: number = section.roomPath?.fullday ? row[section.roomPath.fullday] as number : 0;
                      const images: string[] = section.roomPath?.images ? row[section.roomPath.images] as Array<string> : [];
                      return (
                        <div
                          key={`${room.id}-${idx}`}
                          className="overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                          onClick={goToRoomsTab}
                        >
                          <div className="relative h-36 bg-muted overflow-hidden">
                            {images && images.length > 0 ? (
                              <Carousel
                                opts={{ align: "start", loop: images.length > 1 }}
                                className="w-full h-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <CarouselContent className="h-36 ml-0">
                                  {(images as string[]).map((src, idx) => (
                                    <CarouselItem key={idx} className="pl-0 h-36">
                                      <img
                                        src={`${getServerUrl()}${src}`}
                                        alt={`${name} – ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </CarouselItem>
                                  ))}
                                </CarouselContent>
                                {images.length > 1 && (
                                  <>
                                    <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                    <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                  </>
                                )}
                              </Carousel>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Users className="w-10 h-10 text-muted-foreground/40" />
                              </div>
                            )}
                            {(minPers > 0 || maxPers > 0) && (
                              <span className="absolute top-2 right-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded shadow z-10">
                                {minPers > 0 && maxPers > 0 ? `${minPers} - ${maxPers}` : minPers > 0 ? `${minPers}` : `${maxPers}`} {t("ProfilTiersLieuxAbout.capacity")}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="font-medium text-sm text-foreground truncate">{name}</p>
                            {(hourly > 0 || halfday > 0 || fullday > 0) && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {hourly > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                    {hourly}€ <span className="font-normal text-muted-foreground">/h</span>
                                  </span>
                                )}
                                {halfday > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                    {halfday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.halfDay")}</span>
                                  </span>
                                )}
                                {fullday > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                    {fullday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.fullDay")}</span>
                                  </span>
                                )}
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 w-full text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalItem({
                                  name: String(name ?? ""),
                                  minPers: Number(minPers) || 0,
                                  maxPers: Number(maxPers) || 0,
                                  hourly: Number(hourly) || 0,
                                  halfday: Number(halfday) || 0,
                                  fullday: Number(fullday) || 0,
                                  images: (images as string[]).map(src => `${getServerUrl()}${src}`),
                                  reserveUrl: linkValue ?? externalLink ?? null,
                                });
                              }}
                            >
                              {t("ProfilTiersLieuxAbout.learnMore")}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  } else if (type === "single" || type === "answer") {
                    // No rendering for single/answer type in rooms section
                  }
                  return null;
                })}
              </div>
            )}
          </CardContent>
        </div>
      )}

      {/* ── 6. Coworking ────────────────────────────── */}
      {section.showCoworking !== false && (
        <div className="border-b-2 pb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle label={t("ProfilTiersLieuxAbout.coworking") as string} />
              {canEditProfile && section.coworkingPath?.id && (
                <Button
                  variant="default"
                  size="sm"
                  className="p-2"
                  onClick={() => openNewFormModal({ formId: section.coworkingPath!.id, title: t("ProfilTiersLieuxAbout.coworking") as string })}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {coworkData.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("ProfilTiersLieuxAbout.noCoworking")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {coworkData.map((coworking) => {
                  const sd = coworking.serverData as Record<string, unknown>;
                  const type = section.coworkingPath?.type ?? "single";
                  const linkPath = section.coworkingPath?.linkPath;
                  const linkValue = linkPath ? getNestedValue(sd.answers as Record<string, unknown>, linkPath) as string | null : null;
                  const coworkingPath = section.coworkingPath?.place ?? section.coworkingPath?.coworkingPath;
                  if (type === "array") {
                    if (!coworkingPath) {
                      return null;
                    }
                    const value = getNestedValue(sd.answers as Record<string, unknown>, coworkingPath);
                    if (!value || !Array.isArray(value)) {
                      return null;
                    }
                    return value.map((v: unknown, idx: number) => {
                      if (idx === 0) return null;
                      const row = v as FormAnswerRow;
                      const name: string = row[section.coworkingPath?.name ?? 0] as string || t("ProfilTiersLieuxAbout.coworking");
                      const minPers: number = section.coworkingPath?.minPers ? row[section.coworkingPath.minPers] as number : 0;
                      const maxPers: number = section.coworkingPath?.maxPers ? row[section.coworkingPath.maxPers] as number : 0;
                      const hourly: number = section.coworkingPath?.hourly ? row[section.coworkingPath.hourly] as number : 0;
                      const halfday: number = section.coworkingPath?.halfday ? row[section.coworkingPath.halfday] as number : 0;
                      const fullday: number = section.coworkingPath?.fullday ? row[section.coworkingPath.fullday] as number : 0;
                      const images: string[] = section.coworkingPath?.images ? row[section.coworkingPath.images] as Array<string> : [];
                      return (
                        <div
                          key={`${coworking.id}-${idx}`}
                          className="group relative overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                        // onClick={goToCoworkingTab}
                        >
                          {canEditProfile && (
                            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <Button size="icon" variant="secondary" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); openEditFormModal({ formId: section.coworkingPath!.id, answerId: coworking._serverData.id, title: t("ProfilTiersLieuxAbout.coworking") as string, lockedFields: getFinderLockedField(section.coworkingPath!.id) }); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="destructive" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleDeleteAnswer(coworking.id!); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                          <div className="relative h-36 bg-muted overflow-hidden">
                            {images && images.length > 0 ? (
                              <Carousel
                                opts={{ align: "start", loop: images.length > 1 }}
                                className="w-full h-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <CarouselContent className="h-36 ml-0">
                                  {(images as string[]).map((src, idx) => (
                                    <CarouselItem key={idx} className="pl-0 h-36">
                                      <img
                                        src={`${getServerUrl()}${src}`}
                                        alt={`${name} – ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </CarouselItem>
                                  ))}
                                </CarouselContent>
                                {images.length > 1 && (
                                  <>
                                    <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                    <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                  </>
                                )}
                              </Carousel>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Users className="w-10 h-10 text-muted-foreground/40" />
                              </div>
                            )}
                            {(minPers > 0 || maxPers > 0) && (
                              <span className="absolute top-2 right-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded shadow z-10">
                                {minPers > 0 && maxPers > 0 ? `${minPers} - ${maxPers}` : minPers > 0 ? `${minPers}` : `${maxPers}`} {t("ProfilTiersLieuxAbout.capacity")}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="font-medium text-sm text-foreground truncate">{name}</p>
                            {(hourly > 0 || halfday > 0 || fullday > 0) && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {hourly > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                    {hourly}€ <span className="font-normal text-muted-foreground">/h</span>
                                  </span>
                                )}
                                {halfday > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                    {halfday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.halfDay")}</span>
                                  </span>
                                )}
                                {fullday > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                    {fullday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.fullDay")}</span>
                                  </span>
                                )}
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 w-full text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalItem({
                                  name: String(name ?? ""),
                                  minPers: Number(minPers) || 0,
                                  maxPers: Number(maxPers) || 0,
                                  hourly: Number(hourly) || 0,
                                  halfday: Number(halfday) || 0,
                                  fullday: Number(fullday) || 0,
                                  images: (images as string[]).map(src => `${getServerUrl()}${src}`),
                                  reserveUrl: linkValue ?? externalLink ?? null,
                                });
                              }}
                            >
                              {t("ProfilTiersLieuxAbout.learnMore")}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  } else if (type === "single" || type === "answer") {
                    const allImages = _answersByForms?.find((f) => f.id === section.coworkingPath?.id)?.documents ?? [];
                    const images = Object.values(allImages).filter((doc: unknown) => {
                      return (doc as DocumentItem).folder.includes(sd.id as string);
                    }) as DocumentItem[];
                    const name = (getNestedValue(sd.answers as Record<string, unknown>, section.coworkingPath?.name ?? "") || t("ProfilTiersLieuxAbout.coworkingSpace")) as string;
                    const capacity = (section.coworkingPath?.place && getNestedValue(sd.answers as Record<string, unknown>, section.coworkingPath.place)) as number | undefined;
                    const hourly = (section.coworkingPath?.hourly ? getNestedValue(sd.answers as Record<string, unknown>, section.coworkingPath.hourly) : 0) as number;
                    const halfday = (section.coworkingPath?.halfday ? getNestedValue(sd.answers as Record<string, unknown>, section.coworkingPath.halfday) : 0) as number;
                    const fullday = (section.coworkingPath?.fullday ? getNestedValue(sd.answers as Record<string, unknown>, section.coworkingPath.fullday) : 0) as number;
                    return (
                      <div
                        key={`${sd.id}`}
                        className="group relative overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                      // onClick={goToCoworkingTab}
                      >
                        {canEditProfile && (
                          <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <Button size="icon" variant="secondary" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); openEditFormModal({ formId: section.coworkingPath!.id, answerId: coworking._serverData.id, title: t("ProfilTiersLieuxAbout.coworking") as string, lockedFields: getFinderLockedField(section.coworkingPath!.id) }); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="destructive" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleDeleteAnswer(coworking.id!); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        <div className="relative h-36 bg-muted overflow-hidden">
                          {images && images.length > 0 ? (
                            <Carousel
                              opts={{ align: "start", loop: images.length > 1 }}
                              className="w-full h-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <CarouselContent className="h-36 ml-0">
                                {(images as DocumentItem[]).map((src, idx) => {
                                  const url = typeof src === "object" && src !== null ? `/upload/${src.moduleId}/${src.folder}/${src.name}` : src;
                                  return (
                                    <CarouselItem key={idx} className="pl-0 h-36">
                                      <img
                                        src={`${getServerUrl()}${url}`}
                                        alt={`${name} – ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </CarouselItem>
                                  )
                                })}
                              </CarouselContent>
                              {images.length > 1 && (
                                <>
                                  <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                  <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                </>
                              )}
                            </Carousel>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Users className="w-10 h-10 text-muted-foreground/40" />
                            </div>
                          )}
                          {(capacity && Number(capacity) > 0) && (
                            <span className="absolute top-2 right-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded shadow z-10">
                              {capacity} {t("ProfilTiersLieuxAbout.capacity")}
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="font-medium text-sm text-foreground truncate">{name}</p>
                          {(hourly > 0 || halfday > 0 || fullday > 0) && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {hourly > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                  {hourly}€ <span className="font-normal text-muted-foreground">/h</span>
                                </span>
                              )}
                              {halfday > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                  {halfday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.halfDay")}</span>
                                </span>
                              )}
                              {fullday > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                  {fullday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.fullDay")}</span>
                                </span>
                              )}
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalItem({
                                name: String(name ?? ""),
                                capacity: Number(capacity) || 0,
                                hourly: Number(hourly) || 0,
                                halfday: Number(halfday) || 0,
                                fullday: Number(fullday) || 0,
                                images: (images as DocumentItem[]).map(src => {
                                  const p = typeof src === "object" && src !== null ? `/upload/${src.moduleId}/${src.folder}/${src.name}` : src;
                                  return `${getServerUrl()}${p}`;
                                }),
                                reserveUrl: linkValue ?? externalLink ?? null,
                              });
                            }}
                          >
                            {t("ProfilTiersLieuxAbout.learnMore")}
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </CardContent>
        </div>
      )}

      {/* ── 7. Accommodation ────────────────────────────── */}
      {section.showAccommodation !== false && (
        <div className="border-b-2 pb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle label={t("ProfilTiersLieuxAbout.accommodation") as string} />
              {canEditProfile && section.bedRoomPath?.id && (
                <Button
                  variant="default"
                  size="sm"
                  className="p-2"
                  onClick={() => openNewFormModal({ formId: section.bedRoomPath!.id, title: t("ProfilTiersLieuxAbout.accommodation") as string })}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {accommodationData.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("ProfilTiersLieuxAbout.noAccommodation")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {accommodationData.map((accommodation) => {
                  const sd = accommodation.serverData as Record<string, unknown>;
                  const type = section.bedRoomPath?.type ?? "single";
                  const linkPath = section.bedRoomPath?.linkPath;
                  const linkValue = linkPath ? getNestedValue(sd.answers as Record<string, unknown>, linkPath) as string | null : null;
                  const accommodationPath = section.bedRoomPath?.place ?? section.bedRoomPath?.accommodationPath;
                  if (type === "array") {
                    if (!accommodationPath) {
                      return null;
                    }
                    const value = getNestedValue(sd.answers as Record<string, unknown>, accommodationPath);
                    if (!value || !Array.isArray(value)) {
                      return null;
                    }
                    return value.map((v: unknown, idx: number) => {
                      if (idx === 0) return null;
                      const row = v as FormAnswerRow;
                      const name : string = row[section.bedRoomPath?.name ?? 0] as string || t("ProfilTiersLieuxAbout.accommodation") ;
                      const minPers : number = section.bedRoomPath?.minPers ? row[section.bedRoomPath.minPers] as number : 0;
                      const maxPers : number = section.bedRoomPath?.maxPers ? row[section.bedRoomPath.maxPers] as number : 0;
                      const hourly : number = section.bedRoomPath?.hourly ? row[section.bedRoomPath.hourly] as number : 0;
                      const halfday : number = section.bedRoomPath?.halfday ? row[section.bedRoomPath.halfday] as number : 0;
                      const fullday : number = section.bedRoomPath?.fullday ? row[section.bedRoomPath.fullday] as number : 0;
                      const images : string[] = section.bedRoomPath?.images ? row[section.bedRoomPath.images] as Array<string> : [];
                      return (
                        <div
                          key={`${accommodation.id}-${idx}`}
                          className="group relative overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                        // onClick={goToCoworkingTab}
                        >
                          {canEditProfile && (
                            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <Button size="icon" variant="secondary" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); openEditFormModal({ formId: section.bedRoomPath!.id, answerId: accommodation._serverData.id, title: t("ProfilTiersLieuxAbout.accommodation") as string }); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="destructive" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleDeleteAnswer(accommodation.id!); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                          <div className="relative h-36 bg-muted overflow-hidden">
                            {images && images.length > 0 ? (
                              <Carousel
                                opts={{ align: "start", loop: images.length > 1 }}
                                className="w-full h-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <CarouselContent className="h-36 ml-0">
                                  {(images as string[]).map((src, idx) => (
                                    <CarouselItem key={idx} className="pl-0 h-36">
                                      <img
                                        src={`${getServerUrl()}${src}`}
                                        alt={`${name} – ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </CarouselItem>
                                  ))}
                                </CarouselContent>
                                {images.length > 1 && (
                                  <>
                                    <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                    <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                  </>
                                )}
                              </Carousel>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Users className="w-10 h-10 text-muted-foreground/40" />
                              </div>
                            )}
                            {(minPers > 0 || maxPers > 0) && (
                              <span className="absolute top-2 right-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded shadow z-10">
                                {minPers > 0 && maxPers > 0 ? `${minPers} - ${maxPers}` : minPers > 0 ? `${minPers}` : `${maxPers}`} {t("ProfilTiersLieuxAbout.capacity")}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="font-medium text-sm text-foreground truncate">{name}</p>
                            {(hourly > 0 || halfday > 0 || fullday > 0) && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {hourly > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                    {hourly}€ <span className="font-normal text-muted-foreground">/h</span>
                                  </span>
                                )}
                                {halfday > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                    {halfday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.halfDay")}</span>
                                  </span>
                                )}
                                {fullday > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                    {fullday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.fullDay")}</span>
                                  </span>
                                )}
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 w-full text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalItem({
                                  name: String(name ?? ""),
                                  minPers: Number(minPers) || 0,
                                  maxPers: Number(maxPers) || 0,
                                  hourly: Number(hourly) || 0,
                                  halfday: Number(halfday) || 0,
                                  fullday: Number(fullday) || 0,
                                  images: (images as string[]).map(src => `${getServerUrl()}${src}`),
                                  reserveUrl: linkValue ?? externalLink ?? null,
                                });
                              }}
                            >
                              {t("ProfilTiersLieuxAbout.learnMore")}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  } else if (type === "single" || type === "answer") {
                    const allImages = _answersByForms?.find((f) => f.id === section.bedRoomPath?.id)?.documents ?? [];
                    const images = Object.values(allImages).filter((doc: unknown) => {
                      return (doc as DocumentItem).folder.includes(sd.id as string);
                    }) as DocumentItem[];
                    const name = (getNestedValue(sd.answers as Record<string, unknown>, section.bedRoomPath?.name ?? "") || t("ProfilTiersLieuxAbout.accommodationSpace")) as string;
                    const capacity = (section.bedRoomPath?.place && getNestedValue(sd.answers as Record<string, unknown>, section.bedRoomPath.place)) as number | undefined;
                    const bed = (section.bedRoomPath?.bedPrice ? getNestedValue(sd.answers as Record<string, unknown>, section.bedRoomPath.bedPrice) : 0) as number;
                    const room = (section.bedRoomPath?.roomPrice ? getNestedValue(sd.answers as Record<string, unknown>, section.bedRoomPath.roomPrice) : 0) as number;
                    return (
                      <div
                        key={`${sd.id}`}
                        className="group relative overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                      // onClick={goToCoworkingTab}
                      >
                        {canEditProfile && (
                          <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <Button size="icon" variant="secondary" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); openEditFormModal({ formId: section.bedRoomPath!.id, answerId: accommodation._serverData.id, title: t("ProfilTiersLieuxAbout.accommodation") as string }); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="destructive" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleDeleteAnswer(accommodation.id!); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        <div className="relative h-36 bg-muted overflow-hidden">
                          {images && images.length > 0 ? (
                            <Carousel
                              opts={{ align: "start", loop: images.length > 1 }}
                              className="w-full h-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <CarouselContent className="h-36 ml-0">
                                {(images as DocumentItem[]).map((src, idx) => {
                                  const url = typeof src === "object" && src !== null ? `/upload/${src.moduleId}/${src.folder}/${src.name}` : src;
                                  return (
                                    <CarouselItem key={idx} className="pl-0 h-36">
                                      <img
                                        src={`${getServerUrl()}${url}`}
                                        alt={`${name} – ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </CarouselItem>
                                  )
                                })}
                              </CarouselContent>
                              {images.length > 1 && (
                                <>
                                  <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                  <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" />
                                </>
                              )}
                            </Carousel>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Users className="w-10 h-10 text-muted-foreground/40" />
                            </div>
                          )}
                          {(capacity != null && capacity > 0) && (
                            <span className="absolute top-2 right-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded shadow z-10">
                              {capacity} {t("ProfilTiersLieuxAbout.capacity")}
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="font-medium text-sm text-foreground truncate">{name}</p>
                          {(bed > 0 || room > 0) && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {bed > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                  {bed}€ <span className="font-normal text-muted-foreground">/{t("ProfilTiersLieuxAbout.bed")}</span>
                                </span>
                              )}
                              {room > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                                  {room}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.nightly")}</span>
                                </span>
                              )}
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full text-xs border-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalItem({
                                name: String(name ?? ""),
                                capacity: Number(capacity) || 0,
                                bed: Number(bed) || 0,
                                room: Number(room) || 0,
                                images: (images as DocumentItem[]).map(src => {
                                  const p = typeof src === "object" && src !== null ? `/upload/${src.moduleId}/${src.folder}/${src.name}` : src;
                                  return `${getServerUrl()}${p}`;
                                }),
                                reserveUrl: linkValue ?? externalLink ?? null,
                              });
                            }}
                          >
                            {t("ProfilTiersLieuxAbout.learnMore")}
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </CardContent>
        </div>
      )}
      {/* ── Modal détail ─────────────────────────────────────── */}
      <Dialog open={!!modalItem} onOpenChange={(open) => !open && setModalItem(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{modalItem?.name ?? ""}</DialogTitle>
          </DialogHeader>
          {/* Carousel d'images */}
          <div className="relative h-56 bg-muted overflow-hidden">
            {modalItem?.images && modalItem.images.length > 0 ? (
              <Carousel opts={{ align: "start", loop: modalItem.images.length > 1 }} className="w-full h-full">
                <CarouselContent className="h-56 ml-0">
                  {modalItem.images.map((src, idx) => (
                    <CarouselItem key={idx} className="pl-0 h-56">
                      <img src={src} alt={`${modalItem.name} – ${idx + 1}`} className="w-full h-full object-cover" />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {modalItem.images.length > 1 && (
                  <>
                    <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8" />
                    <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" />
                  </>
                )}
              </Carousel>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Users className="w-14 h-14 text-muted-foreground/30" />
              </div>
            )}
            {((modalItem?.minPers ?? 0) > 0 || (modalItem?.maxPers ?? 0) > 0 || (modalItem?.capacity ?? 0) > 0) && (
              <span className="absolute top-3 right-3 bg-background/90 text-foreground text-xs px-2 py-1 rounded shadow z-10">
                {modalItem?.capacity
                  ? modalItem.capacity
                  : modalItem?.minPers && modalItem?.maxPers
                    ? `${modalItem.minPers} – ${modalItem.maxPers}`
                    : (modalItem?.minPers ?? modalItem?.maxPers ?? 0)
                }{" "}{t("ProfilTiersLieuxAbout.capacity")}
              </span>
            )}
          </div>
          {/* Contenu */}
          <div className="p-5 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">{modalItem?.name}</h3>
            {/* Prix */}
            {((modalItem?.hourly ?? 0) > 0 || (modalItem?.halfday ?? 0) > 0 || (modalItem?.fullday ?? 0) > 0 ||
              (modalItem?.bed ?? 0) > 0 || (modalItem?.room ?? 0) > 0) && (
                <div className="flex flex-wrap gap-2">
                  {(modalItem?.hourly ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm bg-primary/10 text-primary rounded-md px-3 py-1 font-medium">
                      {modalItem!.hourly}€ <span className="font-normal text-muted-foreground">/h</span>
                    </span>
                  )}
                  {(modalItem?.halfday ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm bg-primary/10 text-primary rounded-md px-3 py-1 font-medium">
                      {modalItem!.halfday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.halfDay")}</span>
                    </span>
                  )}
                  {(modalItem?.fullday ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm bg-primary/10 text-primary rounded-md px-3 py-1 font-medium">
                      {modalItem!.fullday}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.fullDay")}</span>
                    </span>
                  )}
                  {(modalItem?.bed ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm bg-primary/10 text-primary rounded-md px-3 py-1 font-medium">
                      {modalItem!.bed}€ <span className="font-normal text-muted-foreground">/{t("ProfilTiersLieuxAbout.bed")}</span>
                    </span>
                  )}
                  {(modalItem?.room ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm bg-primary/10 text-primary rounded-md px-3 py-1 font-medium">
                      {modalItem!.room}€ <span className="font-normal text-muted-foreground">{t("ProfilTiersLieuxAbout.nightly")}</span>
                    </span>
                  )}
                </div>
              )}
            {/* Bouton réserver */}
            {modalItem?.reserveUrl && (
              <Button
                className="w-full btn-primary"
                onClick={() => window.open(modalItem!.reserveUrl!, "_blank")}
              >
                {t("ProfilTiersLieuxAbout.reserve")}
                <ArrowUpRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CoForm Modal (salles / coworking / hébergement) ──── */}
      {formModal && (
        <CoFormModal
          formId={formModal.formId}
          open={!!formModal}
          onOpenChange={(open) => { if (!open) setFormModal(null); }}
          title={formModal.title}
          answerId={formModal.answerId}
          defaultValues={formModal.defaultValues}
          stepKey={formModal.stepKey}
          inputKey={formModal.inputKey}
          lockedFields={formModal.lockedFields}
          onAfterSubmit={invalidateAnswers}
        />
      )}
    </div>
  );
}
