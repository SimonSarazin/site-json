import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
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
import { Answer } from "@communecter/cocolight-api-client";

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

interface ProfileAboutProps {
  section: ProfileTiersLieuxAboutSection;
}

export default function ProfileTiersLieuxAbout({ section }: ProfileAboutProps) {
  const { entity, t, entityType } = useProfileSetup();
  const { shortDescription, description } = useFormatProfileEntity(entity);
  const { canEditProfile } = useProfilPermissions(entity);
  const navigate = useNavigate();
  const getNestedValue = (obj: Record<string, any>, path: string): any =>
    path.split('.').reduce((current: any, key: string) => current?.[key], obj);

  const { data: _answersByForms, isLoading: _isAnswersByFormsLoading, error: _answersError } = useGetAnswersByFormsQuery({
    entity,
    forms: section.forms,
    enabled: !!entity && !!section.forms && Object.keys(section.forms).length > 0,
  });
  const handleClickForm = useCallback(async (formId: string, finder?: string, step?: string, input?: string, answerId?: string, key?: string) => {
    const dataForms = _answersByForms?.find((item: any) => item.id === formId);
    const accessToken = entity.apiClient.getToken();
    let answer: Answer | undefined = undefined;
    if (dataForms && dataForms.answers.length > 0 && key != "new") {
      if (answerId) {
        answer = dataForms?.answers.find((a: any) => a.id === answerId);
      } else {
        answer = dataForms.answers[0];
      }
    } else {
      answer = await entity.generateNewAnswerId(formId);
      if (!answer) {
        console.error("Failed to generate new answer ID for form:", formId);
        return;
      }
      const finderPath = finder ? finder : section.forms?.[formId]?.finder;
      const params = {
        id: answer.id,
        collection: "answers",
        path: `${finderPath}.${entity.id}`,
        value: {
          id: entity.id,
          type: entity.serverData.collection,
          name: entity.serverData.name,
        }
      }
      const paramsLinks = {
        id: answer.id,
        collection: "answers",
        path: `links.${entity.serverData.collection}.${entity.id}`,
        value: {
          type: entity.serverData.collection,
          name: entity.serverData.name,
        }
      }
      await entity.endpointApi.updatePathValue(params);
      await entity.endpointApi.updatePathValue(paramsLinks);
      // entity.endpointApi.updatePathValue({
      //     "id": 
      // })
    }
    if (!answer) {
      console.error("No answer available to open for form:", formId);
      return;
    }
    const targetUrl = `/#answer.index_coformv2.id.${answer.serverData.id}.form.${formId}.${step ? `step.${step}.` : ''}${input ? `input.${input}.` : ''}mode.w.standalone.true.ask.false`
    const urlToRedirect = `${getServerUrl()}/co2/embed/render?targetUrl=${encodeURIComponent(targetUrl)}&embedToken=${accessToken}`;
    window.open(urlToRedirect, "_blank");

  }, [_answersByForms])

  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showAllEquip, setShowAllEquip] = useState(false);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const rooms: any[] = useMemo(() => {
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

    const roomData = _answersByForms?.find((f: Record<string, any>) => f.id === roomId);

    return roomData && roomData.answers ? roomData.answers : [];
  }, [_answersByForms, section.roomPath]);
  /* List of coworking answers */
  const coworkData: any[] = useMemo(() => {
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

    const coworkData = _answersByForms?.find((f: Record<string, any>) => f.id === coworkId);
    return coworkData && coworkData.answers ? coworkData.answers : [];
  }, [_answersByForms, section.coworkingPath]);
  /* List of accommodation answers */
  const accommodationData: any[] = useMemo(() => {
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
    const accommodationData = _answersByForms?.find((f: Record<string, any>) => f.id === accommodationId);
    return accommodationData && accommodationData.answers ? accommodationData.answers : [];
  }, [_answersByForms, section.bedRoomPath]);
  // Équipements depuis serverData
  const equipements: any[] = useMemo(() => {
    if (!section.equipement || !_answersByForms) return [];
    if (_isAnswersByFormsLoading) {
      return [];
    }
    const surveyData = _answersByForms.find((f: Record<string, any>) => f.id === section.equipement?.id);
    if (!surveyData || !surveyData.answers) return [];
    let equipList: Set<string> = new Set();
    surveyData.answers.forEach((answer: any) => {
      const value = getNestedValue(answer.serverData.answers, section.equipement?.answerPath ?? "");
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
                const newValue = (val as any).value;
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
  }, [section.equipement, _answersByForms]);

  const activities: any[] = useMemo(() => {
    if (!section.activity || !_answersByForms) return [];
    if (_isAnswersByFormsLoading) {
      return [];
    }
    const surveyData = _answersByForms.find((f: Record<string, any>) => f.id === section.activity?.id);
    if (!surveyData || !surveyData.answers) return [];
    let equipList: Set<string> = new Set();
    surveyData.answers.forEach((answer: any) => {
      const value = getNestedValue(answer.serverData.answers, section.activity?.answerPath ?? "");
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
                const newValue = (val as any).value;
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
    return Array.from(equipList).concat(Array.from(equipList));
  }, [section.activity, _answersByForms]);

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

  const handleDeleteAnswer = useCallback(async (answerId: string) => {
    if (!window.confirm(t("ProfilTiersLieuxAbout.confirmDelete"))) return;
    try {
      await (entity.endpointApi as any).deleteElement({
        reason: "delete answer from profile",
        pathParams: { type: "answers", id: answerId }
      });
      window.location.reload();
    } catch (e) {
      console.error("Error deleting answer:", e);
    }
  }, [entity]);

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
              {canEditProfile && section.equipement?.step && section.equipement?.input && (
                <Button
                  variant="default"
                  size="sm"
                  className="p-2"
                  onClick={() => handleClickForm(section.equipement!.id, section.equipement!.finder, section.equipement!.step, section.equipement!.input)}
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
              {canEditProfile && section.activity?.step && section.activity?.input && (
                <Button
                  variant="default"
                  size="sm"
                  className="p-2"
                  onClick={() => handleClickForm(section.activity!.id, section.activity!.finder, section.activity!.step, section.activity!.input)}
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
                  onClick={() => handleClickForm(section.roomPath!.id, undefined, undefined, undefined, rooms.length > 0 ? rooms[0].id : undefined)}
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
                  const sd = room.serverData as Record<string, any>;
                  const type = section.roomPath?.type;
                  const linkPath = section.roomPath?.linkPath;
                  const linkValue = linkPath ? getNestedValue(sd.answers, linkPath) : null;
                  const roomPath = section.roomPath?.place ?? section.roomPath?.roomPath;
                  if (type === "array") {
                    if (!roomPath) {
                      return null;
                    }
                    const value = getNestedValue(sd.answers, roomPath);
                    if (!value || !Array.isArray(value)) {
                      return null;
                    }
                    return value.map((v: any, idx: number) => {
                      if (idx === 0) return null;
                      const name = v[section.roomPath?.name ?? 0];
                      const minPers = section.roomPath?.minPers ? v[section.roomPath.minPers] : 0;
                      const maxPers = section.roomPath?.maxPers ? v[section.roomPath.maxPers] : 0;
                      const hourly = section.roomPath?.hourly ? v[section.roomPath.hourly] : 0;
                      const halfday = section.roomPath?.halfday ? v[section.roomPath.halfday] : 0;
                      const fullday = section.roomPath?.fullday ? v[section.roomPath.fullday] : 0;
                      const images = section.roomPath?.images ? v[section.roomPath.images] : [];
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
                  onClick={() => handleClickForm(section.coworkingPath!.id, undefined, undefined, undefined, undefined, "new")}
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
                  const sd = coworking.serverData as Record<string, any>;
                  const type = section.coworkingPath?.type ?? "single";
                  const linkPath = section.coworkingPath?.linkPath;
                  const linkValue = linkPath ? getNestedValue(sd.answers, linkPath) : null;
                  const coworkingPath = section.coworkingPath?.place ?? section.coworkingPath?.coworkingPath;
                  if (type === "array") {
                    if (!coworkingPath) {
                      return null;
                    }
                    const value = getNestedValue(sd.answers, coworkingPath);
                    if (!value || !Array.isArray(value)) {
                      return null;
                    }
                    return value.map((v: any, idx: number) => {
                      if (idx === 0) return null;
                      const name = v[section.coworkingPath?.name ?? 0];
                      const minPers = section.coworkingPath?.minPers ? v[section.coworkingPath.minPers] : 0;
                      const maxPers = section.coworkingPath?.maxPers ? v[section.coworkingPath.maxPers] : 0;
                      const hourly = section.coworkingPath?.hourly ? v[section.coworkingPath.hourly] : 0;
                      const halfday = section.coworkingPath?.halfday ? v[section.coworkingPath.halfday] : 0;
                      const fullday = section.coworkingPath?.fullday ? v[section.coworkingPath.fullday] : 0;
                      const images = section.coworkingPath?.images ? v[section.coworkingPath.images] : [];
                      return (
                        <div
                          key={`${coworking.id}-${idx}`}
                          className="group relative overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                        // onClick={goToCoworkingTab}
                        >
                          {canEditProfile && (
                            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <Button size="icon" variant="secondary" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleClickForm(section.coworkingPath!.id, undefined, undefined, undefined, coworking.id); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="destructive" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleDeleteAnswer(coworking.id); }}>
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
                    const allImages = _answersByForms?.find((f: Record<string, any>) => f.id === section.coworkingPath?.id)?.documents ?? [];
                    const images = Object.values(allImages).filter((doc: any) => {
                      return doc.folder.includes(sd.id);
                    });
                    const name = getNestedValue(sd.answers, section.coworkingPath?.name ?? "") || t("ProfilTiersLieuxAbout.coworkingSpace");
                    const capacity = (section.coworkingPath?.place && getNestedValue(sd.answers, section.coworkingPath.place)) || null;
                    const hourly = section.coworkingPath?.hourly ? getNestedValue(sd.answers, section.coworkingPath.hourly) : 0;
                    const halfday = section.coworkingPath?.halfday ? getNestedValue(sd.answers, section.coworkingPath.halfday) : 0;
                    const fullday = section.coworkingPath?.fullday ? getNestedValue(sd.answers, section.coworkingPath.fullday) : 0;
                    return (
                      <div
                        key={`${sd.id}`}
                        className="group relative overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                      // onClick={goToCoworkingTab}
                      >
                        {canEditProfile && (
                          <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <Button size="icon" variant="secondary" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleClickForm(section.coworkingPath!.id, undefined, undefined, undefined, coworking.id); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="destructive" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleDeleteAnswer(coworking.id); }}>
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
                                {(images as any[]).map((src, idx) => {
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
                          {(capacity > 0) && (
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
                                images: (images as any[]).map(src => {
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
                  onClick={() => handleClickForm(section.bedRoomPath!.id, undefined, undefined, undefined, undefined, "new")}
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
                  const sd = accommodation.serverData as Record<string, any>;
                  const type = section.bedRoomPath?.type ?? "single";
                  const linkPath = section.bedRoomPath?.linkPath;
                  const linkValue = linkPath ? getNestedValue(sd.answers, linkPath) : null;
                  const accommodationPath = section.bedRoomPath?.place ?? section.bedRoomPath?.accommodationPath;
                  if (type === "array") {
                    if (!accommodationPath) {
                      return null;
                    }
                    const value = getNestedValue(sd.answers, accommodationPath);
                    if (!value || !Array.isArray(value)) {
                      return null;
                    }
                    return value.map((v: any, idx: number) => {
                      if (idx === 0) return null;
                      const name = v[section.bedRoomPath?.name ?? 0];
                      const minPers = section.bedRoomPath?.minPers ? v[section.bedRoomPath.minPers] : 0;
                      const maxPers = section.bedRoomPath?.maxPers ? v[section.bedRoomPath.maxPers] : 0;
                      const hourly = section.bedRoomPath?.hourly ? v[section.bedRoomPath.hourly] : 0;
                      const halfday = section.bedRoomPath?.halfday ? v[section.bedRoomPath.halfday] : 0;
                      const fullday = section.bedRoomPath?.fullday ? v[section.bedRoomPath.fullday] : 0;
                      const images = section.bedRoomPath?.images ? v[section.bedRoomPath.images] : [];
                      return (
                        <div
                          key={`${accommodation.id}-${idx}`}
                          className="group relative overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                        // onClick={goToCoworkingTab}
                        >
                          {canEditProfile && (
                            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <Button size="icon" variant="secondary" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleClickForm(section.bedRoomPath!.id, undefined, undefined, undefined, accommodation.id); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="destructive" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleDeleteAnswer(accommodation.id); }}>
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
                    const allImages = _answersByForms?.find((f: Record<string, any>) => f.id === section.bedRoomPath?.id)?.documents ?? [];
                    const images = Object.values(allImages).filter((doc: any) => {
                      return doc.folder.includes(sd.id);
                    });
                    const name = getNestedValue(sd.answers, section.bedRoomPath?.name ?? "") || t("ProfilTiersLieuxAbout.accommodationSpace");
                    const capacity = (section.bedRoomPath?.place && getNestedValue(sd.answers, section.bedRoomPath.place)) || null;
                    const bed = section.bedRoomPath?.bedPrice ? getNestedValue(sd.answers, section.bedRoomPath.bedPrice) : 0;
                    const room = section.bedRoomPath?.roomPrice ? getNestedValue(sd.answers, section.bedRoomPath.roomPrice) : 0;
                    return (
                      <div
                        key={`${sd.id}`}
                        className="group relative overflow-hidden rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                      // onClick={goToCoworkingTab}
                      >
                        {canEditProfile && (
                          <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <Button size="icon" variant="secondary" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleClickForm(section.bedRoomPath!.id, undefined, undefined, undefined, accommodation.id); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="destructive" className="h-7 w-7 shadow" onClick={(e) => { e.stopPropagation(); handleDeleteAnswer(accommodation.id); }}>
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
                                {(images as any[]).map((src, idx) => {
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
                          {(capacity > 0) && (
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
                                images: (images as any[]).map(src => {
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
    </div>
  );
}
