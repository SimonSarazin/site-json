/**
 * Fonctions PURES de `scripts/mr-review.ts` — tout ce qui se teste sans git,
 * sans réseau et sans disque (tests/preflight/mr-review.test.ts).
 *
 * Le contrat de la note tient en deux motifs que tout le reste lit :
 *   - l'EN-TÊTE humain `## Review — MR 76 (`branche`, commit `7d4fd8eb`)`, celui
 *     des notes postées à la main avant l'outil (elles doivent rester détectées) ;
 *   - le MARQUEUR caché `<!-- mr-review:sha=<40 hex> -->`, ajouté au POST, qui
 *     porte le SHA complet sans dépendre de la mise en forme.
 */
import type { Note } from "./gitlab";

/* ── En-tête & marqueur ──────────────────────────────────────────────────── */

export const EN_TETE = /^## Review — MR (\d+) \(`([^`]+)`, commit `([0-9a-f]{7,40})`\)/m;
export const MARQUEUR = /<!-- mr-review:sha=([0-9a-f]{40}) -->/;

export const marqueur = (shaFull: string): string => `<!-- mr-review:sha=${shaFull} -->`;

export interface EnTete {
  iid: number;
  branche: string;
  sha: string;
}

export function parseEnTete(note: string): EnTete | null {
  const m = EN_TETE.exec(note);
  return m ? { iid: Number(m[1]), branche: m[2], sha: m[3] } : null;
}

/* ── Permaliens & références ─────────────────────────────────────────────── */

/** `https://host/owner/repo/-/blob/<sha>/<fichier>#L12[-20]` — SHA complet, donc stable. */
export function permalien(projetWebUrl: string, shaFull: string, fichier: string, ligne: number, ligneFin?: number): string {
  const base = projetWebUrl.replace(/\/+$/, "");
  const ancre = ligneFin && ligneFin > ligne ? `#L${ligne}-${ligneFin}` : `#L${ligne}`;
  return `${base}/-/blob/${shaFull}/${fichier}${ancre}`;
}

export interface Ref {
  fichier: string;
  ligne: number;
  ligneFin?: number;
  /** SHA porté par le permalien ; absent pour une réf `fichier:ligne` nue. */
  sha?: string;
  /** Texte d'origine, pour les messages. */
  source: string;
}

const RE_PERMALIEN = /\/-\/blob\/([0-9a-f]{7,40})\/([^\s#)]+)#L(\d+)(?:-(\d+))?/g;
/** `` `src/x.ts:42` `` ou `` `src/x.ts:42-50` `` — chemins avec au moins un `/` ou une extension. */
const RE_NUE = /`((?:[\w.@-]+\/)*[\w.@-]+\.[a-z]{1,5}):(\d+)(?:-(\d+))?`/g;

/** Toutes les références `fichier:ligne` d'une note, permaliens d'abord. */
export function extraireRefs(note: string): Ref[] {
  const refs: Ref[] = [];
  const vues = new Set<string>();
  const pousser = (r: Ref) => {
    // Même fichier:ligne en permalien ET en réf nue (texte du lien) : une seule entrée.
    const cle = `${r.fichier}:${r.ligne}`;
    if (vues.has(cle)) return;
    vues.add(cle);
    refs.push(r);
  };
  for (const m of note.matchAll(RE_PERMALIEN)) {
    pousser({ sha: m[1], fichier: m[2], ligne: Number(m[3]), ligneFin: m[4] ? Number(m[4]) : undefined, source: m[0] });
  }
  for (const m of note.matchAll(RE_NUE)) {
    pousser({ fichier: m[1], ligne: Number(m[2]), ligneFin: m[3] ? Number(m[3]) : undefined, source: m[0] });
  }
  return refs;
}

export interface Verification {
  ok: boolean;
  raison?: string;
  /** La ligne source, pour le contrôle visuel (« la ligne citée dit bien ça »). */
  ligne?: string;
}

/**
 * Vérifie une référence contre l'arbre au SHA relu. `lire(sha, fichier)` rend
 * le contenu du fichier à ce SHA, ou `null` s'il n'y existe pas.
 */
export function verifierRef(ref: Ref, headSha: string, lire: (sha: string, fichier: string) => string | null): Verification {
  if (ref.sha && !headSha.startsWith(ref.sha) && !ref.sha.startsWith(headSha)) {
    return { ok: false, raison: `SHA ${ref.sha.slice(0, 8)} ≠ head ${headSha.slice(0, 8)}` };
  }
  const contenu = lire(headSha, ref.fichier);
  if (contenu === null) return { ok: false, raison: `fichier absent au SHA ${headSha.slice(0, 8)}` };
  const lignes = contenu.split("\n");
  // Un fichier terminé par \n produit une dernière entrée vide : pas une ligne.
  const total = lignes.length - (lignes[lignes.length - 1] === "" ? 1 : 0);
  const fin = ref.ligneFin ?? ref.ligne;
  if (ref.ligne < 1 || fin > total) return { ok: false, raison: `ligne ${fin} hors fichier (${total} lignes)` };
  return { ok: true, ligne: lignes[ref.ligne - 1].trim() };
}

/* ── Idempotence du POST ─────────────────────────────────────────────────── */

export interface NoteTrouvee {
  note: Note;
  sha: string;
  /** Vrai si la note vise un SHA plus ancien que le head courant. */
  perimee: boolean;
}

/**
 * Ma dernière note de review sur la MR, si elle existe. Détection par
 * marqueur (notes de l'outil) OU par en-tête (notes postées à la main) :
 * `perimee` quand son SHA n'est pas celui du head.
 */
export function noteExistante(notes: Note[], meId: number, headSha: string): NoteTrouvee | null {
  for (const note of notes) {
    if (note.system || note.author.id !== meId) continue;
    const sha = MARQUEUR.exec(note.body)?.[1] ?? parseEnTete(note.body)?.sha;
    if (!sha) continue;
    return { note, sha, perimee: !headSha.startsWith(sha) };
  }
  return null;
}

/* ── Rendu de la note ────────────────────────────────────────────────────── */

export const SECTIONS = {
  bloquant: "### À corriger avant le merge",
  verifier: "### À vérifier",
  nettoyage: "### Nettoyage (non bloquant)",
  verifie: "### Vérifié",
} as const;

export const A_REMPLIR = "<!-- à remplir -->";

/** Substitution `{{nom}}` stricte : un placeholder sans valeur est une erreur, pas un trou. */
export function rendreNote(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, nom: string) => {
    if (!(nom in vars)) throw new Error(`Placeholder inconnu dans le template : {{${nom}}}`);
    return vars[nom];
  });
}

