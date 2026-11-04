/**
 * Tests de la logique pure du formulaire de carte.
 *
 * Environnement `node` (le defaut du projet) : rien ici ne monte React, ce qui
 * garde la suite rapide. Les regles couvertes sont celles du blueprint §3/§5 et
 * du cahier des charges (RG-19 assignation, RG-30 cloture).
 */
import { describe, expect, it } from 'vitest';
import { fromDateInputValue, SECONDS_PER_DAY, toDateInputValue } from '@/modules/kanban/lib/dates';
import type { Capabilities, Card } from '@/modules/kanban/types';
import {
  ACTION_CARD_LIMITS,
  buildCardPatch,
  can,
  cardDraftFromCard,
  cardFieldLimits,
  cardFieldOfServerField,
  cardFormErrorValues,
  checklistProgress,
  firstInvalidCardField,
  isCardFormDirty,
  KANBAN_CARD_LIMITS,
  nextChecklistItemId,
  progressPercent,
  validateCardForm,
  type CardFormContext,
  type CardFormDraft,
} from './cardForm';

const NOW = 1_758_067_200; // 17/09/2025 00:00 UTC
const DAY = SECONDS_PER_DAY;

function makeCard(overrides: Partial<Card> = {}): Card {
  const base: Card = {
    _id: 'card1',
    boardId: 'board1',
    columnId: 'col1',
    rank: 1000,
    title: 'Commander le plan de travail',
    description: 'Inox, 3 m',
    priority: 'high',
    assignees: ['user1'],
    labelIds: ['lbl_logistique'],
    checklist: [
      { id: 'ck_1', label: 'Devis recu', done: true },
      { id: 'ck_2', label: 'Bon de commande', done: false },
    ],
    checklistDone: 1,
    checklistTotal: 2,
    status: 'in_research',
    links: [{ id: 'lk_1', url: 'https://exemple.org/devis', label: 'exemple.org' }],
    linkCount: 1,
    commentCount: 2,
    dueDate: NOW + 3 * DAY,
    completedAt: null,
    creator: 'user1',
    created: NOW,
    updated: NOW,
  };
  return { ...base, ...overrides };
}

const CONTEXT: CardFormContext = {
  memberIds: ['user1', 'user2'],
  labelIds: ['lbl_logistique', 'lbl_budget'],
};


function draft(overrides: Partial<CardFormDraft> = {}): CardFormDraft {
  return { ...cardDraftFromCard(makeCard()), ...overrides };
}

/** Valide le passage d'un brouillon INITIAL a sa version editee. */
function validate(edited: Partial<CardFormDraft>, context: CardFormContext = CONTEXT, initial = draft()) {
  return validateCardForm(initial, { ...initial, ...edited }, context);
}

describe('validateCardForm', () => {
  it('accepte un brouillon conforme, et un brouillon inchange', () => {
    expect(validate({ title: 'Autre titre' })).toEqual({});
    expect(validate({})).toEqual({});
  });

  it('exige un titre non vide (espaces compris)', () => {
    expect(validate({ title: '   ' }).title).toBe('required');
  });

  it('refuse un titre plus long que la limite serveur', () => {
    expect(validate({ title: 'x'.repeat(KANBAN_CARD_LIMITS.title + 1) }).title).toBe('tooLong');
  });

  it('board kanban : des assignes modifies doivent TOUS etre membres (RG-19, `notBoardMembers`)', () => {
    expect(validate({ assignees: ['inconnu'] }).assignees).toBe('notMember');
    // Un orphelin RESTANT bloque aussi : le serveur controle la liste entiere.
    const initial = draft({ assignees: ['parti'] });
    expect(validate({ assignees: ['parti', 'user2'] }, CONTEXT, initial).assignees).toBe('notMember');
  });

  it('refuse une etiquette absente du tableau', () => {
    expect(validate({ labelIds: ['lbl_fantome'] }).labelIds).toBe('unknownLabel');
  });

  it('board kanban : TOUS les points d une checklist envoyee sont controles', () => {
    // Le serveur remplace la liste et jetterait en silence un point vide.
    const initial = draft({ checklist: [{ id: 'ck_1', label: ' ', done: false }, { id: 'ck_2', label: 'B', done: false }] });
    const checklist = [{ id: 'ck_1', label: ' ', done: false }, { id: 'ck_2', label: 'B', done: true }];
    expect(validate({ checklist }, CONTEXT, initial).checklist).toBe('emptyItem');
  });

  it('un champ NON envoye n est jamais revalide (etat herite intact)', () => {
    // Titre vide et assigne inconnu deja la : changer la priorite passe.
    const initial = draft({ title: '', assignees: ['inconnu'] });
    expect(validate({ priority: 'urgent' }, CONTEXT, initial)).toEqual({});
  });
});

