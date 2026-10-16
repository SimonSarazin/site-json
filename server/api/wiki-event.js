/**
 * PAGE WIKI D'UN ÉVÉNEMENT — crée sur MediaWiki (movilab.org) la page qui documente une rencontre.
 *
 *   GET  /api/wiki/event/:id/plan   titre et URL de la page (données publiques, sans authentification)
 *   POST /api/wiki/event/:id        crée la page avec le compte robot (`Authorization` requis)
 *
 * ── SÉCURITÉ ─────────────────────────────────────────────────────────────────
 * Le compte robot a des droits que l'appelant n'a pas : il ne doit jamais écrire sur la seule foi
 * du navigateur. Le contenu de la page vient du BACKEND (jamais du corps de la requête), et la
 * création n'a lieu que si la description de l'événement contient déjà l'URL de la page. Or cette
 * description n'est modifiable que par un utilisateur autorisé : c'est le backend qui tranche.
 * Le client écrit donc le lien d'abord, puis appelle le POST.
 *
 * ── CONFIGURATION (serveur uniquement, jamais dans le dépôt) ─────────────────
 *   WIKI_API_URL        ex. https://movilab.org/api.php
 *   WIKI_PAGE_BASE_URL  ex. https://movilab.org/index.php?title=   (défaut : dérivé de WIKI_API_URL)
 *   WIKI_BOT_USER       identifiant du bot password (Nom@NomDuBot)
 *   WIKI_BOT_PASSWORD   mot de passe du bot password
 * Sans `WIKI_API_URL`, la fonction est absente : 503.
 */

const DELAI_MS = 15_000;
const ID_EVENEMENT = /^[a-f0-9]{24}$/;

const TYPES = {
  workshop: "Atelier", competition: "Compétition", concert: "Concert", contest: "Concours",
  conference: "Conférence", debate: "Débat", exhibition: "Exposition", festival: "Festival",
  crowdfunding: "Financement participatif", fair: "Foire", course: "Formation", protest: "Manifestation",
  market: "Marché", film: "Projection", getTogether: "Rencontre", meeting: "Réunion",
  spectacle: "Spectacle", internship: "Stage", stand: "Stand", others: "Autre",
};

function config() {
  const api = process.env.WIKI_API_URL;
  if (!api) return null;
  const base = process.env.WIKI_PAGE_BASE_URL || `${new URL(api).origin}/index.php?title=`;
  return { api, base };
}

function backend() {
  return (process.env.VITE_BASE_URL_BACKEND || "").replace(/\/+$/, "");
}

