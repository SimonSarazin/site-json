/**
 * Slot GÉNÉRIQUE « doublons » des formulaires costum (clé de registre `slot:entityDuplicates`).
 * Pendant la saisie d'une CRÉATION, signale les entités existantes dont le nom approche celui
 * saisi — alerte NON bloquante : le nom seul ne prouve rien (« L'Archipel » existe dans six
 * villes), c'est à l'utilisateur de reconnaître son lieu.
 *
 * Rendu DANS le `<form>` du moteur : lit les valeurs par `useWatch`, et tous ses boutons sont
 * `type="button"` (un bouton sans type soumettrait le formulaire). En wizard, l'étape inactive est
 * DÉMONTÉE : le slot ne garde aucun état durable, tout se recalcule depuis les valeurs du
 * formulaire et le cache de recherche. Il se pose donc à chaque étape où il doit être vu (nom,
 * adresse) — une seule instance est montée à la fois.
 *
 * Paramètres : bloc `duplicateCheck` de la spec (`DuplicateCheckSpec`).
 */
import { Suspense, useId, useMemo, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { lazy } from "vite-preload";
import { ExternalLink, Eye, Info, Loader2, TriangleAlert } from "lucide-react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";

import { useEntityDuplicates } from "../hooks/useEntityDuplicates";
import { buildDuplicateBaseParams } from "../lib/duplicateSearch";
import { candidatePlace, duplicateHintKey, type DuplicateLevel } from "../lib/entityDuplicates";
import type { DuplicateCheckSpec } from "./entityModalSpec";

// Aperçu d'une fiche — lazy : le conteneur et les previews du module search ne sont chargés qu'au
// premier clic. `SwitchDetailsMode` (et non `DetailsModeDialog` seul) : c'est lui qui enregistre
// le bundle i18n du module search.
const SwitchDetailsModeLazy = lazy(() =>
  import("@/modules/search/components/SwitchDetailsMode").then((m) => ({ default: m.SwitchDetailsMode })),
);

const HINT_CLASS: Record<DuplicateLevel, string> = {
  strong: "bg-warning text-warning-foreground",
  likely: "bg-muted text-foreground",
  possible: "bg-muted text-muted-foreground",
};

export default function EntityDuplicatesSlot({ params }: { params: DuplicateCheckSpec }) {
  const t = useT("modules/profil");
  const { config } = useSite();
  // Id propre à l'instance : en layout à plat, deux ancres du slot sont montées en même temps.
  const titleId = useId();

  // Abonnement aux SEULS champs utiles. Sans champ code postal déclaré, le second abonnement
  // observe le nom (un hook ne se conditionne pas) et sa valeur est ignorée.
  const name: unknown = useWatch({ name: params.nameField });
  const watchedPostalCode: unknown = useWatch({ name: params.postalCodeField ?? params.nameField });
  const postalCode = params.postalCodeField ? watchedPostalCode : undefined;

  // Mémoïsé : l'objet entre dans la clé de cache de la recherche, et sa construction valide les
  // `baseParams` de la section par zod — à ne pas refaire à chaque frappe.
  const baseParams = useMemo(
    () => buildDuplicateBaseParams(params.search, config, params.fetchLimit),
    [params.search, params.fetchLimit, config],
  );
  if (import.meta.env.DEV && baseParams === null) {
    console.warn("[EntityDuplicatesSlot] périmètre introuvable ou non pris en charge (duplicateCheck.search) — aucune recherche de doublons.", params.search);
  }

  const { matches, found, isLoading, isError } = useEntityDuplicates({
    name,
    postalCode,
    baseParams,
    active: true,
    minChars: params.minChars,
    limit: params.limit,
  });

  // Aperçu : l'entité ouverte, et le bouton qui l'a ouverte — Radix ne rend pas le focus à un
  // déclencheur qu'il ne connaît pas (Dialog contrôlé, sans DialogTrigger).
  const [preview, setPreview] = useState<SearchEntity | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closePreview = (open: boolean) => {
    if (open) return;
    setPreview(null);
    const trigger = triggerRef.current;
    // Le bouton peut avoir disparu entre-temps (liste reclassée, nom modifié) : on ne rend le focus
    // qu'à un élément encore dans le document.
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); });
  };

  // Rien à dire : le slot ne rend RIEN (pas de « 0 résultat » sous un champ), et son enveloppe
  // disparaît de la grille du formulaire (`empty:hidden`, formEngine/layouts/shared.tsx).
  if (matches.length === 0 && !isError) return null;

  const strong = matches.some((m) => m.level === "strong");
  const hidden = found - matches.length;
  const Icon = strong ? TriangleAlert : Info;

  return (
    <section
      role="status"
      aria-live="polite"
      aria-labelledby={titleId}
      className={`rounded-lg border p-3 ${strong ? "border-warning bg-warning/15" : "border-border bg-muted/40"}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          <p id={titleId} className="text-sm font-medium">
            {isError
              ? t("EntityDuplicates.error")
              : t(strong ? "EntityDuplicates.titleStrong" : "EntityDuplicates.title", undefined, { count: found })}
          </p>
          {!isError && <p className="text-xs text-muted-foreground">{t("EntityDuplicates.description")}</p>}
        </div>
        {isLoading && (
          <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
        )}
      </div>

      {matches.length > 0 && (
        <ul className="mt-3 space-y-2">
          {matches.map((match) => {
            const { candidate } = match;
            const place = candidatePlace(candidate);
            const hint = duplicateHintKey(match);
            return (
              <li key={candidate.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border/60 bg-background/70 p-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="break-words text-sm font-semibold text-foreground">{candidate.name}</p>
                  <p className="text-xs text-muted-foreground">{place || t("EntityDuplicates.placeUnknown")}</p>
                  {hint && (
                    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${HINT_CLASS[match.level]}`}>{t(hint)}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      setPreview(match.entity);
                    }}
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    {t("EntityDuplicates.preview")}
                    <span className="sr-only"> — {candidate.name}</span>
                  </button>
                  {candidate.slug && (
                    // Nouvel onglet : naviguer dans l'onglet courant quitterait le formulaire en cours,
                    // et la garde « modifications non enregistrées » ne protège pas un changement de route.
                    <a
                      href={`/profil/${encodeURIComponent(candidate.slug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {t("EntityDuplicates.open")}
                      <span className="sr-only"> — {candidate.name} {t("EntityDuplicates.newTab")}</span>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && <p className="mt-2 text-xs text-muted-foreground">{t("EntityDuplicates.more", undefined, { count: hidden })}</p>}

      {preview && (
        // Frontière PROPRE : sans elle, le Suspense du moteur remplacerait tout le formulaire par son loader.
        <Suspense fallback={null}>
          <SwitchDetailsModeLazy
            openDetails
            setOpenDetails={closePreview}
            item={preview}
            card={{ detailsMode: params.detailsMode ?? "dialog" }}
          />
        </Suspense>
      )}
    </section>
  );
}