describe('buildCardPatch', () => {
  it('ne renvoie rien quand rien n a change', () => {
    const initial = draft();
    expect(buildCardPatch(initial, { ...initial })).toEqual({});
    expect(isCardFormDirty(initial, { ...initial })).toBe(false);
  });

  it('ne renvoie que les champs modifies', () => {
    const initial = draft();
    const patch = buildCardPatch(initial, { ...initial, title: 'Autre titre', priority: 'urgent' });
    expect(patch).toEqual({ title: 'Autre titre', priority: 'urgent' });
  });

  it('ignore un simple reordonnancement des assignes', () => {
    const initial = draft({ assignees: ['user1', 'user2'] });
    const patch = buildCardPatch(initial, { ...initial, assignees: ['user2', 'user1'] });
    expect(patch.assignees).toBeUndefined();
  });

  it('detecte le decochage d un point de checklist', () => {
    const initial = draft();
    const checklist = initial.checklist.map((item) => ({ ...item, done: false }));
    expect(buildCardPatch(initial, { ...initial, checklist }).checklist).toHaveLength(2);
  });

  it('nettoie les espaces du titre et des points de checklist RETOUCHES', () => {
    const initial = draft();
    const patch = buildCardPatch(initial, {
      ...initial,
      title: '  Titre nettoye  ',
      checklist: [{ id: 'ck_1', label: '  Devis signe  ', done: true }],
    });
    expect(patch.title).toBe('Titre nettoye');
    expect(patch.checklist?.[0].label).toBe('Devis signe');
  });

  it('un libelle que personne n a retouche part TEL QU AFFICHE (la fusion compare base et cible)', () => {
    const initial = draft({ checklist: [{ id: 'ck_1', label: 'Herite ', done: false }] });
    // Seule la coche change ; le libelle avec son espace final ne doit pas
    // passer pour un renommage aux yeux du serveur.
    const patch = buildCardPatch(initial, { ...initial, checklist: [{ id: 'ck_1', label: 'Herite ', done: true }] });
    expect(patch.checklist).toEqual([{ id: 'ck_1', label: 'Herite ', done: true }]);
    // Ajouter un espace en fin de libelle n'est pas une modification.
    expect(isCardFormDirty(initial, { ...initial, checklist: [{ id: 'ck_1', label: 'Herite  ', done: false }] })).toBe(false);
  });

  it('board kanban : les listes partent SANS base (remplacement, aucun autre ecrivain)', () => {
    const initial = draft();
    const patch = buildCardPatch(initial, {
      ...initial,
      assignees: ['user2'],
      checklist: [{ id: 'ck_1', label: 'Devis recu', done: false }],
    });
    expect(patch.assigneesBase).toBeUndefined();
    expect(patch.checklistBase).toBeUndefined();
    expect(patch.tagsBase).toBeUndefined();
  });

  it('accepte le retrait complet de l echeance', () => {
    const initial = draft();
    expect(buildCardPatch(initial, { ...initial, dueDate: null })).toEqual({ dueDate: null });
  });
});

describe('checklist', () => {
  it('calcule l avancement', () => {
    expect(checklistProgress(draft().checklist)).toEqual({ done: 1, total: 2, percent: 50 });
  });

  it('ne divise pas par zero', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(progressPercent(3, 0)).toBe(0);
  });

  it('numerote le point suivant sans aleatoire', () => {
    expect(nextChecklistItemId([])).toBe('ck_1');
    expect(nextChecklistItemId(draft().checklist)).toBe('ck_3');
    expect(
      nextChecklistItemId([{ id: 'importe-du-serveur', label: 'x', done: false }]),
    ).toBe('ck_1');
  });
});