async function lireEvenement(id) {
  const r = await fetch(`${backend()}/co2/element/get/type/events/id/${id}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(DELAI_MS),
  });
  if (!r.ok) return null;
  const corps = await r.json();
  return corps?.result && corps.map ? corps.map : null;
}

/** Jour au format ISO, en heure de Paris par défaut. */
function jour(iso, fuseau) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: fuseau || "Europe/Paris" }).format(d);
}

export function titrePage(evt) {
  const nom = String(evt.name || "").replace(/[#<>[\]|{}]/g, " ").replace(/\s+/g, " ").trim();
  const date = jour(evt.startDate, evt.timeZone);
  return date ? `${nom} (${date})` : nom;
}

function urlPage(c, titre) {
  return `${c.base}${encodeURIComponent(titre.replace(/ /g, "_"))}`;
}

/** Texte brut sûr pour un paramètre de modèle : un `|` ou `}}` casserait l'appel. */
function param(v) {
  return String(v ?? "").replace(/\|/g, "&#124;").replace(/\{\{/g, "&#123;&#123;").replace(/\}\}/g, "&#125;&#125;").trim();
}

/** Corps de page : le texte vient d'utilisateurs, il ne doit pas pouvoir appeler un modèle ni du HTML. */
function corps(v) {
  return String(v).replace(/[<>{}[\]|]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function sansLien(description, url) {
  return String(description || "")
    .split("\n")
    .filter((l) => !l.includes(url))
    .join("\n")
    .trim();
}

/**
 * Met à jour une page existante : seuls l'appel du modèle et la section « Description » sont
 * régénérés. Le compte-rendu et tout ce que les participants ont écrit sur le wiki sont conservés.
 */
export function fusionner(existant, neuf) {
  const modele = /^\{\{Evenement[\s\S]*?\n\}\}/;
  const description = /== Description ==\n[\s\S]*?(?=\n== |$)/;
  let texte = existant.replace(modele, () => neuf.match(modele)[0]);
  const section = neuf.match(description)?.[0];
  if (description.test(texte)) texte = texte.replace(description, () => section ?? "");
  else if (section) texte = texte.replace(/\n== Compte-rendu ==/, () => `\n${section}\n\n== Compte-rendu ==`);
  return texte;
}

export function wikitexte(evt, { url, fiche, image }) {
  const organisateurs = Object.values(evt.organizer || {}).map((o) => o?.name).filter(Boolean).join(",");
  const tags = Array.isArray(evt.tags) ? evt.tags.join(",") : "";
  const debut = jour(evt.startDate, evt.timeZone);
  const fin = jour(evt.endDate, evt.timeZone);
  const complement = fin && fin !== debut ? `Du ${debut} au ${fin}` : "";
  const lieu = evt.address?.name || evt.address?.addressLocality || "";
  const complete = sansLien(evt.description, url);
  const resume = String(evt.shortDescription || "").trim() || complete.replace(/\s+/g, " ");

  return [
    "{{Evenement",
    `|Main_Picture=${param(image)}`,
    `|name=${param(evt.name)}`,
    `|type=${param(TYPES[evt.type] || TYPES.others)}`,
    `|description=${param(resume)}`,
    `|Tags=${param(tags)}`,
    `|location=${param(lieu)}`,
    `|from=${param(organisateurs)}`,
    `|startDate=${param(debut)}`,
    `|urlpad=`,
    `|complement=${param(complement)}`,
    "}}",
    "",
    ...(complete ? ["== Description ==", "", corps(complete).replace(/\n{2,}/g, "\n\n"), ""] : []),
    "== Compte-rendu ==",
    "",
    "== Décisions et actions ==",
    "",
    `Fiche de l'événement : ${fiche}`,
    "",
  ].join("\n");
}

function fiche(req, evt) {
  return `${req.protocol}://${req.get("host")}/profil/${evt.slug}`;
}

/** Client MediaWiki minimal : un cookie jar à la main, `fetch` ne le gère pas. */
async function sessionWiki(c) {
  const cookies = new Map();
  const appel = async (params, post) => {
    const url = new URL(c.api);
    const init = { headers: { "user-agent": "site-json-wiki-event/1.0" }, signal: AbortSignal.timeout(DELAI_MS) };
    const corps = new URLSearchParams({ format: "json", formatversion: "2", ...params });
    if (post === "multipart") {
      const form = new FormData();
      for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) form.append(k, v);
      init.method = "POST";
      init.body = form;
    } else if (post) {
      init.method = "POST";
      init.body = corps;
    } else {
      url.search = corps.toString();
    }
    if (cookies.size) init.headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const r = await fetch(url, init);
    for (const sc of r.headers.getSetCookie?.() || []) {
      const [paire] = sc.split(";");
      const i = paire.indexOf("=");
      cookies.set(paire.slice(0, i), paire.slice(i + 1));
    }
    return r.json();
  };

  const jetonLogin = (await appel({ action: "query", meta: "tokens", type: "login" })).query?.tokens?.logintoken;
  const login = await appel({
    action: "login",
    lgname: process.env.WIKI_BOT_USER || "",
    lgpassword: process.env.WIKI_BOT_PASSWORD || "",
    lgtoken: jetonLogin || "",
  }, true);
  if (login.login?.result !== "Success") throw new Error("connexion au wiki refusee");
  const csrf = (await appel({ action: "query", meta: "tokens" })).query?.tokens?.csrftoken;
  if (!csrf) throw new Error("jeton wiki indisponible");
  return {
    televerser: async (nom, blob) => {
      const r = await appel({ action: "upload", filename: nom, file: blob, ignorewarnings: "1", comment: "Image de l'événement, depuis tiers-lieux.org", token: csrf }, "multipart");
      return r.upload?.result === "Success" || r.error?.code === "fileexists-no-change" ? r.upload?.filename || nom : null;
    },
    lire: async (title) => {
      const r = await appel({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", titles: title });
      const page = r.query?.pages?.[0];
      return page?.missing ? null : page?.revisions?.[0]?.slots?.main?.content ?? null;
    },
    modifier: (title, text) => appel({ action: "edit", title, text, nocreate: "1", summary: "Mise à jour depuis tiers-lieux.org", token: csrf }, true),
    creer: (title, text) => appel({ action: "edit", title, text, createonly: "1", summary: "Création depuis tiers-lieux.org", token: csrf }, true),
  };
}

const IMAGE_MAX = 9 * 1024 * 1024;
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };

