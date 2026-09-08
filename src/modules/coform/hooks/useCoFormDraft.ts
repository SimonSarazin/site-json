import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AllStepsData, AddedOptionsMap } from "../types";

const KEY_PREFIX = "coform-draft:v1";
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
const WRITE_DEBOUNCE_MS = 500;

export interface CoFormDraft {
  version: 1;
  data: AllStepsData;
  currentStepIndex: number;
  completedSteps: string[];
  addedOptions: Record<string, AddedOptionsMap>;
  timestamp: number;
  baseUpdatedAt: number | null;
}

type SaveDraftPayload = Omit<CoFormDraft, "version" | "timestamp" | "baseUpdatedAt"> & {
  /**
   * Lignée de péremption à CONSERVER, quand on réécrit un brouillon existant
   * (reprise) plutôt que d'en produire un depuis la saisie courante.
   *
   * Sans elle, une reprise faite avant que `baseUpdatedAt` ne soit chargé —
   * l'answer arrive en parallèle du formulaire — réécrirait le brouillon avec
   * `null`. Or `computeDraftState` n'ose déclarer un brouillon obsolète que si
   * `draft.baseUpdatedAt != null` : ce brouillon-là ne pourrait donc PLUS JAMAIS
   * être détecté périmé, et se restaurerait un jour par-dessus une réponse
   * modifiée entre-temps. Omise ⇒ valeur courante du hook, comme avant.
   */
  baseUpdatedAt?: number | null;
};

export interface UseCoFormDraftOptions {
  formId: string | null | undefined;
  userId: string | null | undefined;
  answerId?: string;
  /**
   * Périmètre RENDU, quand ce n'est pas le formulaire entier.
   *
   * Un même `(formId, userId, answerId)` peut être rendu de deux façons : le
   * parcours complet, ou UNE étape extraite (`stepKey`) — c'est le cas du bouton
   * « Déposer un commun », qui ouvre la seule étape de dépôt. Sans distinction,
   * les deux partageraient la même entrée : un brouillon écrit sur une étape
   * seule, restauré dans le parcours complet, remplacerait `stepsData` par les
   * données de cette unique étape et placerait le wizard sur un index calculé
   * pour un formulaire à une étape — l'utilisateur y lirait une perte de saisie.
   *
   * Omis ou vide ⇒ le formulaire entier, et la clé reste EXACTEMENT celle
   * d'avant : les brouillons déjà en place continuent d'être retrouvés.
   */
  scope?: string | null;
  /**
   * Élément auquel la réponse est rattachée (lieu, projet…), quand il y en a un.
   *
   * Une même « nouvelle réponse » (`answerId` absent) d'un même formulaire peut
   * être saisie depuis plusieurs éléments : « Ajouter une salle » sur le profil
   * du tiers-lieu A, puis sur celui de B. Sans ce segment, les deux partagent
   * la clé `…:new` — le brouillon écrit pour A est proposé sur B, et comme la
   * restauration l'emporte sur le champ finder verrouillé (`lockedFields`), la
   * salle créée depuis B se rattache à A, via un champ que l'utilisateur ne
   * peut pas corriger.
   *
   * Omis ou vide ⇒ pas de segment, et la clé reste EXACTEMENT celle d'avant
   * (même règle que `scope`). `elementType` ne fait que qualifier l'id
   * (`<type>/<id>`) : seul `elementId` décide de la présence du segment.
   */
  elementId?: string | null;
  elementType?: string | null;
  baseUpdatedAt?: number | null;
  disabled?: boolean;
}

export interface UseCoFormDraftReturn {
  restorableDraft: CoFormDraft | null;
  staleDraftInfo: { timestamp: number } | null;
  saveDraft: (payload: SaveDraftPayload) => void;
  discardDraft: () => void;
  purgeDraft: () => void;
  acknowledgeStale: () => void;
  /**
   * « Ce brouillon vient d'être repris » — masque la bannière SANS rien effacer.
   *
   * À utiliser à la restauration, jamais `discardDraft` : reprendre un brouillon
   * n'est pas le jeter. Le supprimer laissait l'utilisateur sans filet — s'il
   * refermait juste après avoir repris, sa saisie était définitivement perdue.
   */
  acknowledgeRestored: () => void;
}

interface DraftSnapshot {
  restorable: CoFormDraft | null;
  stale: { timestamp: number } | null;
}
const EMPTY_SNAPSHOT: DraftSnapshot = { restorable: null, stale: null };