describe('capacites', () => {
  const viewer: Capabilities = {
    role: 'viewer',
    canViewBoard: true,
    canEditCards: false,
    canManageColumns: false,
    canManageMembers: false,
    canEditBoard: false,
    canArchiveBoard: false,
    canDeleteBoard: false,
    canAttachBoard: false,
    canDetachBoard: false,
    canLeaveBoard: true,
    isExplicitOwner: false,
    archived: false,
    canManageRoles: false,
    canReorderColumns: false,
    canRenameColumns: false,
    canArchiveCards: false,
    canManageMilestones: false,
    canEditCredits: false,
    source: 'kanban',
  };

  it('refuse tout tant que le serveur n a rien dit', () => {
    expect(can(null, 'canEditCards')).toBe(false);
    expect(can(undefined, 'canViewBoard')).toBe(false);
  });

  it('suit exactement ce que le serveur declare', () => {
    expect(can(viewer, 'canViewBoard')).toBe(true);
    expect(can(viewer, 'canEditCards')).toBe(false);
    expect(can({ ...viewer, role: 'editor', canEditCards: true }, 'canEditCards')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Les deux sources (§11)                                             */
/* ------------------------------------------------------------------ */

describe('brouillon unique : statut et liens (board kanban)', () => {
  it('le statut et les liens font partie du brouillon et du diff', () => {
    const initial = draft();
    const links = [...initial.links, { id: 'lk_2', url: 'https://exemple.org/b', label: 'b' }];
    expect(buildCardPatch(initial, { ...initial, status: 'complete', links })).toEqual({ status: 'complete', links });
  });

  it('vider les liens envoie un tableau vide (qui EFFACE cote serveur)', () => {
    const initial = draft();
    expect(buildCardPatch(initial, { ...initial, links: [] })).toEqual({ links: [] });
  });

  it('les champs Communecter ne partent jamais d un board kanban', () => {
    const initial = draft();
    expect(buildCardPatch(initial, { ...initial, tags: ['web'], credits: 4, milestoneId: 'm' })).toEqual({});
  });
});

describe('board-lien Communecter', () => {
  const LINK_CONTEXT: CardFormContext = {
    memberIds: ['user1', 'user2'],
    labelIds: [],
    source: 'communecter',
    milestoneIds: ['m-open'],
  };

  function linkDraft(overrides: Partial<CardFormDraft> = {}): CardFormDraft {
    return {
      ...cardDraftFromCard(
        makeCard({
          priority: null,
          labelIds: ['tag:web'],
          tags: ['web'],
          links: [],
          linkCount: 0,
          startDate: NOW,
          milestone: { milestoneId: 'm-open', name: 'V1.2', status: 'open' },
          credits: 1,
          timeSpent: 0,
        }),
      ),
      ...overrides,
    };
  }

  it('reprend les champs du §11.4 depuis la carte', () => {
    expect(linkDraft()).toMatchObject({
      priority: null,
      tags: ['web'],
      startDate: NOW,
      milestoneId: 'm-open',
      credits: 1,
      timeSpent: 0,
    });
    // Champs absents (board kanban) : valeurs neutres, jamais `undefined`.
    expect(cardDraftFromCard(makeCard())).toMatchObject({ tags: [], startDate: null, milestoneId: null, credits: null });
  });

  it('diff : tags (comme un ensemble), debut, jalon, montant, temps — jamais statut ni liens', () => {
    const initial = linkDraft();
    expect(buildCardPatch(initial, { ...initial, tags: ['web'] }, 'communecter')).toEqual({});
    expect(
      buildCardPatch(
        initial,
        { ...initial, tags: ['web', 'UX'], milestoneId: null, credits: 3, timeSpent: 90, status: 'complete', priority: 'high' },
        'communecter',
      ),
    ).toEqual({
      tags: ['web', 'UX'],
      tagsBase: ['web'],
      milestoneId: null,
      credits: 3,
      timeSpent: 90,
      priority: 'high',
    });
  });

  it('PROTOCOLE card/update : chaque liste modifiee part avec sa base, vue a l ouverture', () => {
    const initial = linkDraft({ assignees: ['user1'] });
    const patch = buildCardPatch(
      initial,
      {
        ...initial,
        title: 'Renomme',
        assignees: ['user1', 'user2'],
        checklist: [
          { id: 'ck_1', label: 'Devis recu', done: false },
          { id: 'ck_3', label: 'Nouvelle', done: false },
        ],
      },
      'communecter',
    );
    expect(patch).toEqual({
      title: 'Renomme',
      assignees: ['user1', 'user2'],
      assigneesBase: ['user1'],
      checklist: [
        { id: 'ck_1', label: 'Devis recu', done: false },
        { id: 'ck_3', label: 'Nouvelle', done: false },
      ],
      checklistBase: [
        { id: 'ck_1', label: 'Devis recu', done: true },
        { id: 'ck_2', label: 'Bon de commande', done: false },
      ],
    });
    // Une liste inchangee ne part pas, et sa base non plus.
    const titleOnly = buildCardPatch(initial, { ...initial, title: 'Seul' }, 'communecter');
    expect(titleOnly).toEqual({ title: 'Seul' });
  });

  it('« aucune » priorite part en null', () => {
    const initial = linkDraft({ priority: 'low' });
    expect(buildCardPatch(initial, { ...initial, priority: null }, 'communecter')).toEqual({ priority: null });
    expect(isCardFormDirty(initial, initial, 'communecter')).toBe(false);
  });

  /** Valide une edition d'action (`initial` = la carte a l'ouverture). */
  function validateLink(edited: Partial<CardFormDraft>, initial = linkDraft()) {
    return validateCardForm(initial, { ...initial, ...edited }, LINK_CONTEXT);
  }

  it('valide les tags AJOUTES avec les codes du formulaire', () => {
    expect(validateLink({ tags: ['web', 'next'] }).tags).toBe('tagReserved');
    expect(validateLink({ tags: ['web', 'UX', 'UX'] }).tags).toBe('tagDuplicate');
    expect(validateLink({ tags: ['web', 'UX'] })).toEqual({});
  });

  it('ignore les etiquettes du tableau (ce sont les tags) sur un board-lien', () => {
    expect(validateLink({ labelIds: ['tag:inconnu'] }).labelIds).toBeUndefined();
  });

  it('echeance avant le debut, jalon inconnu, montant et temps invalides — quand on les TOUCHE', () => {
    const errors = validateLink({ dueDate: NOW - DAY, milestoneId: 'm-disparu', credits: -1, timeSpent: 1.5 });
    expect(errors).toEqual({
      dueDate: 'dateRange',
      milestoneId: 'unknownMilestone',
      credits: 'invalidAmount',
      timeSpent: 'invalidDuration',
    });
  });

  it('le debut seul, deplace apres l echeance existante : erreur sur le DEBUT', () => {
    const initial = linkDraft({ startDate: NOW, dueDate: NOW + DAY });
    expect(validateLink({ startDate: NOW + 3 * DAY }, initial)).toEqual({ startDate: 'startAfterDue' });
  });

  it('montant et temps passe VIDES sont refuses : le serveur ne les efface pas (422)', () => {
    expect(validateLink({ credits: null, timeSpent: null })).toMatchObject({
      credits: 'required',
      timeSpent: 'required',
    });
    // Plafond du serveur (`CardBranch::MAX_CREDITS` / `MAX_TIME_SPENT`).
    expect(validateLink({ credits: 100_001, timeSpent: 100_001 })).toMatchObject({
      credits: 'invalidAmount',
      timeSpent: 'invalidDuration',
    });
  });

  it('bornes des ACTIONS : titre de 500, 1000 points de 500 caracteres (§11.9)', () => {
    expect(cardFieldLimits('communecter')).toEqual(ACTION_CARD_LIMITS);
    expect(cardFieldLimits('kanban')).toEqual(KANBAN_CARD_LIMITS);
    // 436 caracteres : un nom d'action reel, que la borne kanban refuserait.
    expect(validateLink({ title: 'x'.repeat(436) }).title).toBeUndefined();
    expect(validate({ title: 'x'.repeat(436) }).title).toBe('tooLong');
    expect(validateLink({ title: 'x'.repeat(501) }).title).toBe('tooLong');

    const item = (index: number, label = 'point') => ({ id: `ck_${index}`, label, done: false });
    const longLabel = [item(1, 'y'.repeat(441))];
    expect(validateLink({ checklist: longLabel }).checklist).toBeUndefined();
    expect(validate({ checklist: longLabel }).checklist).toBe('tooLong');

    const many = Array.from({ length: 559 }, (_, index) => item(index));
    expect(validateLink({ checklist: many }).checklist).toBeUndefined();
    expect(validate({ checklist: many }).checklist).toBe('tooManyItems');
    const tooMany = Array.from({ length: 1001 }, (_, index) => item(index));
    expect(validateLink({ checklist: tooMany }).checklist).toBe('tooManyItems');
  });
});

/*
 * Actions HERITEES de Kanban gestion (constats #5, #10, #22) : des etats que le
 * module PHP accepte de garder, et qui bloquaient TOUT enregistrement de la
 * fiche parce que la validation portait sur le brouillon entier.
 */
describe('board-lien : une action heritee s enregistre si l on ne touche pas l etat herite', () => {
  const LINK_CONTEXT: CardFormContext = {
    memberIds: ['user1', 'user2'],
    labelIds: [],
    source: 'communecter',
    milestoneIds: ['m-open'],
  };
  const legacy = (overrides: Partial<Card>) =>
    cardDraftFromCard(
      makeCard({ priority: null, tags: [], links: [], linkCount: 0, credits: 1, timeSpent: 0, ...overrides }),
    );
  const validateLegacy = (initial: CardFormDraft, edited: Partial<CardFormDraft>) =>
    validateCardForm(initial, { ...initial, ...edited }, LINK_CONTEXT);

  it('assigne qui a quitte le projet + titre modifie : aucune erreur', () => {
    const initial = legacy({ assignees: ['parti', 'user1'] });
    expect(validateLegacy(initial, { title: 'Nouveau titre' })).toEqual({});
  });

  it('assigne qui a quitte le projet + ajout d un contributeur : aucune erreur, l orphelin reste', () => {
    const initial = legacy({ assignees: ['parti'] });
    const edited = { assignees: ['parti', 'user2'] };
    expect(validateLegacy(initial, edited)).toEqual({});
    expect(buildCardPatch(initial, { ...initial, ...edited }, 'communecter').assignees).toEqual(['parti', 'user2']);
  });

  it('seuls les AJOUTS hors contributeurs sont refuses', () => {
    const initial = legacy({ assignees: ['parti'] });
    expect(validateLegacy(initial, { assignees: ['parti', 'inconnu'] })).toEqual({ assignees: 'notMember' });
  });

  it('dates inversees en base + coche d une sous-tache : aucune erreur', () => {
    const initial = legacy({ startDate: NOW + DAY, dueDate: NOW });
    const checklist = initial.checklist.map((item) => ({ ...item, done: true }));
    expect(validateLegacy(initial, { checklist })).toEqual({});
  });

  it('echeance le jour meme d un debut HORODATE : acceptee', () => {
    // `card/create` pose « maintenant » en « En cours » ; la saisie d'une
    // echeance ce jour-la est permise (debut <= echeance a la journee).
    const start = NOW + 14 * 3600 + 23 * 60;
    const initial = legacy({ startDate: start, dueDate: null });
    // L'echeance telle que la saisit la modale : le jour du debut, en FIN de
    // journee dans le fuseau du board-lien — vrai dans tous les fuseaux.
    const sameDay = fromDateInputValue(toDateInputValue(start, 'local'), 'local', 'end');
    expect(validateLegacy(initial, { dueDate: sameDay })).toEqual({});
  });

  it('montant hors bornes en base + priorite modifiee : aucune erreur (le montant ne part pas)', () => {
    const initial = legacy({ credits: -2 });
    expect(validateLegacy(initial, { priority: 'high' })).toEqual({});
    expect(validateLegacy(legacy({ credits: 120_000 }), { title: 'Autre' })).toEqual({});
  });

  it('sous-tache heritee SANS libelle + coche d une autre : aucune erreur', () => {
    const initial = legacy({
      checklist: [
        { id: 't-vide', label: '', done: false },
        { id: 't1', label: 'Maquette', done: false },
      ],
    });
    const checklist = [
      { id: 't-vide', label: '', done: false },
      { id: 't1', label: 'Maquette', done: true },
    ];
    expect(validateLegacy(initial, { checklist })).toEqual({});
    // Un point NEUF vide, lui, est refuse : le serveur le jetterait.
    expect(validateLegacy(initial, { checklist: [...checklist, { id: 'ck_9', label: '  ', done: false }] })).toEqual({
      checklist: 'emptyItem',
    });
  });
});

describe('focus et messages des erreurs', () => {
  it('le premier champ fautif suit l ordre de l ecran', () => {
    expect(firstInvalidCardField({ checklist: 'emptyItem', title: 'required' })).toBe('title');
    expect(firstInvalidCardField({ assignees: 'notMember', credits: 'invalidAmount' })).toBe('assignees');
    expect(firstInvalidCardField({})).toBeNull();
  });

  it('le champ nomme par un refus du serveur est celui de la modale (endDate = echeance)', () => {
    expect(cardFieldOfServerField('assignees')).toBe('assignees');
    expect(cardFieldOfServerField('endDate')).toBe('dueDate');
    expect(cardFieldOfServerField('inconnu')).toBeNull();
    expect(cardFieldOfServerField(null)).toBeNull();
  });

  it('la borne du message depend du champ et de la source', () => {
    expect(cardFormErrorValues('title', 'tooLong', ACTION_CARD_LIMITS)).toEqual({ max: 500 });
    expect(cardFormErrorValues('description', 'tooLong', KANBAN_CARD_LIMITS)).toEqual({ max: 5000 });
    expect(cardFormErrorValues('checklist', 'tooManyItems', ACTION_CARD_LIMITS)).toEqual({ max: 1000 });
    expect(cardFormErrorValues('checklist', 'tooLong', ACTION_CARD_LIMITS)).toEqual({ max: 500 });
    expect(cardFormErrorValues('dueDate', 'dateRange', ACTION_CARD_LIMITS)).toEqual({});
  });
});