/** Image de l'événement, téléchargée depuis le backend ; null si absente ou inutilisable. */
async function lireImage(evt, id, hotes = []) {
  const chemin = evt.profilImageUrl || evt.profilMediumImageUrl;
  if (!chemin) return null;
  try {
    const url = new URL(chemin, `${backend()}/`);
    const autorises = [new URL(backend()).origin, ...hotes];
    if (!autorises.includes(url.origin)) return null;
    const r = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS) });
    const type = (r.headers.get("content-type") || "").split(";")[0].trim();
    const ext = EXTENSIONS[type];
    if (!r.ok || !ext) return null;
    const buf = await r.arrayBuffer();
    if (buf.byteLength > IMAGE_MAX) return null;
    return { blob: new Blob([buf], { type }), nom: `Evenement_${id}.${ext}` };
  } catch {
    return null;
  }
}

async function charger(req, res) {
  const c = config();
  if (!c) {
    res.status(503).json({ wiki: false, msg: "wiki non configure sur ce deploiement" });
    return null;
  }
  const id = req.params.id;
  if (!ID_EVENEMENT.test(id || "")) {
    res.status(400).json({ msg: "identifiant invalide" });
    return null;
  }
  let evt;
  try {
    evt = await lireEvenement(id);
  } catch {
    res.status(502).json({ msg: "backend injoignable" });
    return null;
  }
  if (!evt?.name) {
    res.status(404).json({ msg: "evenement introuvable" });
    return null;
  }
  const titre = titrePage(evt);
  return { c, evt, titre, url: urlPage(c, titre) };
}

export async function wikiEventPlanHandler(req, res) {
  const ctx = await charger(req, res);
  if (ctx) res.json({ title: ctx.titre, url: ctx.url });
}

export async function wikiEventCreateHandler(req, res) {
  if (!req.headers.authorization) return res.status(401).json({ msg: "authentification requise" });
  const ctx = await charger(req, res);
  if (!ctx) return;
  const { c, evt, titre, url } = ctx;

  if (!String(evt.description || "").includes(url)) {
    return res.status(403).json({ msg: "le lien de la page doit d'abord figurer dans la description" });
  }

  try {
    const wiki = await sessionWiki(c);
    let image = "";
    const img = await lireImage(evt, req.params.id, [`${req.protocol}://${req.get("host")}`]);
    if (img) {
      try {
        image = (await wiki.televerser(img.nom, img.blob)) || "";
      } catch {
        // La page se crée sans image plutôt que de ne pas se créer.
      }
    }
    const neuf = wikitexte(evt, { url, fiche: fiche(req, evt), image });
    const existant = await wiki.lire(titre);
    const r = existant === null ? await wiki.creer(titre, neuf) : await wiki.modifier(titre, fusionner(existant, neuf));
    if (r.error) {
      return res.status(502).json({ msg: "ecriture refusee par le wiki", code: r.error.code });
    }
    return res.json({ title: titre, url, updated: existant !== null });
  } catch {
    return res.status(502).json({ msg: "wiki injoignable ou connexion refusee" });
  }
}
