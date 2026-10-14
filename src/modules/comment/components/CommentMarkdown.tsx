import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useT } from "@/hooks/useT";
import { getBaseUrl } from "@/lib/constant/common";
import { sanitizeProse } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { COMMENT_PROSE } from "../lib/commentProse";
import {
  classifyImageSource,
  isInsideLink,
  newMarkNonce,
  placeRemoteImages,
  remoteImageMark,
  stripRemoteMarks,
  type RemoteImage,
} from "../lib/inlineImages";
import { linkifyMentions, markSelfMentions } from "../lib/linkifyMentions";
import { createCommentMarkdown } from "../lib/markdownEngine";
import type { CommentMention } from "../types";

/**
 * Rendu du texte d'un message.
 *
 * **Deux barrières, et non une.** La première est le parseur, restreint *à la source* :
 * `html: false` échappe tout HTML écrit par l'auteur, et une image n'en sort que si son adresse
 * mène à la plateforme — une image tierce y devient une marque, qu'on remplace APRÈS le
 * nettoyage par le bouton qui l'affiche (`placeRemoteImages`). Les titres à croisillons passent
 * (six niveaux, comme l'éditeur du legacy), pas les titres soulignés (`lheading`). La seconde
 * est `sanitizeProse`, le profil DOMPurify déjà en place dans le dépôt pour la prose saisie par
 * n'importe qui.
 *
 * Ce choix conserve le moteur du dépôt (`markdown-it` + `@/lib/sanitize`, cf. `ProseContent`)
 * au lieu d'introduire un second chemin de rendu markdown : une seule implémentation, donc
 * une seule garantie de sécurité à maintenir. `react-markdown` + `rehype-raw` est
 * explicitement proscrit ici comme ailleurs — c'était une faille.
 *
 * `breaks: true` est propre au fil : dans une discussion, un retour à la ligne simple est
 * voulu par celui qui écrit, alors qu'en markdown standard il serait ignoré.
 *
 * Le réglage lui-même vit dans `lib/markdownEngine` : l'éditeur du composer relit un message avec
 * le MÊME, sans quoi ce qu'il montre pendant qu'on écrit ne serait pas ce que le fil affichera.
 */
const parser = createCommentMarkdown();

/**
 * Tout lien SORTANT est marqué `rel="noopener noreferrer nofollow ugc"`.
 *
 * `nofollow ugc` est le point important : un fil de commentaires est la cible naturelle d'un
 * spam de liens, et cette annotation retire tout bénéfice de référencement au spammeur.
 *
 * `target="_blank"` n'est délibérément PAS posé : mesuré, `sanitizeProse` (le profil DOMPurify
 * partagé) retire l'attribut `target`. Le poser ici donnerait l'illusion d'un comportement que
 * la sanitisation défait juste après. Les liens s'ouvrent donc dans l'onglet courant, comme
 * partout ailleurs dans le dépôt où `ProseContent` est employé.
 *
 * Les liens INTERNES (`/profil/…`, produits par les mentions) ne sont pas marqués : ils
 * pointent vers le site lui-même.
 */
const defaultLinkOpen = parser.renderer.rules.link_open
  ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

