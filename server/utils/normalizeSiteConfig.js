/**
 * Pré-normalisation des champs HTML/SVG de la config au boot serveur.
 *
 * Problème : les sections qui font `dangerouslySetInnerHTML={{ __html: sanitize(html) }}`
 * appellent DOMPurify au render. Côté SSR, jsdom-DOMPurify normalise un HTML
 * légèrement différemment du DOMPurify natif côté client (whitespace, ordre
 * d'attributs, fermeture explicite de tags…) → mismatch hydration potentiel.
 *
 * Solution : sanitize une seule fois côté serveur, au chargement de la config,
 * AVANT que le SSR rende et AVANT que le client reçoive `window.__CONFIG__`.
 * SSR et client utilisent strictement la même chaîne — pas de diff DOM possible.
 *
 * Le `sanitize` côté composants reste actif (défense en profondeur) mais devient
 * idempotent : sanitize d'un HTML déjà sanitizé = même résultat.
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Champs de la config susceptibles de contenir du HTML/SVG injecté via
 * `dangerouslySetInnerHTML`. Liste à jour à partir d'un audit complet des
 * composants qui font cet usage.
 *
 * Pour les champs polymorphes (`content` peut être string HTML OU array de
 * sections, `icon` peut être nom lucide OU SVG inline), `normalizeHtmlValue`
 * détecte le type et ne touche pas aux objets/arrays — seules les strings
 * (et les valeurs string d'un LocalizedString) sont sanitizées.
 */
const HTML_FIELDS = new Set([
  "html",      // HTMLSection.props.html
  "svg",       // ContentSection iconCard.svg
  "iconSvg",   // CardsSection items.iconSvg
  "infoText",  // ContentSection (HTML brut via t())
  "extra",     // DefaultFooter footer.extra
  "content",   // TabsSection/AccordionSection/BlogPostSection/MarkdownSection
  "icon",      // HeroSSBE/HeroRezoLaMer/ActionButtonsRezoLaMer (SVG inline ou nom lucide)
  "logoIcon",  // HeroRezoLaMer props.logoIcon
]);

/**
 * Parcours récursif + sanitize des champs HTML/SVG identifiés.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function normalizeSiteConfig(value) {
  return walk(value);
}

function walk(value) {
  if (Array.isArray(value)) {
    return value.map(walk);
  }
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = HTML_FIELDS.has(key) ? normalizeHtmlValue(val) : walk(val);
    }
    return result;
  }
  return value;
}

function normalizeHtmlValue(val) {
  if (typeof val === "string") {
    return DOMPurify.sanitize(val);
  }
  // Arrays (ex: TabsSection imbriqué où tab.content = array de sections) →
  // on poursuit la marche récursive standard, sans sanitize au top-level.
  if (Array.isArray(val)) {
    return val.map(walk);
  }
  // LocalizedString : { fr: "...", en: "..." } → sanitize chaque valeur string.
  // Si val est un objet non-localizé (ex: { sections: [...] }), on traverse
  // récursivement aussi pour ne pas le casser.
  if (val && typeof val === "object") {
    const result = {};
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === "string") {
        result[k] = DOMPurify.sanitize(v);
      } else {
        result[k] = walk(v);
      }
    }
    return result;
  }
  return val;
}