type DraftKeyParts = Pick<
  UseCoFormDraftOptions,
  "answerId" | "scope" | "elementId" | "elementType"
> & { formId: string; userId: string };

/**
 * `coform-draft:v1:<form>:<user>:<answer|new>[:<elementType>/<elementId>][:<scope>]`
 *
 * Les deux segments optionnels ne sont ajoutés QUE s'ils ont une valeur : sans
 * ça, on changerait la clé du formulaire entier et on rendrait orphelins les
 * brouillons existants. L'élément précède le périmètre : il dit CE QU'ON
 * répond (comme `answerId`), le périmètre dit COMMENT c'est rendu.
 */
function buildKey({ formId, userId, answerId, scope, elementId, elementType }: DraftKeyParts): string {
  let key = `${KEY_PREFIX}:${formId}:${userId}:${answerId ?? "new"}`;
  const element = (elementId ?? "").trim();
  if (element !== "") {
    const type = (elementType ?? "").trim();
    key += `:${type === "" ? element : `${type}/${element}`}`;
  }
  const p = (scope ?? "").trim();
  if (p !== "") key += `:${p}`;
  return key;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readDraft(key: string): CoFormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    // Validation structurelle : un draft corrompu (ou injecté par une extension) ne doit
    // pas planter le restore. On exige la forme attendue, sinon on supprime et ignore.
    if (
      !isPlainObject(parsed) ||
      parsed.version !== 1 ||
      typeof parsed.timestamp !== "number" ||
      !isPlainObject(parsed.data) ||
      typeof parsed.currentStepIndex !== "number" ||
      !Array.isArray(parsed.completedSteps) ||
      !(parsed.completedSteps as unknown[]).every((s) => typeof s === "string") ||
      !isPlainObject(parsed.addedOptions) ||
      (parsed.baseUpdatedAt !== null && typeof parsed.baseUpdatedAt !== "number")
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    const draft = parsed as unknown as CoFormDraft;
    if (Date.now() - draft.timestamp > DRAFT_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    try { window.localStorage.removeItem(key); } catch { /* noop */ }
    return null;
  }
}

function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch { /* noop */ }
}

/**
 * Lit le draft associé à `key` et détermine s'il doit être proposé à la restauration,
 * ou s'il est obsolète (serveur plus récent). Pur : ne dépend que de ses arguments.
 * Effet de bord : supprime l'entrée localStorage si obsolète.
 */
function computeDraftState(
  k: string | null,
  srvUpdatedAt: number | null | undefined
): DraftSnapshot {
  if (!k) return EMPTY_SNAPSHOT;
  const draft = readDraft(k);
  if (!draft) return EMPTY_SNAPSHOT;
  const serverNewer =
    srvUpdatedAt != null &&
    draft.baseUpdatedAt != null &&
    srvUpdatedAt > draft.baseUpdatedAt;
  if (serverNewer) {
    removeKey(k);
    return { restorable: null, stale: { timestamp: draft.timestamp } };
  }
  return { restorable: draft, stale: null };
}

// ─── Bus d'événements pour useSyncExternalStore ────────────────────────────────
// localStorage n'émet pas d'événement sur l'onglet courant lors d'un setItem local.
// On maintient donc un bus en mémoire pour notifier nos abonnés, en plus du
// natif `storage` event qui couvre les autres onglets.
const draftListeners = new Set<() => void>();
function subscribeDrafts(callback: () => void): () => void {
  draftListeners.add(callback);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", callback);
  }
  return () => {
    draftListeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", callback);
    }
  };
}
function notifyDraftsChanged(): void {
  draftListeners.forEach((l) => l());
}

// Cache par clé : `getSnapshot` doit retourner la MÊME référence tant que le
// contenu n'a pas changé, sinon React considère que le state a changé et
// re-render en boucle.
const snapshotCache = new Map<string, { raw: string | null; srv: number | null; snap: DraftSnapshot }>();
function getSnapshotFor(key: string | null, srv: number | null): DraftSnapshot {
  if (!key || typeof window === "undefined") return EMPTY_SNAPSHOT;
  const raw = window.localStorage.getItem(key);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw && cached.srv === srv) {
    return cached.snap;
  }
  const snap = computeDraftState(key, srv);
  snapshotCache.set(key, { raw, srv, snap });
  return snap;
}

