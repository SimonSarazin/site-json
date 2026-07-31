import { Suspense, useCallback, useMemo, useState } from "react";
import { lazy } from "vite-preload";
import { useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Accessibility, Calendar, Clock, Heart, Loader2, Lock, Mail, MapPin, Pencil, Phone, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCoFormAnswerQuery } from "@/modules/coform/hooks/useCoFormQuery";
import { COFORM_QUERY_KEYS } from "@/modules/coform/constants";
import type { PreviewProps } from "../../schema";
import {
  SEARCH_QUERY_KEYS,
  SEARCH_STATIC_LIST_PREFIX,
  SEARCH_STATIC_MAP_PREFIX,
} from "../../constants/queryKeys";
import {
  parseCoformAnswer,
  getStatusStyle,
  getAnswerRef,
  canEditCoformAnswer,
} from "../../lib/coformAnswer";

// Édition de l'answer (`preview.editButton`) : chunk coform chargé seulement au
// clic sur « Modifier » — jamais pour les visiteurs du détail en lecture.
const CoFormModal = lazy(() => import("@/modules/coform/components/CoFormModal"));

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
        <Icon className="w-4 h-4 shrink-0" />
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * Contenu de détail « réponse CoForm » (activité avec horaires / structure)
 * — ex-`AnswerDetailModeDialog`. Variante de contenu (`preview.type ===
 * "coform-answer"`) rendue DANS le conteneur de détail (`detailsMode`).
 *
 * Lecture déléguée à `parseCoformAnswer` (partagé avec `CardAnswer`) ;
 * libellés via i18n (`coformAnswer.*` / `days.*`).
 */
