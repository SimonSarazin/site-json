import { Suspense, useCallback, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { lazy } from "vite-preload";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { COFORM_QUERY_KEYS } from "@/modules/coform/constants";
import { useCoFormAnswerQuery } from "@/modules/coform/hooks/useCoFormQuery";
import { AMPLI_QUERY_KEYS } from "../../../constants/queryKeys";

// Le moteur de formulaire coform est LOURD : il ne doit être téléchargé qu'au
// premier clic sur une réponse (convention lazy de CLAUDE.md — `vite-preload`,
// export default, sous `<Suspense>`).
const CoFormModal = lazy(() => import("@/modules/coform/components/CoFormModal"));

interface MeeteemAnswerModalProps {
  /** Formulaire de la section (`props.coform`) — jamais porté par la réponse :
   *  la projection `defaultFields` ne demande pas le champ `form`. */
  coformId: string;
  /** Réponse à afficher ; `null` = modale fermée (rien n'est chargé). */
  answerId: string | null;
  onClose: () => void;
  /** Titre affiché pendant le chargement, tiré de la carte déjà à l'écran. */
  title?: string;
}

/**
 * Détail d'une réponse Meeteem, en lecture seule — et en ÉDITION quand la
 * réponse est celle de l'utilisateur courant.
 *
 * S'appuie sur la modale du module coform (`CoFormModal readOnly` →
 * `SmartCoForm` → `CoFormReadOnly`) : elle rend n'importe quel formulaire étape
 * par étape sans un seul champ éditable, et charge elle-même la STRUCTURE du
 * formulaire depuis `formId`.
 *
 * Le CONTENU de la réponse, lui, doit être fourni en `defaultValues` : en
 * lecture seule `SmartCoForm` rend `answerData={normalizedDefaults ?? {}}` et ne
 * lit jamais `answerId` pour aller chercher la donnée. Or les cartes Meeteem ne
 * portent qu'une projection partielle (`defaultFields` de la section) — d'où le
 * re-fetch complet ici. Sans lui, la modale s'ouvrirait vide, sans erreur.
 *
 * Ce re-fetch complet est AUSSI ce qui rend l'édition sûre : la sauvegarde
 * coform envoie le payload ENTIER, donc pré-remplir le formulaire avec la
 * projection partielle de la carte effacerait tous les champs absents.
 */
export function MeeteemAnswerModal({ coformId, answerId, onClose, title }: MeeteemAnswerModalProps) {
  const t = useT("modules/ampli");
  const queryClient = useQueryClient();
  const open = Boolean(answerId);

  const { answer, answerData, isLoading, error } = useCoFormAnswerQuery({
    formId: coformId,
    answerId: answerId ?? "",
    // Rien ne part au SSR ni au montage de la section : la requête n'est armée
    // que lorsqu'une réponse est réellement ouverte.
    enabled: open,
  });

  // On mémorise l'ID en cours d'édition, pas un booléen : la modale n'est pas
  // démontée entre deux réponses, et comparer à `answerId` rouvre toujours en
  // LECTURE — sans effet de reset, qu'une réponse éditée condamnerait sinon
  // la suivante à s'ouvrir en édition.
  const [editedAnswerId, setEditedAnswerId] = useState<string | null>(null);
  const isEditing = answerId !== null && editedAnswerId === answerId;

  // `canEdit` est calculé par le BACKEND sur la réponse (propriété, formulaire
  // encore ouvert, utilisateur connecté). C'est la seule autorité : un test
  // local « l'auteur est-ce moi ? » raterait la fermeture du formulaire et
  // afficherait un bouton qui échoue à la sauvegarde.
  const canEdit = Boolean(answer?.canEdit);

  const handleSaved = useCallback(() => {
    // `useCoFormFinalMutation` n'invalide QUE `FORM` et `FORM_ANSWERS` : sans
    // ces deux lignes, la carte de l'annuaire garderait l'ancien texte, et
    // rouvrir le détail servirait la version d'avant (cache de 2 min).
    queryClient.invalidateQueries({ queryKey: AMPLI_QUERY_KEYS.FETCH_ANSWERS_PREFIX(coformId) });
    queryClient.invalidateQueries({
      queryKey: COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(coformId, answerId),
    });
    setEditedAnswerId(null);
  }, [queryClient, coformId, answerId]);

  // Le squelette et l'erreur vivent dans leur PROPRE Dialog : `CoFormModal` ne
  // se monte qu'avec sa donnée, sinon il afficherait une fiche vide (cf. plus haut).
  if (open && (isLoading || error || !answerData)) {
    return (
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title ?? String(t("MeeteemSection.card.details"))}</DialogTitle>
          </DialogHeader>
          {error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {String(t("MeeteemSection.card.detailsError"))}
            </p>
          ) : (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{String(t("MeeteemSection.card.detailsLoading"))}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <CoFormModal
        formId={coformId}
        answerId={answerId ?? undefined}
        defaultValues={answerData ?? undefined}
        open
        onOpenChange={(next) => !next && onClose()}
        title={title ?? String(t("MeeteemSection.card.details"))}
        // La bannière du coform peint le nom du FORMULAIRE (ex. « Sinistre »)
        // en `<h1>` 4xl : il écrasait le titre de la RÉPONSE, seul en tête et
        // en `text-lg`, alors que c'est lui qu'on est venu lire. On masque la
        // bannière et on rend le titre à sa taille de titre de fiche.
        hideBanner
        titleClassName="text-2xl sm:text-3xl font-bold"
        readOnly={!isEditing}
        // Rien quand la réponse n'est pas la sienne : on n'affiche pas un
        // bouton désactivé ni un « vous ne pouvez pas modifier » sur chaque
        // fiche d'autrui, ce serait du bruit sur le cas majoritaire.
        headerActions={
          !isEditing && canEdit ? (
            <Button variant="outline" size="sm" onClick={() => setEditedAnswerId(answerId)}>
              <Pencil />
              {String(t("MeeteemSection.card.edit"))}
            </Button>
          ) : undefined
        }
        onAfterSubmit={handleSaved}
      />
    </Suspense>
  );
}
