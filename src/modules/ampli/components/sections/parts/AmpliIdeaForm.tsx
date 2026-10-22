// Bundle i18n du module coform : `SmartCoForm`, `CoFormAccessGuard` et
// `CoFormThankYou` appellent `useT("modules/coform")` alors qu'ils sont montés
// ICI, hors section coform — sans cet import ils afficheraient leurs clés
// brutes (même raison que l'import de `@/modules/search/i18n` dans `MeeteemMap`).
import "@/modules/coform/i18n/i18n";

import { useCallback, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";
import { useAuthModal } from "@/modules/auth/hooks/useAuthModal";
import { CoFormAccessGuard } from "@/modules/coform/components/CoFormAccessGuard";
import { CoFormThankYou } from "@/modules/coform/components/CoFormThankYou";
import { SmartCoForm } from "@/modules/coform/components/SmartCoForm";
import { useCoFormQuery } from "@/modules/coform/hooks/useCoFormQuery";
import { AMPLI_QUERY_KEYS } from "../../../constants/queryKeys";

interface AmpliIdeaFormProps {
  /** Formulaire de la page ampli (`props.coform`) — celui dont les réponses
   *  alimentent les stats de la colonne droite et l'annuaire Meeteem. */
  coformId: string;
  /** Libellé du bouton d'envoi (`features.button` de la config), déjà traduit. */
  submitLabel?: string;
}

/** Squelette au gabarit du formulaire (3 champs + bouton) — évite le saut de
 *  mise en page quand la structure du coform arrive. */
function IdeaFormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className={i === 2 ? "h-24 w-full" : "h-10 w-full"} />
        </div>
      ))}
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

/**
 * Formulaire de proposition d'idée, rendu EN LIGNE dans la colonne gauche
 * d'`AmpliFeatures` (et non dans une modale) : la section décrit déjà le geste
 * attendu (« Proposez votre idée » + « Comment ça marche ? »), le formulaire
 * doit donc être le premier objet à l'écran, pas un clic plus loin.
 *
 * Réutilise TELLE QUELLE la chaîne du module coform — `useCoFormQuery` pour la
 * structure et les droits, `CoFormAccessGuard` pour les refus (non connecté,
 * form fermé, déjà répondu), `SmartCoForm` pour le rendu et la soumission,
 * `CoFormThankYou` pour l'accusé de réception. Ce composant n'ajoute que ce qui
 * est PROPRE à ampli : le libellé du bouton piloté par la config, la bannière
 * masquée (la section porte déjà son titre) et l'invalidation du cache ampli.
 */
export default function AmpliIdeaForm({ coformId, submitLabel }: AmpliIdeaFormProps) {
  const t = useT("modules/ampli");
  const queryClient = useQueryClient();
  const { openLogin } = useAuthModal();
  const { formData, access, isLoading, error, refetch } = useCoFormQuery({ formId: coformId });

  /** Édition de SA réponse (formulaire à réponse unique) — court-circuite le
   *  garde d'accès, qui refuserait pour `already_answered`. */
  const [isEditMode, setIsEditMode] = useState(false);
  /** Non-null = réponse envoyée, on affiche l'accusé de réception à la place. */
  const [submitted, setSubmitted] = useState<{ isUpdate: boolean } | null>(null);

  const handleAfterSubmit = useCallback(() => {
    // `useCoFormFinalMutation` n'invalide QUE les caches coform (FORM /
    // FORM_ANSWERS) : sans ça l'idée tout juste soumise n'apparaîtrait ni dans
    // les compteurs de la colonne droite ni dans l'annuaire Meeteem plus bas,
    // jusqu'au prochain rechargement de page.
    queryClient.invalidateQueries({ queryKey: AMPLI_QUERY_KEYS.FETCH_ANSWERS_PREFIX(coformId) });
    setSubmitted({ isUpdate: isEditMode });
  }, [queryClient, coformId, isEditMode]);

  const handleEditExisting = useCallback(() => {
    setIsEditMode(true);
    setSubmitted(null);
  }, []);

  const handleSubmitAnother = useCallback(() => {
    setIsEditMode(false);
    setSubmitted(null);
  }, []);

  if (isLoading) return <IdeaFormSkeleton />;

  if (error || !formData) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-6 text-center">
        <TriangleAlert className="h-8 w-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">{String(t("AmpliFeatures.form.error"))}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <CoFormThankYou
        config={formData.thankYou}
        isUpdate={submitted.isUpdate}
        className="py-4"
        // Une seule réponse autorisée → la suite logique est de la MODIFIER ;
        // sinon, d'en proposer une autre. Jamais les deux (cf. `CoFormPage`).
        // `existingAnswerId` est exigé : juste après un premier envoi, `access`
        // est encore en cours de refetch et l'id n'est pas là — rouvrir le
        // formulaire à ce moment-là le remonterait en création, donc en
        // DOUBLON. Le bouton apparaît quand l'id arrive.
        onEditAnswer={
          access?.isOneAnswerPerPers && access.existingAnswerId ? handleEditExisting : null
        }
        onSubmitAnother={access?.isOneAnswerPerPers ? null : handleSubmitAnother}
      />
    );
  }

  return (
    <CoFormAccessGuard
      // En édition, l'accès est déjà arbitré : le garde refuserait sur
      // `already_answered` alors que c'est précisément ce qu'on veut faire.
      access={isEditMode ? null : access}
      onEditExisting={handleEditExisting}
      // `refetch` recalcule `canAnswer` après connexion : le formulaire
      // remplace la carte de refus sans recharger la page.
      onLogin={() => openLogin({ onSuccess: refetch })}
    >
      <SmartCoForm
        // `formId` ET `formData` : le premier est indispensable (il identifie
        // le formulaire pour la mutation de soumission et pour la clé du
        // brouillon), le second évite que `SmartCoForm` re-souscrive à la
        // structure — c'est la MÊME entrée de cache que celle lue ici, donc le
        // garde d'accès et le formulaire ne peuvent pas diverger.
        formId={coformId}
        formData={formData}
        answerId={isEditMode ? access?.existingAnswerId ?? undefined : undefined}
        defaultValues={isEditMode ? access?.existingAnswer ?? undefined : undefined}
        onAfterSubmit={handleAfterSubmit}
        submitButtonText={submitLabel}
        // La section porte déjà son `<h2>` : la bannière du coform y ajouterait
        // un second titre (en `<h1>`) au milieu de la colonne.
        hideBanner
      />
    </CoFormAccessGuard>
  );
}