export default function PreviewCoformAnswer({ item, preview, onClose }: PreviewProps) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { entity, me } = useCocolight();
  const queryClient = useQueryClient();
  const serverData = item?.serverData as Record<string, unknown> | undefined;

  // Référence mémoïsée : recalculée à chaque render, elle ferait changer les
  // deps de `handleEdited` en continu (useCallback inopérant).
  const answerRef = useMemo(() => getAnswerRef(item), [item]);
  // Opt-in config + règle de droits (super-admin / admin du costum / admin de la
  // structure organisatrice) — cf. `canEditCoformAnswer`.
  const canRequestEdit = Boolean(
    preview?.editButton && answerRef && canEditCoformAnswer(serverData, { me, entity }),
  );
  const [editRequested, setEditRequested] = useState(false);
  // Re-fetch FRAIS de l'answer avant édition : la recherche renvoie les champs
  // à PLAT (`<costum><fieldId>`), le formulaire attend `answers` imbriqué par
  // étape — et le save coform renvoie le payload COMPLET, donc un
  // pré-remplissage partiel effacerait les champs absents.
  const { answerData, isLoading: isAnswerLoading, error: answerError } = useCoFormAnswerQuery({
    formId: answerRef?.formId ?? "",
    answerId: answerRef?.answerId ?? "",
    enabled: canRequestEdit && editRequested,
  });

  // Seule garde bloquante : pas d'answer chargée (erreur réseau, réponse vide).
  // Ouvrir le formulaire sur du vide écraserait la réponse au save (payload
  // COMPLET). On NE bloque PAS sur `answer.canEdit` : le backend le calcule sur
  // la propriété seule, il refuse donc un admin de costum légitime.
  const isEditResolved = editRequested && !isAnswerLoading;
  const editBlockedKey = isEditResolved && (answerError || !answerData) ? "coformAnswer.editError" : null;

  // Le contenu du dialog vient du cache search (jamais re-fetché) : après un
  // save, on invalide les listes (liste ET carte — cache 30 min de
  // `useSearchAllResults`) + le détail coform, puis on FERME le détail pour ne
  // pas laisser l'ancien état affiché.
  const handleEdited = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STATIC_LIST_PREFIX) });
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STATIC_MAP_PREFIX) });
    if (answerRef) {
      queryClient.invalidateQueries({
        queryKey: COFORM_QUERY_KEYS.FORM_ANSWER(answerRef.formId, answerRef.answerId, me?.id ?? null),
      });
    }
    setEditRequested(false);
    onClose?.();
  }, [queryClient, answerRef, me?.id, onClose]);

  if (!serverData) {
    return null;
  }

  const a = parseCoformAnswer(serverData, {
    slug: entity?.serverData?.slug,
    fields: preview?.fields,
  });
  const title = a.title ?? t("coformAnswer.noTitle");
  const description = a.description ?? t("coformAnswer.noDescription");

  return (
    <div className="flex max-h-[90vh] flex-col">
      <div className="shrink-0 px-6 py-5" style={{ background: "var(--card-header-gradient)" }}>
        <div className="space-y-2 text-left">
          {/* flex-wrap + pr-8 : un type long (ex. "Sport santé sur ordonnance - SSsO")
              ne doit pas déborder en largeur ni passer sous le bouton X (haut-droite). */}
          <div className="flex flex-wrap items-center gap-2 pr-8">
            {a.typeRaw && (
              <Badge className="max-w-full whitespace-normal break-words text-left rounded-full border-0 bg-white/20 text-primary-foreground hover:bg-white/20">
                {a.typeRaw}
              </Badge>
            )}
            <Badge className={`rounded-full border-0 ${getStatusStyle(a.status)}`}>
              {a.stateRaw || t("coformAnswer.validated")}
            </Badge>
            {canRequestEdit && (
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto bg-white/20 text-primary-foreground hover:bg-white/30"
                onClick={() => setEditRequested(true)}
                disabled={editRequested && isAnswerLoading}
              >
                {editRequested && isAnswerLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
                {t("coformAnswer.edit")}
              </Button>
            )}
          </div>
          {/* Édition demandée mais impossible : on le DIT (role="alert"), sinon
              le clic reste sans effet visible. */}
          {editBlockedKey && (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" />
              {t(editBlockedKey)}
            </p>
          )}
          <h2 className="text-2xl font-bold uppercase text-primary-foreground tracking-wide">
            {title}
          </h2>
        </div>
        <p className="mt-3 text-sm text-primary-foreground/85 leading-relaxed">{description}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={MapPin} title={t("coformAnswer.address")}>
              {a.addressParts.length > 0 ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  {a.addressParts.map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("coformAnswer.addressEmpty")}</p>
              )}
            </InfoCard>

            <InfoCard icon={Phone} title={t("coformAnswer.contact")}>
              {a.structure.email && (
                <p className="text-sm text-foreground font-semibold break-all flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {a.structure.email}
                </p>
              )}
              {a.structure.phone && (
                <p className="text-sm text-foreground font-semibold">{a.structure.phone}</p>
              )}
              {(a.instructorFirstName || a.instructorLastName) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3 shrink-0" />
                  {a.instructorFirstName} {a.instructorLastName}
                </p>
              )}
            </InfoCard>
          </div>

          <InfoCard icon={Calendar} title={t("coformAnswer.schedule")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
              {a.schedules.length > 0 ? (
                a.schedules.map((schedule) => (
                  <div
                    key={schedule.dayKey}
                    className="flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs border border-border"
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0 text-primary mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">{t("days." + schedule.dayKey)}</span>
                      <p className="text-muted-foreground mt-0.5 leading-relaxed">
                        {schedule.times.join(" / ")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">{t("coformAnswer.scheduleEmpty")}</p>
              )}
            </div>
          </InfoCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={Heart} title={t("coformAnswer.activity")}>
              <p className="text-sm font-semibold text-foreground">{a.typeActivity || title}</p>
              <p className="text-xs text-muted-foreground">{a.typeGender || a.typeRaw}</p>
            </InfoCard>

            <InfoCard icon={Users} title={t("coformAnswer.beneficiaries")}>
              {a.beneficiaries.length > 0 ? (
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {a.beneficiaries.map((beneficiary, index) => (
                    <li key={`${beneficiary}-${index}`}>{beneficiary}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{t("coformAnswer.beneficiariesEmpty")}</p>
              )}
            </InfoCard>

            <InfoCard icon={Accessibility} title={t("coformAnswer.accessibility")}>
              <p className="text-sm text-foreground font-semibold">{t("coformAnswer.reducedMobility")}</p>
              <span className="inline-block rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {a.mobilityReduced || t("coformAnswer.notProvided")}
              </span>
            </InfoCard>

            <InfoCard icon={MapPin} title={t("coformAnswer.installation")}>
              {a.installations.length > 0 ? (
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {a.installations.map((installation) => (
                    <li key={installation.id}>{installation.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{t("coformAnswer.installationEmpty")}</p>
              )}
            </InfoCard>
          </div>
        </div>
      </div>

      {/* Monté seulement quand l'answer fraîche est chargée ET l'édition
          autorisée par le backend (`editBlockedKey === null`) : ouvrir le
          formulaire sur des données partielles effacerait des champs au save
          (payload complet). Dialog empilé sur le détail (portals). */}
      {answerRef && isEditResolved && !editBlockedKey && answerData && (
        <Suspense fallback={null}>
          <CoFormModal
            formId={answerRef.formId}
            answerId={answerRef.answerId}
            defaultValues={answerData}
            open
            onOpenChange={(open) => {
              if (!open) setEditRequested(false);
            }}
            title={String(t("coformAnswer.edit"))}
            onAfterSubmit={handleEdited}
          />
        </Suspense>
      )}
    </div>
  );
}
