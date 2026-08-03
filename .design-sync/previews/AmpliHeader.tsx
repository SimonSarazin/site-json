import { useEffect, useRef, type ReactNode } from "react";
import { AmpliHeader } from "site-forge";

// Hero du module ampli (min-h 70vh) : fond image/vidéo, icône dans une
// pastille primary/20, headline + subhead localisés, 2 CTA fixes
// (Proposer une idée / Rejoindre la communauté) et liste d'arguments à icônes.
//
// Le bundle DS n'exécute pas src/modules/ampli/i18n.ts (addResourceBundle du
// namespace "modules/ampli") : les libellés des 2 CTA sortiraient en clé brute.
// On restitue après montage les chaînes fr RÉELLES de src/modules/ampli/i18n/fr.json.
const FR: Record<string, string> = {
  "AmpliHero.proposal": "Proposer une idée",
  "AmpliHero.join": "Rejoindre la communauté",
};

function I18nFix({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const walker = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const brut = (n.textContent ?? "").trim();
      if (FR[brut]) n.textContent = (n.textContent ?? "").replace(brut, FR[brut]);
    }
  }, []);
  return <div ref={ref}>{children}</div>;
}

// Fond doux en data-URI (aucun réseau). Le composant interpole l'URL dans un
// url(...) CSS SANS guillemets → il faut aussi encoder ' ( ) sinon le fond
// est ignoré (encodeURIComponent les laisse passer).
const enc = (svg: string) =>
  encodeURIComponent(svg).replace(/[()']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const fond =
  "data:image/svg+xml," +
  enc(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#cdddec'/><stop offset='1' stop-color='#dcead6'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/><circle cx='1270' cy='170' r='280' fill='#ffffff' opacity='.28'/><circle cx='280' cy='720' r='340' fill='#ffffff' opacity='.2'/><circle cx='820' cy='450' r='420' fill='#ffffff' opacity='.1'/></svg>`
  );

// Hero complet : fond, icône mégaphone, arguments en ligne.
export const Complet = () => (
  <I18nFix>
    <AmpliHeader
      props={{
        headline: { fr: "Amplifions le bon sens" },
        subhead: {
          fr: "Un réseau de confiance entre pairs qui amplifie vos idées : parents, tiers-lieux et associations font caisse de résonance commune.",
        },
        icon: { show: true, name: "megaphone", size: 64, backdrop: true },
        backgroundImage: fond,
        listContent: {
          layout: "rows",
          items: [
            { title: { fr: "Réseau de confiance" }, icon: "heart-handshake", iconPosition: "left" },
            { title: { fr: "Pulsation médiatique" }, icon: "radio", iconPosition: "left" },
            { title: { fr: "Amplification mondiale" }, icon: "globe", iconPosition: "left" },
          ],
        },
      }}
    />
  </I18nFix>
);

// Variante épurée : sans image de fond ni liste d'arguments, icône thème.
export const Epure = () => (
  <I18nFix>
    <AmpliHeader
      props={{
        headline: { fr: "Faites entendre votre initiative" },
        subhead: { fr: "Déposez une idée, la communauté la reprend et la porte plus loin." },
        icon: { show: true, name: "sparkles", size: 48, backdrop: false },
        backgroundImage:
          "data:image/svg+xml," +
          enc(`<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill-opacity='0'/></svg>`),
      }}
    />
  </I18nFix>
);
