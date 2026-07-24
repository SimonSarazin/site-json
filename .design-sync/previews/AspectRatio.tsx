import { AspectRatio } from "site-forge";

// Visuels en data-URI SVG (formes plates, couleurs hex — cf. learnings vague 1).
const paysage = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'><rect width='800' height='450' fill='#dbeafe'/><rect y='300' width='800' height='150' fill='#86efac'/><circle cx='650' cy='100' r='55' fill='#fde047'/><rect x='120' y='200' width='180' height='100' fill='#f4f4f5'/><rect x='150' y='230' width='40' height='70' fill='#1e3a8a'/><rect x='210' y='230' width='40' height='40' fill='#93c5fd'/><rect x='100' y='180' width='220' height='30' fill='#dc2626'/><text x='400' y='400' font-family='sans-serif' font-size='28' fill='#166534' text-anchor='middle'>La Grange numerique - Auxi-le-Chateau</text></svg>`
)}`;

const carre = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#eff6ff'/><circle cx='200' cy='160' r='70' fill='#3b82f6'/><rect x='120' y='250' width='160' height='90' rx='12' fill='#1d4ed8'/><text x='200' y='380' font-family='sans-serif' font-size='22' fill='#1e3a8a' text-anchor='middle'>Portrait adherent</text></svg>`
)}`;

// SVG dédié 21/9 (même ratio que le conteneur : rien n'est recadré).
const bandeau = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 840 360'><rect width='840' height='360' fill='#dbeafe'/><rect y='250' width='840' height='110' fill='#86efac'/><circle cx='700' cy='90' r='45' fill='#fde047'/><rect x='150' y='160' width='150' height='90' fill='#f4f4f5'/><rect x='175' y='185' width='35' height='65' fill='#1e3a8a'/><rect x='230' y='185' width='35' height='35' fill='#93c5fd'/><rect x='135' y='140' width='180' height='26' fill='#dc2626'/><rect x='430' y='190' width='120' height='60' fill='#f4f4f5'/><rect x='455' y='210' width='30' height='40' fill='#1d4ed8'/><text x='420' y='325' font-family='sans-serif' font-size='26' fill='#166534' text-anchor='middle'>Forum des tiers-lieux du Pas-de-Calais</text></svg>`
)}`;

// Ratio 16/9 : bandeau d'un tiers-lieu dans l'annuaire.
export const Ratio16sur9 = () => (
  <div style={{ maxWidth: 420 }}>
    <AspectRatio ratio={16 / 9}>
      <img
        src={paysage}
        alt="La Grange numérique, Auxi-le-Château"
        className="rounded-lg"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AspectRatio>
  </div>
);

// Ratio 1/1 : vignette carrée (portrait d'adhérent).
export const RatioCarre = () => (
  <div style={{ maxWidth: 200 }}>
    <AspectRatio ratio={1}>
      <img
        src={carre}
        alt="Portrait d'un adhérent du réseau"
        className="rounded-lg"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AspectRatio>
  </div>
);

// Ratio 21/9 : bannière panoramique.
export const RatioPanoramique = () => (
  <div style={{ maxWidth: 480 }}>
    <AspectRatio ratio={21 / 9}>
      <img
        src={bandeau}
        alt="Bannière panoramique du réseau"
        className="rounded-lg"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AspectRatio>
  </div>
);