export interface GateResult {
  nom: string;
  /** Code de sortie ; `null` = non exécutée (sautée). */
  code: number | null;
  dureeMs: number;
  /** Une ligne : « 3 échecs », « 113 tests », « conf invalide »… */
  resume?: string;
}

const secondes = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;

/** Le bloc « Vérifié » tel que la note le colle — jamais réécrit de mémoire. */
export function blocVerifie(gates: GateResult[], contexte?: string): string {
  const lignes = gates.map((g) => {
    if (g.code === null) return `- — ${g.nom} — non exécuté${g.resume ? ` (${g.resume})` : ""}`;
    const etat = g.code === 0 ? "✓" : "✗";
    const detail = g.resume ? ` — ${g.resume}` : "";
    return `- ${etat} \`${g.nom}\`${detail} — ${secondes(g.dureeMs)}`;
  });
  return [contexte ? `_${contexte}_` : null, ...lignes].filter(Boolean).join("\n");
}

/** Section du template → corps (sans le titre). Une section absente = `undefined`. */
export function sections(note: string): Record<string, string> {
  const out: Record<string, string> = {};
  const titres = Object.values(SECTIONS) as string[];
  const re = /^### .+$/gm;
  const positions = [...note.matchAll(re)].map((m) => ({ titre: m[0], debut: m.index!, fin: m.index! + m[0].length }));
  positions.forEach((p, i) => {
    const corps = note.slice(p.fin, positions[i + 1]?.debut ?? note.length);
    if (titres.includes(p.titre)) out[p.titre] = corps.trim();
  });
  return out;
}

/**
 * Un corps de section est « vide » s'il ne contient que le placeholder, rien,
 * ou la mention explicite « — rien ».
 */
export const sectionVide = (corps: string | undefined): boolean =>
  !corps || corps.replace(A_REMPLIR, "").trim() === "" || /^—\s*rien\b/i.test(corps.trim());

/** `bloquant` ssi la section 1 porte des points ou une gate est rouge — dérivé, pas décidé. */
export function verdict(note: string, gates: GateResult[]): "bloquant" | "non bloquant" {
  const s = sections(note);
  const gateRouge = gates.some((g) => g.code !== null && g.code !== 0);
  return !sectionVide(s[SECTIONS.bloquant]) || gateRouge ? "bloquant" : "non bloquant";
}

/* ── Divers ──────────────────────────────────────────────────────────────── */

/** Prénom pour la salutation : « ANGERS Nathan » → Nathan, « Nathan Angers » → Nathan. */
export function prenom(nomComplet: string): string {
  const mots = nomComplet.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "";
  const estNom = (m: string) => m.length > 1 && m === m.toUpperCase() && /\p{L}/u.test(m);
  const candidat = mots.find((m) => !estNom(m)) ?? mots[0];
  return candidat.charAt(0).toUpperCase() + candidat.slice(1);
}

export const fichiersTestsModifies = (fichiers: string[]): string[] =>
  fichiers.filter((f) => /\.test\.tsx?$/.test(f));

export const configsModifiees = (fichiers: string[]): string[] =>
  fichiers.filter((f) => /^config\.prod[^/]*\.json$/.test(f));

/**
 * Valeurs de `.env` qui apparaissent dans la note. Seuil de 12 caractères :
 * en dessous (`5173`, `default`, une URL locale) le faux positif est garanti.
 */
export function fuiteSecrets(note: string, env: Record<string, string>): string[] {
  return Object.entries(env)
    .filter(([, v]) => v.length >= 12 && note.includes(v))
    .map(([k]) => k);
}

/** Lecture tolérante de `changes_count` (« 32 », « 1000+ »). */
export const nombreDeFichiers = (changes: string | undefined): number =>
  changes ? Number.parseInt(changes, 10) || 0 : 0;