parser.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token?.attrGet("href") ?? "";
  if (!href.startsWith("/")) {
    token?.attrSet("rel", "noopener noreferrer nofollow ugc");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/** Ce que le rendu d'un message relève en passant : ses images tierces, dans l'ordre du texte. */
interface EnvDuRendu {
  readonly remote: RemoteImage[];
  /** Le jeton de CE rendu, dans chaque marque : l'auteur ne peut pas en fabriquer une (`newMarkNonce`). */
  readonly nonce: string;
}

/**
 * Une image DANS le texte (`![description](adresse)`) — décision de l'user du 14/10/2026 :
 *
 * - servie par la plateforme (un fichier importé) : l'image, chargée sans attendre le défilement,
 *   puis nettoyée comme le reste ;
 * - tierce : une MARQUE. Le profil de nettoyage retirerait le bouton qui doit l'afficher ; c'est
 *   donc après lui que `placeRemoteImages` pose ce bouton — ou l'image, une fois ouverte ;
 * - refusée (`data:`, adresse vide…) : sa description seule, en texte.
 *
 * L'adresse a déjà passé la règle du moteur (`validateLink`) : ni `javascript:`, ni `file:`.
 */
parser.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const { escapeHtml } = parser.utils;
  const alt = self.renderInlineAsText(token?.children ?? [], options, env);
  const source = classifyImageSource(token?.attrGet("src") ?? "", getBaseUrl());
  if (source.kind === "platform") return `<img src="${escapeHtml(source.url)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  if (source.kind === "refused") return escapeHtml(alt);
  const { remote, nonce } = env as EnvDuRendu;
  remote.push({ url: source.url, host: source.host, alt, inLink: isInsideLink(tokens, idx) });
  return remoteImageMark(remote.length - 1, nonce);
};

const AUCUNE: ReadonlySet<number> = new Set();

export interface CommentMarkdownProps {
  readonly text: string;
  readonly mentions?: readonly CommentMention[];
  /**
   * L'utilisateur courant : ses mentions — le `@moi` — sont marquées pour être rendues en
   * pastille. C'est ce qui dit « pour toi » dans le texte même, là où le fond de la ligne ne dure
   * que jusqu'à la lecture.
   */
  readonly meId?: string | null;
  readonly className?: string;
}

export function CommentMarkdown({ text, mentions, meId = null, className }: CommentMarkdownProps) {
  const t = useT("modules/comment");
  const racine = useRef<HTMLDivElement>(null);

  const rendu = useMemo(() => {
    const env: EnvDuRendu = { remote: [], nonce: newMarkNonce() };
    // Une marque que l'auteur aurait écrite — en clair, ou en entité que `markdown-it` décode
    // (`&#xE000;`) — n'a pas le jeton du rendu : `placeRemoteImages` l'ignore et en retire les signes,
    // comme le fait ici `stripRemoteMarks` quand le message n'a pas d'image tierce.
    const sain = sanitizeProse(parser.render(linkifyMentions(text ?? "", mentions), env));
    const miens = meId === null
      ? []
      : (mentions ?? []).filter(m => m.id === meId && m.slug).map(m => parser.normalizeLink(`/profil/${m.slug}`));
    const marque = markSelfMentions(sain, miens);
    return { html: env.remote.length === 0 ? stripRemoteMarks(marque) : marque, remote: env.remote, nonce: env.nonce };
  }, [text, mentions, meId]);

  // Les images tierces que le lecteur a ouvertes, par rang dans CE texte : un autre texte — le
  // message édité — les referme toutes. Aucun effet pour cela : l'état sait pour quel texte il vaut.
  const [ouvertes, setOuvertes] = useState<{ readonly texte: string; readonly rangs: ReadonlySet<number> }>({ texte: text, rangs: AUCUNE });
  const rangs = ouvertes.texte === text ? ouvertes.rangs : AUCUNE;

  // Le bouton cliqué disparaît, remplacé par son image : le focus la suit, au lieu de tomber sur la page.
  const focusEnAttente = useRef<number | null>(null);
  useEffect(() => {
    const rang = focusEnAttente.current;
    if (rang === null) return;
    focusEnAttente.current = null;
    racine.current?.querySelector<HTMLElement>(`[data-remote-image-shown="${rang}"]`)?.focus();
  });

  // Hors du `useMemo` : le libellé suit la langue, et poser des boutons ne coûte qu'un passage
  // d'expression régulière — rien du tout pour un message sans image tierce.
  const html = rendu.remote.length === 0
    ? rendu.html
    : placeRemoteImages(rendu.html, rendu.remote, rangs, image => String(t("images.inline.remoteShow", undefined, { host: image.host })), rendu.nonce);

  // UN objet tant que le HTML ne change pas. React 19 compare `dangerouslySetInnerHTML` par
  // IDENTITÉ : un objet neuf à chaque rendu réécrivait le message entier à chaque rendu. Or la ligne
  // se redessine quand on la touche (elle devient active) : le lien ou le bouton pressé était
  // remplacé entre l'appui et le relâchement, et le PREMIER clic se perdait — mesuré au navigateur
  // le 14/10, trois fois sur trois sur un lien.
  const contenu = useMemo(() => ({ __html: html }), [html]);

  // Un seul écouteur pour tous les boutons du message : ils vivent dans du HTML, pas dans React. Le
  // HTML du message n'a pas d'enfants React, donc pas de portail : un clic reçu ici vient de lui, et
  // ses boutons ne portent que les rangs que `placeRemoteImages` vient d'écrire.
  const ouvrir = (event: MouseEvent<HTMLDivElement>) => {
    const bouton = (event.target as Element | null)?.closest?.("button[data-remote-image]");
    if (!bouton) return;
    const rang = Number(bouton.getAttribute("data-remote-image"));
    focusEnAttente.current = rang;
    setOuvertes({ texte: text, rangs: new Set([...rangs, rang]) });
  };

  return (
    <div
      ref={racine}
      // Le conteneur `prose` porte toute la mise en forme : `sanitizeProse` retire `class`,
      // `style` et `id` du contenu, donc rien ne peut s'échapper de cette boîte.
      className={cn(COMMENT_PROSE, className)}
      onClick={rendu.remote.length > 0 ? ouvrir : undefined}
      dangerouslySetInnerHTML={contenu}
      suppressHydrationWarning
    />
  );
}
