import { describe, it, expect } from "vitest";
import MarkdownIt from "markdown-it";
import { sanitize } from "@/lib/sanitize";
import { renderMarkdown } from "../renderMarkdown";

/**
 * Test de CARACTERISATION de markdown-it (R8b - de-risquage du bump 14.1.0 vers 14.2.0).
 *
 * But : figer la sortie HTML ACTUELLE (sous 14.1.0) de nos DEUX configs markdown-it,
 * APRES passage dans sanitize() (= ce qui atteint reellement dangerouslySetInnerHTML).
 * Au bump, `npm run test:unit` rejoue : tout snapshot qui bouge = changement de rendu
 * reel a arbitrer (correction amont acceptable vs regression). C'est le mecanisme qui
 * rend VISIBLE un changement que les tests structurels grossiers laissaient passer.
 *
 * Deux configs reelles :
 *  - MarkdownSection.tsx (mdParser) : { html, linkify, typographer } - AUCUN test avant.
 *  - renderMarkdown.ts : MarkdownIt() par defaut.
 * markdown-it n'exporte pas mdParser : on le reinstancie a l'identique ci-dessous ;
 * si les options de MarkdownSection.tsx changent, mettre a jour mdSection.
 *
 * Corpus cible sur les 4 changements de sortie reels de 14.2.0 (trim espaces unicode,
 * decodage d'entites plus strict, emphase autour de caracteres astraux/emoji, commentaires
 * HTML) + des cas de CONTROLE qui ne doivent PAS bouger. Les espaces unicode sont injectes
 * via String.fromCharCode pour garder une source 100% ASCII (pas de caractere invisible).
 */

const NBSP = String.fromCharCode(0x00a0); // espace insecable U+00A0
const NNBSP = String.fromCharCode(0x202f); // espace fine insecable U+202F

// Miroir EXACT de src/components/sections/MarkdownSection.tsx (mdParser).
const mdSection = new MarkdownIt({ html: true, linkify: true, typographer: true });
const renderSection = (input: string) => sanitize(mdSection.render(input));
// Vraie fonction helper (MarkdownIt() defaut + sanitize si markdownEnabled !== false).
const renderDefault = (input: string) => renderMarkdown(input, {});

const CORPUS: Record<string, string> = {
  // #1074 - trim d'espaces unicode : NBSP (U+00A0) + espace fine insecable (U+202F)
  nbspHeading: `# Titre${NBSP}avec${NNBSP}espaces`,
  nbspParagraph: `Paragraphe${NBSP}typographie${NNBSP}francaise.`,
  // #1096 - decodage d'entites plus strict
  ambiguousEntity: "Param &mot; et &amp ; et &copy; final",
  // #1072 - emphase autour de caracteres astraux / emoji (paires de substitution)
  astralBold: "**emoji \u{1F389} gras**",
  astralItalic: "_texte \u{1F600} italique_",
  // #1155 - commentaire HTML multi-ligne avec ligne vide (html:true uniquement)
  htmlComment: "<!--\nligne1\n\nligne2\n-->\nTexte apres",
  // Controles : DOIVENT rester stables au bump
  linkify: "Voir https://example.org pour info",
  frenchQuotes: 'Il dit "bonjour" a tous',
  basicEmphasis: "**gras** et _italique_ normaux",
};

describe("markdown-it characterization (fige la sortie avant bump)", () => {
  for (const [name, input] of Object.entries(CORPUS)) {
    it(`MarkdownSection {html,linkify,typographer} - ${name}`, () => {
      expect(renderSection(input)).toMatchSnapshot();
    });
    it(`renderMarkdown (defaut) - ${name}`, () => {
      expect(renderDefault(input)).toMatchSnapshot();
    });
  }
});
