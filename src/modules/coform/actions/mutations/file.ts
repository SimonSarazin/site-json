/**
 * Mutation de soumission finale d'un formulaire CoForm.
 *
 * Délégation au pipeline lib (`Answer.processUploads` + `Answer.save`).
 * Toute l'orchestration upload-batching-normalisation-clean-save vit côté
 * `@communecter/cocolight-api-client` (≥ 1.0.134).
 *
 * Avant : ~242 lignes d'orchestration manuelle (collecte data:URI, premier
 * upload séparé, batching, normalisation legacy uploader, clean URLs, save).
 * Après : 1 appel `processUploads` + `save`.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../../constants";
import type { AllStepsData } from "../../types";

/**
 * Collecte les `docId` des feuilles uploader, en gérant SYMÉTRIQUEMENT les deux
 * formes de `files` : map `{docId: docPath}` ET Array `[{docId}]`. Ignorer
 * l'Array sur-supprimait (côté soumis vu vide). Exporté pour les tests.
 */
export function collectUploaderDocIds(answers: unknown): Set<string> {
  const docIds = new Set<string>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const files = record.files;
    if ("updateDate" in record && files && typeof files === "object") {
      if (Array.isArray(files)) {
        // Forme de travail UI : [{ docId, docPath }]
        for (const item of files) {
          if (
            item &&
            typeof item === "object" &&
            typeof (item as { docId?: unknown }).docId === "string"
          ) {
            docIds.add((item as { docId: string }).docId);
          }
        }
      } else {
        // Forme canonique : { docId: docPath }
        for (const docId of Object.keys(files as Record<string, unknown>)) {
          docIds.add(docId);
        }
      }
      return; // feuille uploader : pas de descente plus profonde
    }
    for (const value of Object.values(record)) walk(value);
  };
  walk(answers);
  return docIds;
}

/**
 * Extrait les `docId` tracés dans `deletedDocIds` (retraits explicites par
 * UploaderField) et renvoie la structure NETTOYÉE de cette clé transitoire. Seule
 * source pour supprimer un legacy non-en-map (snapshot aveugle) ; STRIPé ici pour
 * ne jamais le persister. Exporté pour les tests.
 */
export function extractDeletedDocIds(answers: unknown): {
  cleaned: unknown;
  deletedDocIds: Set<string>;
} {
  const deletedDocIds = new Set<string>();
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(walk);
    const record = node as Record<string, unknown>;
    if ("updateDate" in record && Array.isArray(record.deletedDocIds)) {
      for (const id of record.deletedDocIds) {
        if (typeof id === "string") deletedDocIds.add(id);
      }
      const rest: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(record)) {
        if (key !== "deletedDocIds") rest[key] = val;
      }
      return rest; // feuille uploader nettoyée (on ne descend pas dans `files`)
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) out[key] = walk(val);
    return out;
  };
  const cleaned = walk(answers);
  return { cleaned, deletedDocIds };
}

