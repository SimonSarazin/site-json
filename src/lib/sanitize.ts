import DOMPurify from 'isomorphic-dompurify';

/** Sanitize arbitrary HTML for use with dangerouslySetInnerHTML.
 *  Works both on the server (via jsdom) and on the client.
 *
 *  Profil DOMPurify PAR DÉFAUT — le même que `server/utils/normalizeSiteConfig.js`
 *  applique aux champs HTML de la config au boot (idempotence SSR/client). Il est
 *  fait pour du HTML rédigé par un ADMIN du site (sections `html`, `content`…, et
 *  la définition d'un formulaire coform : `field.info`, titres et descriptions de
 *  section — cf. `ProseContent` avec `source="formDefinition"`) : il retire les
 *  scripts, handlers et URLs `javascript:` mais conserve `style`, `class`,
 *  `<form>`, `<input>`, `<svg>`… Pour du texte saisi par n'importe quel
 *  utilisateur, utiliser `sanitizeProse`.
 */
export function sanitize(html: string): string {
  return DOMPurify.sanitize(html);
}

/**
 * Profil pour la PROSE SAISIE PAR N'IMPORTE QUEL UTILISATEUR — réponse coform,
 * description d'un commun, note libre d'une fiche. C'est le défaut de
 * `ProseContent` ; ce qui décide du profil est la SOURCE du texte, pas le
 * composant, d'où la prop `source` qui bascule sur `sanitize()` pour la
 * définition d'un formulaire (écrite par un admin).
 *
 * Le profil par défaut n'est pas une porte XSS, mais il laisse passer tout ce
 * qu'il faut pour dessiner un FAUX ÉCRAN DE CONNEXION plein écran servi depuis
 * le domaine de confiance du site : `<div style="position:fixed;inset:0">`
 * (ou `class="fixed inset-0"` — les utilitaires Tailwind du bundle font le même
 * travail que `style`), `<form action="https://evil">`, `<input type=password>`,
 * `<button>`. D'où :
 *  - `USE_PROFILES: { html: true }` : HTML seul, ni SVG ni MathML (aucune prose
 *    n'en a besoin, et un `<svg>` est un calque de plus à dessiner) ;
 *  - `FORBID_TAGS` : tout contrôle de formulaire et `<dialog>` (positionné en
 *    absolu par la feuille de style navigateur) ;
 *  - `FORBID_ATTR` : `style`, `class`, `id` — les seuls crochets de mise en page
 *    et d'ancrage ; la mise en forme vient du conteneur `prose` de l'appelant ;
 *  - pas d'attributs `data-*` : sans effet légitime dans une prose, mais lus par
 *    les sélecteurs `data-[state=…]` des composants de la page.
 *
 * `DOMPurify.sanitize(html, cfg)` ré-analyse la config à chaque appel : ce
 * profil ne déteint pas sur `sanitize()` (vérifié) et réciproquement.
 */
const PROSE_PROFILE = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    "form", "input", "button", "select", "option", "optgroup", "textarea",
    "datalist", "fieldset", "legend", "label", "output", "dialog", "style",
  ],
  FORBID_ATTR: ["style", "class", "id"],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeProse(html: string): string {
  return DOMPurify.sanitize(html, PROSE_PROFILE);
}