/**
 * Hook de persistance du brouillon d'un CoForm dans localStorage.
 * - Désactivé si utilisateur anonyme, formId manquant, ou `disabled=true`.
 * - Écritures debouncées (500ms) pour limiter l'impact synchrone.
 * - Détecte les brouillons obsolètes (server.updatedAt > draft.baseUpdatedAt) et les supprime
 *   tout en exposant `staleDraftInfo` pour informer l'utilisateur.
 * - SSR-safe via `useSyncExternalStore` : `getServerSnapshot` retourne `EMPTY_SNAPSHOT` pour
 *   que l'hydratation ne diffère pas entre serveur et client.
 */
export function useCoFormDraft({
  formId,
  userId,
  answerId,
  scope,
  elementId,
  elementType,
  baseUpdatedAt,
  disabled,
}: UseCoFormDraftOptions): UseCoFormDraftReturn {
  const isActive = !disabled && !!formId && !!userId;
  const key = isActive
    ? buildKey({ formId: formId!, userId: userId!, answerId, scope, elementId, elementType })
    : null;
  const normalizedBaseUpdatedAt = baseUpdatedAt ?? null;

  // Timestamp de début de session (= montage du hook). Utilisé pour FILTRER les
  // brouillons écrits par l'utilisateur lui-même pendant cette session : on ne
  // veut pas que la bannière "Brouillon trouvé" réapparaisse à chaque save.
  // Seuls les brouillons antérieurs (timestamp < sessionStart) sont éligibles.
  // Lazy init via useState pour que `Date.now()` ne soit appelé qu'une fois.
  const [sessionStart] = useState(() => Date.now());

  // `getSnapshotFor` cache déjà par (key, contenu localStorage) : sa sortie est
  // une référence stable. Notre filtre ne fait que retourner soit ce ref, soit
  // EMPTY_SNAPSHOT (constante) — pas d'allocation, références stables, pas de
  // re-render en boucle.
  const getSnapshot = useCallback(() => {
    const raw = getSnapshotFor(key, normalizedBaseUpdatedAt);
    if (raw.restorable && raw.restorable.timestamp >= sessionStart) {
      // Brouillon écrit pendant CETTE session → masqué côté UI (évite la boucle).
      return EMPTY_SNAPSHOT;
    }
    return raw;
  }, [key, normalizedBaseUpdatedAt, sessionStart]);
  const snapshot = useSyncExternalStore(subscribeDrafts, getSnapshot, () => EMPTY_SNAPSHOT);

  // `acknowledgeStale` ferme seulement la bannière (info UI) sans modifier localStorage.
  // On le garde en state local ; combiné au snapshot pour produire la valeur finale.
  const [staleDismissed, setStaleDismissed] = useState(false);
  const staleDraftInfo = staleDismissed ? null : snapshot.stale;

  // Idem pour la bannière « Brouillon trouvé » une fois le brouillon REPRIS :
  // on la masque, mais l'entrée reste en place tant que la saisie n'a pas été
  // soumise. Le filtre de session ne suffit pas ici — il ne joue qu'une fois le
  // brouillon RÉÉCRIT (nouveau timestamp), donc au plus tôt après le debounce.
  const [restoredDismissed, setRestoredDismissed] = useState(false);

  // Les deux bannières sont masquées POUR UN MONTAGE ET UNE CLÉ donnés. Quand la
  // clé change sans démontage — `answerId`/`scope`/`elementId` qui arrivent en
  // async, passage à une autre réponse — le masquage d'avant ne veut plus rien
  // dire et cacherait une bannière légitime.
  //
  // Ajusté PENDANT LE RENDU et non dans un effet : c'est le patron React pour
  // « remettre un état à zéro quand une prop change ». Un effet provoquerait un
  // rendu en cascade (la bannière s'afficherait une frame avant d'être masquée)
  // et `react-hooks/set-state-in-effect` le refuse à juste titre.
  const [cleObservee, setCleObservee] = useState(key);
  if (key !== cleObservee) {
    setCleObservee(key);
    setStaleDismissed(false);
    setRestoredDismissed(false);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef<string | null>(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  /** Dernier payload reçu, en attente d'écriture. `null` = rien en attente. */
  const pendingRef = useRef<SaveDraftPayload | null>(null);
  /** Lu au moment de l'écriture (y compris différée) pour ne pas figer une valeur périmée. */
  const baseUpdatedAtRef = useRef<number | null | undefined>(baseUpdatedAt);
  useEffect(() => {
    baseUpdatedAtRef.current = baseUpdatedAt;
  }, [baseUpdatedAt]);

  /** Écrit immédiatement ce qui est en attente, et annule le minuteur. */
  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const payload = pendingRef.current;
    pendingRef.current = null;
    const currentKey = keyRef.current;
    if (!payload || !currentKey || typeof window === "undefined") return;
    const draft: CoFormDraft = {
      version: 1,
      ...payload,
      timestamp: Date.now(),
      baseUpdatedAt:
        payload.baseUpdatedAt !== undefined
          ? payload.baseUpdatedAt
          : (baseUpdatedAtRef.current ?? null),
    };
    try {
      window.localStorage.setItem(currentKey, JSON.stringify(draft));
      notifyDraftsChanged();
    } catch (err) {
      console.warn("[useCoFormDraft] saveDraft failed", err);
    }
  }, []);

  // Flush AU DÉMONTAGE — et non simple annulation.
  //
  // L'écriture est debouncée à 500 ms : sans flush, tout ce qui a été tapé dans
  // la dernière demi-seconde est perdu au démontage. Sur une page c'est rare
  // (la navigation est précédée du warning `useUnsavedChangesWarning`) ; dans
  // une MODALE, la fermeture démonte immédiatement — c'est le cas nominal.
  // C'est ce qui rendait le brouillon inexploitable en modale, et le motif
  // apparent de sa désactivation là-bas.
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  // Même raison au niveau de l'onglet : fermeture, rafraîchissement ou passage
  // en arrière-plan (le seul événement fiable sur mobile, où `beforeunload` ne
  // se déclenche pas toujours).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const surSortie = () => flush();
    const surVisibilite = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", surSortie);
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      window.removeEventListener("pagehide", surSortie);
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [flush]);

  const saveDraft = useCallback(
    (payload: SaveDraftPayload) => {
      pendingRef.current = payload;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flush, WRITE_DEBOUNCE_MS);
    },
    [flush]
  );

  const discardDraft = useCallback(() => {
    const currentKey = keyRef.current;
    if (currentKey) removeKey(currentKey);
    // Annule le save debouncé ET jette le payload en attente : sans cela, le
    // flush au démontage réécrirait juste après le discard ce qu'on vient de
    // supprimer.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingRef.current = null;
    notifyDraftsChanged();
  }, []);

  const purgeDraft = useCallback(() => {
    const currentKey = keyRef.current;
    if (currentKey) removeKey(currentKey);
    // Purge aussi la clé "new" si on vient de soumettre une création avec answerId
    // existant : l'éventuel brouillon "new" laissé en route est obsolète.
    //
    // ⚠️ DU MÊME PÉRIMÈTRE ET DU MÊME ÉLÉMENT, pas tous. Sans `scope`, soumettre
    // depuis une étape extraite effaçait le brouillon de création du PARCOURS
    // COMPLET — la collision cross-périmètre que ce segment vient précisément
    // d'interdire — et laissait au contraire traîner le sien, d'où une bannière
    // « Brouillon trouvé » pointant sur un commun déjà déposé. Même raisonnement
    // pour l'élément : la clé « new » à purger est celle que CE montage aurait
    // écrite, donc reconstruite avec exactement les mêmes segments.
    if (formId && userId && answerId && answerId !== "new") {
      removeKey(buildKey({ formId, userId, answerId: undefined, scope, elementId, elementType }));
    }
    // Comme `discardDraft` : jeter AUSSI le payload en attente, sinon le flush
    // au démontage réécrirait après la soumission le brouillon qu'on purge.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingRef.current = null;
    setStaleDismissed(false);
    setRestoredDismissed(false);
    notifyDraftsChanged();
  }, [formId, userId, answerId, scope, elementId, elementType]);

  const acknowledgeStale = useCallback(() => {
    setStaleDismissed(true);
  }, []);

  const acknowledgeRestored = useCallback(() => {
    setRestoredDismissed(true);
  }, []);

  return {
    restorableDraft: restoredDismissed ? null : snapshot.restorable,
    staleDraftInfo,
    saveDraft,
    discardDraft,
    purgeDraft,
    acknowledgeStale,
    acknowledgeRestored,
  };
}