export interface UseCoFormFinalMutationOptions {
  formId: string;
  answerId?: string | null;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export interface CoFormFinalMutationData {
  allData: AllStepsData;
  addedOptions?: Record<string, Record<string, string[]>>;
  /** Liens à ajouter dans answer.links (éléments Finder sélectionnés) */
  links?: Record<string, Record<string, { name: string; type: string }>>;
}

/**
 * Hook pour soumettre le formulaire complet via la lib entité.
 * Supporte la création (nouvelle réponse) et la mise à jour (answerId fourni).
 */
export function useCoFormFinalMutation({
  formId,
  answerId,
  onSuccess,
  onError,
}: UseCoFormFinalMutationOptions) {
  const { api } = useCocolight();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ allData, addedOptions, links }: CoFormFinalMutationData) => {
      if (!api) throw new Error("API non initialisée");

      // 1. Charger le Form (parent costum) puis créer/fetch l'Answer.
      // TODO: éviter le double-fetch quand le Form est déjà dans le cache RQ.
      const form = await api.form({ id: formId });
      const answer = answerId
        ? await form.answer({ id: answerId })
        : await form.answer();

      // Snapshot des fichiers uploader déjà attachés à la réponse AVANT toute
      // mutation (form.answer({id}) a fetché le serverData via .get()). Sert à
      // la suppression DIFFÉRÉE : les fichiers retirés du formulaire mais non
      // encore supprimés côté serveur seront purgés au save (étape 5).
      const filesAtLoad = collectUploaderDocIds(
        (answer.serverData as { answers?: unknown } | undefined)?.answers,
      );

      // 2. Pipeline upload complet (data:URI → docPath, batching, normalisation
      //    legacy uploader, clean URLs absolues) en UNE ligne.
      const prepared = await answer.processUploads(
        allData as Record<string, Record<string, unknown>>,
      );

      // 3. Extraire + stripper la trace `deletedDocIds` (transitoire, jamais
      //    persistée). `cleanedAnswers` = payload réellement sauvegardé.
      const { cleaned: cleanedAnswers, deletedDocIds: explicitlyDeleted } =
        extractDeletedDocIds(prepared);

      // Affecter les données préparées (nettoyées) + champs annexes sur le draft.
      answer.data.answers = cleanedAnswers as Record<string, Record<string, unknown>>;
      // Épingler le formulaire SOUS LEQUEL on enregistre : celui qui a été rendu.
      //
      // Sur une réponse EXISTANTE, `Answer._resolveFormId` retombe sinon sur
      // `serverData.form`, c'est-à-dire le formulaire de DÉPÔT. Tant que les
      // deux coïncident personne ne le voit ; dès qu'un appel à communs édite un
      // commun déposé sur un autre appel, le rendu et le schéma Zod viennent
      // d'un formulaire et les règles serveur (`canAdminAnswer`, strip des
      // champs restreints, vocabulaire de tags) de l'autre.
      //
      // ⚠️ `draftData` et NON `data` : `data` est un Proxy qui n'accepte que les
      // champs du schéma `SAVE_COFORM_ANSWER` (`addedOptions`, `answerId`,
      // `answers`, `formId`, `links`) et LÈVE sur tout le reste —
      // `[DraftProxy] Le champ "form" n'est pas autorisé.`. `form` n'y est pas.
      // `save()` construit son payload depuis `_draftData` brut, non proxifié,
      // que `_resolveFormId` lit EN PRIORITÉ : l'écriture y passe et produit
      // l'effet voulu.
      //
      // Sans effet partout où le formulaire rendu est déjà celui de la réponse,
      // et ne réécrit pas `answer.form` en base : `SaveAnswerAction` ne pose
      // `form` qu'à la création, jamais dans le `$set` d'update.
      //
      // ⚠️ LIMITE CONNUE ET ACCEPTÉE (arbitrage du 26/08) : cet épinglage ne vaut
      // que pour `save()`. `uploadFile` et `deleteFile` appellent
      // `_resolveFormId({})` avec un payload VIDE et retombent donc toujours sur
      // le formulaire de DÉPÔT.
      //
      // Portée réelle : seulement quand on AJOUTE un fichier (`processUploads`
      // n'appelle l'endpoint que pour les data: URIs) à un commun déposé sur un
      // autre appel, et seulement si l'éditeur n'est ni l'auteur ni admin de
      // l'appel d'origine. Dans ce cas l'upload est refusé et la mutation
      // s'arrête avant `save()` : la saisie en cours est perdue.
      //
      // Pas de modification SDK prévue : on vit avec.
      answer.draftData.form = formId;
      if (addedOptions && Object.keys(addedOptions).length > 0) {
        answer.data.addedOptions = addedOptions;
      }
      if (links && Object.keys(links).length > 0) {
        answer.data.links = links;
      }

      // 4. Save (POST SAVE_COFORM_ANSWER + refresh automatique avec
      //    canEdit/editDeniedReason calculés backend).
      await answer.save();

      // 5. Réconciliation APRÈS le save (un save échoué ne supprime rien) :
      //    suppression batchée en un appel. removed = UNION du diff (load − soumis,
      //    pour les fichiers en map) et de l'explicite (`deletedDocIds`, seule
      //    source pour les legacy non-en-map invisibles au snapshot). Best-effort.
      const filesAfterSubmit = collectUploaderDocIds(cleanedAnswers);
      const removedByDiff = [...filesAtLoad].filter(
        (docId) => !filesAfterSubmit.has(docId),
      );
      const removedDocIds = [...new Set([...removedByDiff, ...explicitlyDeleted])];
      await answer.deleteFiles(removedDocIds);

      return answer.serverData;
    },
    onSuccess: (data) => {
      // Invalider les caches : formulaire + réponses.
      // Le formulaire est invalidé pour rafraîchir l'access, MAIS aussi parce que
      // le backend l'a peut-être enrichi pendant le save : options ajoutées d'un
      // `multiCheckboxPlus` (`Coform::addOptionsToMultiCheckboxPlus`) et tags
      // versés au vocabulaire partagé (`Coform::addTagsToVocabulary`). Sans cette
      // invalidation, un tag que l'on vient de créer ne serait pas proposé à la
      // saisie suivante dans le même onglet.
      // `FORM_PREFIX` et non `FORM` : la clé est scopée par utilisateur, il
      // faut invalider toutes ses variantes, pas la seule entrée « anon ».
      queryClient.invalidateQueries({ queryKey: COFORM_QUERY_KEYS.FORM_PREFIX(formId) });
      queryClient.invalidateQueries({ queryKey: COFORM_QUERY_KEYS.FORM_ANSWERS(formId) });
      // La RÉPONSE elle-même, que la JSDoc de `FORM_ANSWER` désignait déjà cette
      // mutation comme invalidant — sans que ce soit vrai.
      //
      // Le trou n'était pas théorique : `CoFormAnswerPage` lit la réponse avec
      // un `staleTime` de 2 min et la réinjecte en `defaultValues`. Après un
      // save, « Modifier ma réponse » remontait le formulaire sur le snapshot
      // PRÉ-SAVE, et une seconde soumission écrasait la première édition — le
      // save coform écrivant le payload complet.
      //
      // `_PREFIX` : la clé porte un segment `userId`, il faut invalider toutes
      // les variantes et pas la seule entrée « anon ».
      if (answerId) {
        queryClient.invalidateQueries({
          queryKey: COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(formId, answerId),
        });
      }
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}
